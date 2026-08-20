#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "@babel/parser";
import traverseModule from "@babel/traverse";

const traverse = traverseModule.default || traverseModule;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CATALOG_PATH = path.join(ROOT, "data", "desktop-plugins.json");
const SHA_RE = /^[0-9a-f]{40}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UTC_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const CUTOFF_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const METHODOLOGY_URL = "https://github.com/ksimback/hermes-ecosystem/blob/main/research/desktop-plugin-methodology.md";
const TYPES = new Set(["standalone", "collection", "embedded integration", "public dotfile plugin", "official standalone"]);
const REVIEW_MODES = new Set(["retrospective-cutoff", "current-head"]);

function isExactDate(value) {
  if (!DATE_RE.test(value || "")) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function isExactUtcTimestamp(value, pattern = UTC_TIMESTAMP_RE) {
  if (!pattern.test(value || "")) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return false;
  const canonical = value.includes(".") ? value : value.replace(/Z$/, ".000Z");
  return parsed.toISOString() === canonical;
}

const SDK_MODULE = "@hermes/plugin-sdk";
const SDK_HELPERS = new Map([
  ["registerPlugin", "registrationContract"],
  ["definePlugin", "contributionContract"],
  ["createPlugin", "contributionContract"],
]);

function sdkModuleName(node) {
  const value = node?.type === "StringLiteral" ? node.value : null;
  return typeof value === "string" && (value === SDK_MODULE || value.startsWith(`${SDK_MODULE}/`));
}

function propertyName(node, computed = false) {
  if (node?.type === "Identifier" && !computed) return node.name;
  if (node?.type === "StringLiteral") return node.value;
  return null;
}

function unwrapPath(pathValue) {
  let current = pathValue;
  while (current?.node && new Set([
    "ParenthesizedExpression",
    "TSAsExpression",
    "TSTypeAssertion",
    "TSNonNullExpression",
    "TSSatisfiesExpression",
    "TypeCastExpression",
  ]).has(current.node.type)) current = current.get("expression");
  return current;
}

function moduleRequest(pathValue) {
  const current = unwrapPath(pathValue);
  if (!current?.node) return false;
  if (current.isAwaitExpression()) return moduleRequest(current.get("argument"));
  if (current.isImportExpression?.()) return sdkModuleName(current.node.source);
  if (!current.isCallExpression()) return false;
  const callee = current.get("callee");
  const args = current.get("arguments");
  if (callee.isImport?.()) return sdkModuleName(args[0]?.node);
  return callee.isIdentifier({ name: "require" })
    && !callee.scope.getBinding("require")
    && sdkModuleName(args[0]?.node);
}

function bindPattern(pathValue, helperBindings, namespaceBindings) {
  if (pathValue.isIdentifier()) {
    const binding = pathValue.scope.getBinding(pathValue.node.name);
    if (binding) namespaceBindings.add(binding);
    return;
  }
  if (!pathValue.isObjectPattern()) return;
  for (const property of pathValue.get("properties")) {
    if (!property.isObjectProperty()) continue;
    const imported = propertyName(property.node.key, property.node.computed);
    const value = property.get("value");
    if (!SDK_HELPERS.has(imported) || !value.isIdentifier()) continue;
    const binding = value.scope.getBinding(value.node.name);
    if (binding) helperBindings.set(binding, SDK_HELPERS.get(imported));
  }
}

function helperForCall(pathValue, helperBindings, namespaceBindings) {
  const callee = unwrapPath(pathValue.get("callee"));
  if (callee.isIdentifier()) {
    const binding = callee.scope.getBinding(callee.node.name);
    return binding ? helperBindings.get(binding) : null;
  }
  if (!callee.isMemberExpression() && !callee.isOptionalMemberExpression?.()) return null;
  const object = unwrapPath(callee.get("object"));
  if (!object.isIdentifier()) return null;
  const binding = object.scope.getBinding(object.node.name);
  if (!binding || !namespaceBindings.has(binding)) return null;
  return SDK_HELPERS.get(propertyName(callee.node.property, callee.node.computed)) || null;
}

function resolveValue(pathValue, seen = new Set()) {
  const current = unwrapPath(pathValue);
  if (!current?.node || seen.has(current.node)) return null;
  seen.add(current.node);
  if (current.isObjectExpression()) return current;
  if (current.isCallExpression()) {
    const callee = current.get("callee");
    if (callee.isMemberExpression()
      && callee.get("object").isIdentifier({ name: "Object" })
      && propertyName(callee.node.property, callee.node.computed) === "freeze") {
      return resolveValue(current.get("arguments.0"), seen);
    }
  }
  if (!current.isIdentifier()) return null;
  const binding = current.scope.getBinding(current.node.name);
  if (!binding?.path.isVariableDeclarator()) return null;
  return resolveValue(binding.path.get("init"), seen);
}

function callableValue(pathValue, seen = new Set()) {
  const current = unwrapPath(pathValue);
  if (!current?.node || seen.has(current.node)) return false;
  seen.add(current.node);
  if (current.isFunctionExpression() || current.isArrowFunctionExpression()) return true;
  if (!current.isIdentifier()) return false;
  const binding = current.scope.getBinding(current.node.name);
  if (!binding) return false;
  if (binding.path.isFunctionDeclaration()) return true;
  return binding.path.isVariableDeclarator() && callableValue(binding.path.get("init"), seen);
}

function hasManifestObject(pathValue) {
  const object = resolveValue(pathValue);
  if (!object) return false;
  let hasId = false;
  let hasRegister = false;
  for (const property of object.get("properties")) {
    if (property.isSpreadElement()) continue;
    const key = propertyName(property.node.key, property.node.computed);
    if (key === "id" && property.isObjectProperty()) hasId = true;
    if (key !== "register") continue;
    if (property.isObjectMethod()) hasRegister = true;
    else if (property.isObjectProperty()) hasRegister = callableValue(property.get("value"));
  }
  return hasId && hasRegister;
}

export function sourceSignals(text) {
  const ast = parse(text, {
    sourceType: "unambiguous",
    createImportExpressions: true,
    plugins: ["typescript", "jsx", "decorators-legacy", "importAttributes"],
  });
  let sdkImport = false;
  const helperBindings = new Map();
  const namespaceBindings = new Set();
  const callPaths = [];
  const defaultExports = [];

  traverse(ast, {
    ImportDeclaration(pathValue) {
      if (!sdkModuleName(pathValue.node.source)) return;
      sdkImport = true;
      for (const specifier of pathValue.get("specifiers")) {
        const local = specifier.get("local");
        const binding = local.scope.getBinding(local.node.name);
        if (!binding) continue;
        if (specifier.isImportNamespaceSpecifier()) namespaceBindings.add(binding);
        else if (specifier.isImportSpecifier()) {
          const imported = propertyName(specifier.node.imported);
          if (SDK_HELPERS.has(imported)) helperBindings.set(binding, SDK_HELPERS.get(imported));
        }
      }
    },
    ExportNamedDeclaration(pathValue) {
      if (sdkModuleName(pathValue.node.source)) sdkImport = true;
      for (const specifier of pathValue.get("specifiers")) {
        if (propertyName(specifier.node.exported) === "default") defaultExports.push(specifier.get("local"));
      }
    },
    ExportAllDeclaration(pathValue) {
      if (sdkModuleName(pathValue.node.source)) sdkImport = true;
    },
    ExportDefaultDeclaration(pathValue) {
      defaultExports.push(pathValue.get("declaration"));
    },
    VariableDeclarator(pathValue) {
      if (!moduleRequest(pathValue.get("init"))) return;
      sdkImport = true;
      bindPattern(pathValue.get("id"), helperBindings, namespaceBindings);
    },
    ImportExpression(pathValue) {
      if (sdkModuleName(pathValue.node.source)) sdkImport = true;
    },
    CallExpression(pathValue) {
      if (moduleRequest(pathValue)) sdkImport = true;
      callPaths.push(pathValue);
    },
  });

  let registrationContract = defaultExports.some(hasManifestObject);
  let contributionContract = false;
  for (const callPath of callPaths) {
    const signal = helperForCall(callPath, helperBindings, namespaceBindings);
    if (signal === "registrationContract") registrationContract = true;
    if (signal === "contributionContract") contributionContract = true;
  }
  return { sdkImport, registrationContract, contributionContract };
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
  if (!isExactDate(catalog?.cutoff)) errors.push("cutoff must be a valid YYYY-MM-DD date");
  if (!isExactUtcTimestamp(catalog?.cutoffAt, CUTOFF_TIMESTAMP_RE)) errors.push("cutoffAt must be an exact UTC timestamp");
  if (catalog?.cutoffAt?.slice(0, 10) !== catalog?.cutoff) errors.push("cutoffAt date must match cutoff");
  if (!REVIEW_MODES.has(catalog?.reviewMode)) errors.push("reviewMode is invalid");
  if (catalog?.evidenceTier !== "source-verified") errors.push("evidenceTier must be source-verified");
  if (typeof catalog?.notice !== "string" || catalog.notice.trim() === "") errors.push("notice is empty");
  if (catalog?.methodology !== METHODOLOGY_URL) errors.push("methodology must be the canonical Atlas methodology URL");
  if (!Array.isArray(catalog?.plugins)) return [...errors, "plugins must be an array"];
  if (catalog.plugins.length === 0) errors.push("plugins must not be empty");
  const keys = new Set();
  for (const [index, plugin] of catalog.plugins.entries()) {
    const at = `plugins[${index}]`;
    if (!plugin || typeof plugin !== "object" || Array.isArray(plugin)) {
      errors.push(`${at} must be an object`);
      continue;
    }
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
    if (typeof plugin.defaultBranch !== "string" || plugin.defaultBranch.trim() === "") errors.push(`${at}.defaultBranch is empty`);
    if (!SHA_RE.test(plugin.reviewedCommit || "")) errors.push(`${at}.reviewedCommit is not immutable`);
    if (!isExactUtcTimestamp(plugin.reviewedCommitAt)) errors.push(`${at}.reviewedCommitAt is invalid`);
    if (catalog.reviewMode === "retrospective-cutoff" && Date.parse(plugin.reviewedCommitAt) > Date.parse(catalog.cutoffAt)) errors.push(`${at}.reviewedCommitAt is later than cutoffAt`);
    if (!isExactUtcTimestamp(plugin.reviewedAt)) errors.push(`${at}.reviewedAt is invalid`);
    if (!plugin.observed || typeof plugin.observed !== "object" || Array.isArray(plugin.observed)) errors.push(`${at}.observed is invalid`);
    else {
      for (const field of ["stars", "forks"]) {
        if (plugin.observed[field] !== undefined && (!Number.isInteger(plugin.observed[field]) || plugin.observed[field] < 0)) errors.push(`${at}.observed.${field} is invalid`);
      }
      if (plugin.observed.activityAt !== undefined && Number.isNaN(Date.parse(plugin.observed.activityAt))) errors.push(`${at}.observed.activityAt is invalid`);
    }
    const directSources = Array.isArray(plugin.sources) ? plugin.sources : [];
    const ignoredSources = Array.isArray(plugin.ignoredSources) ? plugin.ignoredSources : [];
    if (directSources.length === 0) errors.push(`${at}.sources is empty`);
    if (plugin.ignoredSources !== undefined && !Array.isArray(plugin.ignoredSources)) errors.push(`${at}.ignoredSources must be an array`);
    let completeSource = false;
    const seenPaths = new Set();
    for (const [sourceIndex, source] of directSources.entries()) {
      const sat = `${at}.sources[${sourceIndex}]`;
      if (!source || typeof source !== "object" || Array.isArray(source)) {
        errors.push(`${sat} must be an object`);
        continue;
      }
      const sourcePath = typeof source.path === "string" ? source.path : "";
      const segments = sourcePath.split("/");
      if (!sourcePath || sourcePath.startsWith("/") || segments.includes("..")) errors.push(`${sat}.path is invalid`);
      if (seenPaths.has(sourcePath)) errors.push(`${sat}.path is duplicated`);
      seenPaths.add(sourcePath);
      const expected = `https://raw.githubusercontent.com/${plugin.repository}/${plugin.reviewedCommit}/${sourcePath.split("/").map(encodeURIComponent).join("/")}`;
      if (source.rawUrl !== expected) errors.push(`${sat}.rawUrl is not canonical and immutable`);
      if (!["sdkImport", "registrationContract", "contributionContract"].every((key) => typeof source.signals?.[key] === "boolean")) errors.push(`${sat}.signals must be booleans`);
      const hasContract = source.signals?.registrationContract || source.signals?.contributionContract;
      if (!source.signals?.sdkImport && !hasContract) errors.push(`${sat} has no Desktop SDK evidence signal`);
      if (source.signals?.sdkImport && hasContract) completeSource = true;
    }
    for (const [sourceIndex, source] of ignoredSources.entries()) {
      const sat = `${at}.ignoredSources[${sourceIndex}]`;
      if (!source || typeof source !== "object" || Array.isArray(source)) {
        errors.push(`${sat} must be an object`);
        continue;
      }
      const sourcePath = typeof source.path === "string" ? source.path : "";
      const segments = sourcePath.split("/");
      if (!sourcePath || sourcePath.startsWith("/") || segments.includes("..")) errors.push(`${sat}.path is invalid`);
      if (seenPaths.has(sourcePath)) errors.push(`${sat}.path is duplicated`);
      seenPaths.add(sourcePath);
      const expected = `https://raw.githubusercontent.com/${plugin.repository}/${plugin.reviewedCommit}/${sourcePath.split("/").map(encodeURIComponent).join("/")}`;
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

export function serializeValidatedCatalog(catalog) {
  const errors = validateCatalog(catalog);
  if (errors.length) throw new Error(`Catalog validation failed:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  return canonicalizeCatalog(catalog);
}

export function parseArgs(argv) {
  const options = { write: true, network: true, concurrency: 6 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--check") options.write = false;
    else if (arg === "--validate") { options.write = false; options.network = false; }
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
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 12) throw new Error("concurrency must be an integer from 1 to 12");
  if (!isExactUtcTimestamp(reviewedAt)) throw new Error("reviewedAt must be an exact UTC timestamp");
  const failures = [];
  const plugins = await mapBounded(catalog.plugins, concurrency, async (plugin) => {
    try {
      const repo = await githubJson(fetchImpl, token, `/repos/${plugin.repository}`);
      const commit = await githubJson(fetchImpl, token, `/repos/${plugin.repository}/commits/${encodeURIComponent(repo.default_branch)}`);
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
      const basePlugin = { ...plugin };
      delete basePlugin.ignoredSources;
      return {
        ...basePlugin,
        purpose: repo.description || plugin.purpose || plugin.repository,
        observed: { stars: repo.stargazers_count, forks: repo.forks_count, activityAt: repo.pushed_at },
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
  return { catalog: { ...catalog, reviewMode: "current-head", plugins }, failures: failures.sort() };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const original = await fs.readFile(CATALOG_PATH, "utf8");
  const catalog = JSON.parse(original);
  serializeValidatedCatalog(catalog);
  if (!options.network) {
    if (original !== canonicalizeCatalog(catalog)) throw new Error("Catalog is not deterministically ordered/formatted");
    console.log("Desktop plugin catalog is valid and deterministic.");
    return;
  }
  const result = await refreshCatalog(catalog, { token: process.env.GITHUB_TOKEN, concurrency: options.concurrency });
  if (result.failures.length) throw new Error(`Current-head evidence failures:\n${result.failures.map((e) => `- ${e}`).join("\n")}`);
  const next = serializeValidatedCatalog(result.catalog);
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
