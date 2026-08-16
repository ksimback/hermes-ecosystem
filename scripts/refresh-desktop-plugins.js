#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CATALOG_PATH = path.join(ROOT, "data", "desktop-plugins.json");
const SHA_RE = /^[0-9a-f]{40}$/;
const TYPES = new Set(["standalone", "collection", "embedded integration", "public dotfile plugin", "official standalone"]);
const REVIEW_MODES = new Set(["cutoff-baseline", "current-head"]);

function lexSource(text) {
  const code = text.split("");
  const tokens = [];
  const blank = (start, end) => {
    for (let index = start; index < end; index += 1) {
      if (code[index] !== "\n" && code[index] !== "\r") code[index] = " ";
    }
  };
  const scanQuoted = (start, quote) => {
    let cursor = start + 1;
    while (cursor < text.length) {
      if (text[cursor] === "\\") cursor += 2;
      else if (text[cursor] === quote) return cursor + 1;
      else cursor += 1;
    }
    return cursor;
  };
  function scanTemplate(start) {
    let cursor = start + 1;
    while (cursor < text.length) {
      if (text[cursor] === "\\") cursor += 2;
      else if (text[cursor] === "`") return cursor + 1;
      else if (text[cursor] === "$" && text[cursor + 1] === "{") cursor = scanExpression(cursor + 2);
      else cursor += 1;
    }
    return cursor;
  }
  const scanRegex = (start) => {
    let cursor = start + 1;
    let inClass = false;
    while (cursor < text.length && text[cursor] !== "\n" && text[cursor] !== "\r") {
      if (text[cursor] === "\\") cursor += 2;
      else if (text[cursor] === "[") { inClass = true; cursor += 1; }
      else if (text[cursor] === "]") { inClass = false; cursor += 1; }
      else if (text[cursor] === "/" && !inClass) {
        cursor += 1;
        while (cursor < text.length && /[A-Za-z]/.test(text[cursor])) cursor += 1;
        return cursor;
      } else cursor += 1;
    }
    return null;
  };
  const canStartRegexAt = (cursor) => {
    let previous = cursor - 1;
    while (previous >= 0 && /\s/.test(text[previous])) previous -= 1;
    if (previous < 0) return true;
    if (/[({[\],;:=!?&|+\-*%^~<>]/.test(text[previous])) return true;
    if (/[A-Za-z0-9_$]/.test(text[previous])) {
      let start = previous;
      while (start > 0 && /[A-Za-z0-9_$]/.test(text[start - 1])) start -= 1;
      return new Set(["await", "case", "delete", "in", "instanceof", "new", "of", "return", "throw", "typeof", "void", "yield"]).has(text.slice(start, previous + 1));
    }
    return false;
  };
  function scanExpression(start) {
    let cursor = start;
    let depth = 1;
    while (cursor < text.length && depth > 0) {
      if (text[cursor] === "'" || text[cursor] === '"') cursor = scanQuoted(cursor, text[cursor]);
      else if (text[cursor] === "`") cursor = scanTemplate(cursor);
      else if (text[cursor] === "/" && text[cursor + 1] === "/") {
        cursor += 2;
        while (cursor < text.length && text[cursor] !== "\n") cursor += 1;
      } else if (text[cursor] === "/" && text[cursor + 1] === "*") {
        cursor += 2;
        while (cursor < text.length && !(text[cursor] === "*" && text[cursor + 1] === "/")) cursor += 1;
        cursor = Math.min(text.length, cursor + 2);
      } else if (text[cursor] === "/" && canStartRegexAt(cursor)) {
        cursor = scanRegex(cursor) || cursor + 1;
      } else {
        if (text[cursor] === "{") depth += 1;
        else if (text[cursor] === "}") depth -= 1;
        cursor += 1;
      }
    }
    return cursor;
  }
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    const next = text[index + 1];
    if (char === "/" && next === "/") {
      const start = index;
      index += 2;
      while (index < text.length && text[index] !== "\n") index += 1;
      blank(start, index);
    } else if (char === "/" && next === "*") {
      const start = index;
      index += 2;
      while (index < text.length && !(text[index] === "*" && text[index + 1] === "/")) index += 1;
      index = Math.min(text.length, index + 2);
      blank(start, index);
    } else if (char === "/" && canStartRegexAt(index)) {
      const end = scanRegex(index);
      if (end) {
        blank(index, end);
        index = end;
      } else {
        tokens.push({ type: "punctuation", value: char });
        index += 1;
      }
    } else if (char === "'" || char === '"') {
      const quote = char;
      const start = index;
      let value = "";
      index += 1;
      while (index < text.length) {
        if (text[index] === "\\") {
          value += text[index + 1] || "";
          index += 2;
        } else if (text[index] === quote) {
          index += 1;
          break;
        } else {
          value += text[index];
          index += 1;
        }
      }
      tokens.push({ type: "string", value });
      blank(start, index);
    } else if (char === "`") {
      const start = index;
      index = scanTemplate(index);
      blank(start, index);
    } else if (/[A-Za-z_$]/.test(char)) {
      const start = index;
      index += 1;
      while (index < text.length && /[A-Za-z0-9_$]/.test(text[index])) index += 1;
      tokens.push({ type: "identifier", value: text.slice(start, index) });
    } else {
      if (!/\s/.test(char)) tokens.push({ type: "punctuation", value: char });
      index += 1;
    }
  }
  return { code: code.join(""), tokens };
}

function hasSdkImport(tokens) {
  return tokens.some((token, index) => {
    if (token.type !== "string" || !(token.value === "@hermes/plugin-sdk" || token.value.startsWith("@hermes/plugin-sdk/"))) return false;
    const previous = tokens[index - 1]?.value;
    const beforePrevious = tokens[index - 2]?.value;
    const callOwner = tokens[index - 3]?.value;
    const bareImport = previous === "import" && tokens[index - 2]?.value !== ".";
    const moduleCall = previous === "(" && (beforePrevious === "require" || beforePrevious === "import") && callOwner !== ".";
    return previous === "from" || bareImport || moduleCall;
  });
}

export function sourceSignals(text) {
  const scanned = lexSource(text);
  const sdkImport = hasSdkImport(scanned.tokens);
  const hasDefaultExport = /export\s+default\b/.test(scanned.code) || /export\s*\{[\s\S]{0,500}?\bas\s+default\b/.test(scanned.code);
  const manifestObject = /(?:export\s+default\s+|(?:const|let|var)\s+[A-Za-z_$][\w$]*(?:\s*:\s*[^=\n]+)?\s*=\s*)\(?\s*\{[\s\S]{0,2200}?\bid\s*:[\s\S]{0,2200}?\bregister(?:\s*:\s*function\b|\s*\(|\s*[,}])/.test(scanned.code);
  return {
    sdkImport,
    registrationContract: /\bregisterPlugin\s*\(/.test(scanned.code) || (hasDefaultExport && manifestObject),
    contributionContract: /\b(?:definePlugin|createPlugin)\s*\(/.test(scanned.code),
  };
}

export async function mapBounded(items, limit, fn) {
  const output = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      output[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return output;
}

export function validateCatalog(catalog) {
  const errors = [];
  if (catalog?.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(catalog?.cutoff || "")) errors.push("cutoff must be YYYY-MM-DD");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(catalog?.cutoffAt || "")) errors.push("cutoffAt must be an exact UTC timestamp");
  if (catalog?.cutoffAt?.slice(0, 10) !== catalog?.cutoff) errors.push("cutoffAt date must match cutoff");
  if (!REVIEW_MODES.has(catalog?.reviewMode)) errors.push("reviewMode is invalid");
  if (!Array.isArray(catalog?.plugins)) return [...errors, "plugins must be an array"];
  const keys = new Set();
  for (const [index, plugin] of catalog.plugins.entries()) {
    const at = `plugins[${index}]`;
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(plugin.repository || "")) errors.push(`${at}.repository is invalid`);
    const key = String(plugin.repository).toLowerCase();
    if (keys.has(key)) errors.push(`${at}.repository is duplicated`);
    keys.add(key);
    if (plugin.url !== `https://github.com/${plugin.repository}`) errors.push(`${at}.url is not canonical https GitHub`);
    if (!TYPES.has(plugin.distributionType)) errors.push(`${at}.distributionType is invalid`);
    if (typeof plugin.purpose !== "string" || plugin.purpose.trim() === "") errors.push(`${at}.purpose is empty`);
    if (typeof plugin.official !== "boolean") errors.push(`${at}.official must be boolean`);
    if (plugin.official !== (plugin.distributionType === "official standalone")) errors.push(`${at}.official disagrees with distributionType`);
    if (plugin.official && !String(plugin.repository).toLowerCase().startsWith("nousresearch/")) errors.push(`${at}.official repository is not owned by NousResearch`);
    if (!SHA_RE.test(plugin.reviewedCommit || "")) errors.push(`${at}.reviewedCommit is not immutable`);
    if (!/^\d{4}-\d{2}-\d{2}T/.test(plugin.reviewedCommitAt || "") || Number.isNaN(Date.parse(plugin.reviewedCommitAt))) errors.push(`${at}.reviewedCommitAt is invalid`);
    if (catalog.reviewMode === "cutoff-baseline" && Date.parse(plugin.reviewedCommitAt) > Date.parse(catalog.cutoffAt)) errors.push(`${at}.reviewedCommitAt is later than cutoffAt`);
    if (!/^\d{4}-\d{2}-\d{2}T/.test(plugin.reviewedAt || "") || Number.isNaN(Date.parse(plugin.reviewedAt))) errors.push(`${at}.reviewedAt is invalid`);
    if (!Array.isArray(plugin.sources) || plugin.sources.length === 0) errors.push(`${at}.sources is empty`);
    let completeSource = false;
    const seenPaths = new Set();
    for (const [sourceIndex, source] of (plugin.sources || []).entries()) {
      const sat = `${at}.sources[${sourceIndex}]`;
      const segments = String(source.path || "").split("/");
      if (!source.path || source.path.startsWith("/") || segments.includes("..")) errors.push(`${sat}.path is invalid`);
      if (seenPaths.has(source.path)) errors.push(`${sat}.path is duplicated`);
      seenPaths.add(source.path);
      const expected = `https://raw.githubusercontent.com/${plugin.repository}/${plugin.reviewedCommit}/${source.path.split("/").map(encodeURIComponent).join("/")}`;
      if (source.rawUrl !== expected) errors.push(`${sat}.rawUrl is not canonical and immutable`);
      if (!["sdkImport", "registrationContract", "contributionContract"].every((key) => typeof source.signals?.[key] === "boolean")) errors.push(`${sat}.signals must be booleans`);
      const hasContract = source.signals?.registrationContract || source.signals?.contributionContract;
      if (!source.signals?.sdkImport && !hasContract) errors.push(`${sat} has no Desktop SDK evidence signal`);
      if (source.signals?.sdkImport && hasContract) completeSource = true;
    }
    for (const [sourceIndex, source] of (plugin.ignoredSources || []).entries()) {
      const sat = `${at}.ignoredSources[${sourceIndex}]`;
      const segments = String(source.path || "").split("/");
      if (!source.path || source.path.startsWith("/") || segments.includes("..")) errors.push(`${sat}.path is invalid`);
      if (seenPaths.has(source.path)) errors.push(`${sat}.path is duplicated`);
      seenPaths.add(source.path);
      const expected = `https://raw.githubusercontent.com/${plugin.repository}/${plugin.reviewedCommit}/${source.path.split("/").map(encodeURIComponent).join("/")}`;
      if (source.rawUrl !== expected) errors.push(`${sat}.rawUrl is not canonical and immutable`);
      if (!["sdkImport", "registrationContract", "contributionContract"].every((key) => typeof source.signals?.[key] === "boolean")) errors.push(`${sat}.signals must be booleans`);
      if (Object.values(source.signals || {}).some(Boolean)) errors.push(`${sat} unexpectedly has an evidence signal`);
      if (source.reason !== "no direct Desktop SDK evidence signal") errors.push(`${sat}.reason is invalid`);
    }
    if (!completeSource) errors.push(`${at} lacks a source with both SDK import and plugin contract`);
  }
  return errors;
}

export function canonicalizeCatalog(catalog) {
  const copy = structuredClone(catalog);
  copy.plugins.sort((a, b) => a.repository.localeCompare(b.repository, "en", { sensitivity: "base" }));
  for (const plugin of copy.plugins) {
    plugin.sources.sort((a, b) => a.path.localeCompare(b.path));
    if (plugin.ignoredSources) plugin.ignoredSources.sort((a, b) => a.path.localeCompare(b.path));
  }
  return JSON.stringify(copy, null, 2) + "\n";
}

export function parseArgs(argv) {
  const options = { write: true, network: true, concurrency: 6, seed: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--check") options.write = false;
    else if (arg === "--validate") { options.write = false; options.network = false; }
    else if (arg === "--seed") {
      options.seed = argv[++i];
      if (!options.seed) throw new Error("--seed requires a CSV path");
    }
    else if (arg === "--concurrency") {
      options.concurrency = Number(argv[++i]);
      if (!Number.isInteger(options.concurrency) || options.concurrency < 1 || options.concurrency > 12) throw new Error("--concurrency must be an integer from 1 to 12");
    } else throw new Error(`Unknown option: ${arg}`);
  }
  return options;
}

function headers(token, accept = "application/vnd.github+json") {
  return { Accept: accept, Authorization: `Bearer ${token}`, "User-Agent": "hermes-atlas-desktop-plugin-verifier", "X-GitHub-Api-Version": "2022-11-28" };
}

async function githubJson(fetchImpl, token, endpoint) {
  const response = await fetchImpl(`https://api.github.com${endpoint}`, { headers: headers(token) });
  if (!response.ok) throw new Error(`${endpoint}: GitHub returned ${response.status}`);
  return response.json();
}

async function githubText(fetchImpl, token, repository, sha, sourcePath) {
  const encodedPath = sourcePath.split("/").map(encodeURIComponent).join("/");
  const response = await fetchImpl(`https://api.github.com/repos/${repository}/contents/${encodedPath}?ref=${sha}`, {
    headers: headers(token, "application/vnd.github.raw+json"),
  });
  if (!response.ok) throw new Error(`${repository}/${sourcePath}: GitHub returned ${response.status}`);
  return response.text();
}

export async function refreshCatalog(catalog, { token, concurrency = 6, fetchImpl = fetch, reviewedAt = new Date().toISOString() } = {}) {
  if (!token) throw new Error("GITHUB_TOKEN is required for live verification");
  if (Number.isNaN(Date.parse(reviewedAt))) throw new Error("reviewedAt must be an ISO timestamp");
  const failures = [];
  const resolvingBaseline = Boolean(catalog.resolveAtCutoff);
  const plugins = await mapBounded(catalog.plugins, concurrency, async (plugin) => {
    try {
      const repo = await githubJson(fetchImpl, token, `/repos/${plugin.repository}`);
      const commit = resolvingBaseline
        ? (await githubJson(fetchImpl, token, `/repos/${plugin.repository}/commits?sha=${encodeURIComponent(repo.default_branch)}&until=${encodeURIComponent(catalog.cutoffAt)}&per_page=1`))[0]
        : await githubJson(fetchImpl, token, `/repos/${plugin.repository}/commits/${encodeURIComponent(repo.default_branch)}`);
      if (!commit) throw new Error(`no default-branch commit existed by ${catalog.cutoff}`);
      const sha = commit.sha;
      if (!SHA_RE.test(sha)) throw new Error("default branch did not resolve to a full commit SHA");
      const sources = [];
      const ignoredSources = [];
      const candidatePaths = [...new Set([...(plugin.sources || []), ...(plugin.ignoredSources || [])].map((source) => source.path))];
      for (const sourcePath of candidatePaths) {
        const text = await githubText(fetchImpl, token, plugin.repository, sha, sourcePath);
        const signals = sourceSignals(text);
        const record = { path: sourcePath, rawUrl: `https://raw.githubusercontent.com/${plugin.repository}/${sha}/${sourcePath.split("/").map(encodeURIComponent).join("/")}`, signals };
        if (Object.values(signals).some(Boolean)) sources.push(record);
        else ignoredSources.push({ ...record, reason: "no direct Desktop SDK evidence signal" });
      }
      if (!sources.some((source) => source.signals.sdkImport && (source.signals.registrationContract || source.signals.contributionContract))) {
        throw new Error("no supplied source path contained both the SDK import and a plugin contract");
      }
      const commitAt = commit.commit?.committer?.date || commit.commit?.author?.date;
      if (!commitAt) throw new Error("commit timestamp was unavailable");
      return {
        ...plugin,
        purpose: resolvingBaseline ? (plugin.purpose || repo.description || plugin.repository) : (repo.description || plugin.purpose || plugin.repository),
        observed: resolvingBaseline ? plugin.observed : { stars: repo.stargazers_count, forks: repo.forks_count, activityAt: repo.pushed_at },
        defaultBranch: repo.default_branch,
        reviewedCommit: sha,
        reviewedCommitAt: commitAt,
        reviewedAt: sha === plugin.reviewedCommit && plugin.reviewedAt ? plugin.reviewedAt : reviewedAt,
        sources,
        ...(ignoredSources.length ? { ignoredSources } : {}),
      };
    } catch (error) {
      failures.push(`${plugin.repository}: ${error.message}`);
      return plugin;
    }
  });
  const { resolveAtCutoff, ...publicCatalog } = catalog;
  return { catalog: { ...publicCatalog, reviewMode: resolvingBaseline ? "cutoff-baseline" : "current-head", plugins }, failures };
}

function parseSeedCsv(text) {
  const lines = text.replace(/\r/g, "").trim().split("\n");
  const split = (line) => {
    const cells = []; let cell = ""; let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"' && quoted && line[i + 1] === '"') { cell += '"'; i += 1; }
      else if (char === '"') quoted = !quoted;
      else if (char === "," && !quoted) { cells.push(cell); cell = ""; }
      else cell += char;
    }
    cells.push(cell); return cells;
  };
  const fields = split(lines.shift());
  return lines.map((line) => Object.fromEntries(fields.map((field, i) => [field, split(line)[i] || ""])));
}

async function catalogFromSeed(seedPath) {
  const rows = parseSeedCsv(await fs.readFile(path.resolve(seedPath), "utf8"));
  return {
    schemaVersion: 1,
    cutoff: "2026-08-14",
    cutoffAt: "2026-08-14T17:29:59Z",
    reviewMode: "cutoff-baseline",
    evidenceTier: "source-verified",
    notice: "Static source verification confirms observed Hermes Desktop SDK contracts at an immutable revision. It is not endorsement or dynamic safety testing.",
    methodology: "https://github.com/ksimback/hermes-ecosystem/blob/main/research/desktop-plugin-methodology.md",
    resolveAtCutoff: true,
    plugins: rows.map((row) => ({
      repository: row.repository,
      url: row.url,
      purpose: row.purpose,
      distributionType: row.type,
      official: row.type === "official standalone",
      observed: {
        ...(row.stars === "" ? {} : { stars: Number(row.stars) }),
        ...(row.forks === "" ? {} : { forks: Number(row.forks) }),
        activityAt: row.latest_commit,
      },
      defaultBranch: "",
      reviewedCommit: "0000000000000000000000000000000000000000",
      reviewedCommitAt: "",
      reviewedAt: "",
      sources: row.source_urls.split(/\s+/).map((url) => ({ path: new URL(url).pathname.split("/HEAD/")[1], rawUrl: url, signals: {} })),
    })),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  let original = "";
  let catalog;
  if (options.seed) catalog = await catalogFromSeed(options.seed);
  else { original = await fs.readFile(CATALOG_PATH, "utf8"); catalog = JSON.parse(original); }
  if (!options.seed) {
    const initialErrors = validateCatalog(catalog);
    if (initialErrors.length) throw new Error(`Catalog validation failed:\n${initialErrors.map((e) => `- ${e}`).join("\n")}`);
  }
  if (!options.network) {
    if (original !== canonicalizeCatalog(catalog)) throw new Error("Catalog is not deterministically ordered/formatted");
    console.log("Desktop plugin catalog is valid and deterministic.");
    return;
  }
  const result = await refreshCatalog(catalog, { token: process.env.GITHUB_TOKEN, concurrency: options.concurrency });
  if (result.failures.length) throw new Error(`Verification failures:\n${result.failures.map((e) => `- ${e}`).join("\n")}`);
  const next = canonicalizeCatalog(result.catalog);
  const drift = next !== original;
  if (options.write) {
    if (drift) await fs.writeFile(CATALOG_PATH, next);
    console.log(drift ? "Desktop plugin catalog refreshed." : "Desktop plugin catalog is current.");
  } else {
    console.log(drift ? "Desktop plugin catalog drift detected." : "Desktop plugin catalog is current.");
    if (drift) process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
