#!/usr/bin/env node
// Weekly drift check for data/plugins.json (the curated Plugins Hub, /plugins/)
// against the official Hermes plugin catalog
// (NousResearch/hermes-agent, plugin-catalog/<name>.yaml).
//
// Why this exists: the hub promises "catalog installs only" and prints each
// pick's tier and Hermes version floor. Those are copied from the catalog by
// hand, so they drift silently when Nous re-tiers, re-pins or drops an entry,
// or when a pick's repo goes stale. This audit fails loud instead: every pick
// is either "ok", "drift" (with the fields that changed), or "unchecked"
// (fetch failed). An unchecked pick is reported, never treated as ok.
//
// Usage:
//   node scripts/audit-plugins.js                 # human-readable report, exit 1 on drift
//   node scripts/audit-plugins.js --json out.json # also write the machine report
//
// GITHUB_TOKEN (optional locally, set in CI) raises GitHub API rate limits.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const CATALOG_REPO = "NousResearch/hermes-agent";
const CATALOG_DIR = "plugin-catalog";
export const STALE_DAYS = 90;

/** Read top-level scalar fields from a catalog YAML entry (no YAML dependency). */
export function parseCatalogYaml(text) {
  const field = (key) => {
    const m = text.match(new RegExp(`^${key}:[ \\t]*(.*)$`, "m"));
    if (!m) return null;
    const v = m[1].replace(/\s+#.*$/, "").trim().replace(/^["']|["']$/g, "");
    return v === "" ? null : v;
  };
  const known = text.match(/^known_issues:[ \t]*\r?\n((?:[ \t]+-.*\r?\n?)*)/m);
  return {
    name: field("name"),
    repo: field("repo"),
    tier: field("tier") || "community", // catalog default per the docs
    requiresHermes: field("requires_hermes"),
    knownIssues: known ? known[1].split(/\r?\n/).filter((l) => /^\s+-/.test(l)).length : 0,
  };
}

/** "https://github.com/Owner/Repo(.git)" -> "owner/repo" (lowercased) */
export function repoKey(url) {
  const m = String(url || "").match(/github\.com\/([^/\s]+)\/([^/\s#?]+)/i);
  return m ? `${m[1]}/${m[2].replace(/\.git$/i, "")}`.toLowerCase() : String(url || "").toLowerCase();
}

/**
 * Compare one curated pick with its catalog entry and repo metadata.
 * @returns {string[]} human-readable drift findings; empty means in sync
 */
export function diffPick(pick, entry, repoMeta, now = new Date()) {
  const out = [];
  if (!entry) return ["no longer in the official catalog"];
  if (entry.tier !== pick.tier) out.push(`tier is now "${entry.tier}" (hub says "${pick.tier}")`);
  if ((entry.requiresHermes || null) !== (pick.requiresHermes || null)) {
    out.push(`requires_hermes is now ${entry.requiresHermes || "unset"} (hub says ${pick.requiresHermes || "unset"})`);
  }
  if (repoKey(entry.repo) !== pick.repo.toLowerCase()) {
    out.push(`catalog repo is now ${repoKey(entry.repo)} (hub says ${pick.repo})`);
  }
  if (repoMeta) {
    if (repoMeta.archived) out.push("repo is archived");
    if (repoMeta.pushedAt) {
      const days = Math.floor((now - new Date(repoMeta.pushedAt)) / 86400000);
      if (days > STALE_DAYS) out.push(`no push in ${days} days`);
    }
  }
  return out;
}

async function getJson(url, token) {
  const res = await fetch(url, {
    headers: { Accept: "application/vnd.github+json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) {
    const err = new Error(`${res.status} ${res.statusText} for ${url}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function getText(url) {
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.text();
}

/** Count catalog entries via the git trees API (the contents API caps at 1,000). */
async function countCatalog(token) {
  const root = await getJson(`https://api.github.com/repos/${CATALOG_REPO}/git/trees/main`, token);
  const dir = root.tree.find((t) => t.path === CATALOG_DIR && t.type === "tree");
  if (!dir) throw new Error(`${CATALOG_DIR}/ not found in ${CATALOG_REPO}`);
  const sub = await getJson(`https://api.github.com/repos/${CATALOG_REPO}/git/trees/${dir.sha}`, token);
  if (sub.truncated) throw new Error("catalog tree listing truncated");
  return sub.tree.filter((t) => t.type === "blob" && /\.ya?ml$/.test(t.path)).length;
}

export async function auditPlugins(data, { token = process.env.GITHUB_TOKEN, now = new Date() } = {}) {
  const results = [];
  const repoCache = new Map();
  for (const pick of data.plugins) {
    try {
      const text = await getText(
        `https://raw.githubusercontent.com/${CATALOG_REPO}/main/${CATALOG_DIR}/${pick.name}.yaml`,
      );
      const entry = text ? parseCatalogYaml(text) : null;
      const key = pick.repo.toLowerCase();
      if (!repoCache.has(key)) {
        const meta = await getJson(`https://api.github.com/repos/${pick.repo}`, token);
        repoCache.set(key, { archived: meta.archived, pushedAt: meta.pushed_at });
      }
      const findings = diffPick(pick, entry, repoCache.get(key), now);
      results.push({
        name: pick.name,
        status: findings.length ? "drift" : "ok",
        findings,
        knownIssues: entry ? entry.knownIssues : null,
      });
    } catch (e) {
      results.push({ name: pick.name, status: "unchecked", findings: [String(e.message || e)] });
    }
  }
  let catalogEntries = null;
  let catalogError = null;
  try {
    catalogEntries = await countCatalog(token);
  } catch (e) {
    catalogError = String(e.message || e);
  }
  return { checkedAt: now.toISOString().slice(0, 10), catalogEntries, catalogError, results };
}

export function formatReport(report, data) {
  const lines = [];
  const bad = report.results.filter((r) => r.status !== "ok");
  lines.push(`Plugins Hub audit (${report.checkedAt}): ${report.results.length} picks, ${bad.length} need attention.`);
  if (report.catalogEntries != null) {
    lines.push(
      `Official catalog: ${report.catalogEntries} entries (hub says ${data.catalogEntries} as of ${data.catalogCheckedAt}).`,
    );
  } else {
    lines.push(`Official catalog count: unchecked (${report.catalogError}).`);
  }
  for (const r of bad) lines.push(`- \`${r.name}\` [${r.status}]: ${r.findings.join("; ")}`);
  return lines.join("\n");
}

async function main() {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "plugins.json"), "utf-8"));
  const report = await auditPlugins(data);
  console.log(formatReport(report, data));
  const jsonIdx = process.argv.indexOf("--json");
  if (jsonIdx !== -1 && process.argv[jsonIdx + 1]) {
    fs.writeFileSync(process.argv[jsonIdx + 1], JSON.stringify({ ...report, markdown: formatReport(report, data) }, null, 2));
  }
  if (report.results.some((r) => r.status !== "ok") || report.catalogEntries == null) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
