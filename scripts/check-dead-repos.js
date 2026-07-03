#!/usr/bin/env node
/**
 * Dead-repo detector for data/repos.json.
 *
 * Issues a single GraphQL query for every entry, captures NOT_FOUND
 * errors (deleted / renamed / private repos), and writes a markdown
 * tracking-issue body to dead-repos.md. Empty file = no dead repos.
 *
 * Background: deleted / renamed / private repos should be removed from
 * Atlas even when build-pages can skip missing metadata, because they
 * otherwise leave stale GitHub links and project pages in the catalog.
 */
import fs from "node:fs/promises";
import { githubHeaders } from "../lib/github.js";

const TOKEN = process.env.GITHUB_TOKEN;
if (!TOKEN) {
  console.warn(
    "GITHUB_TOKEN not set; skipping live dead-repo check. " +
    "Set GITHUB_TOKEN to audit GitHub repo availability."
  );
  // Keep CI fail-loud if this script is wired into automation without auth,
  // but let local developers run it during smoke/audit sessions without a
  // hard failure that looks like repo health failed.
  process.exit(process.env.CI ? 1 : 0);
}

const repos = JSON.parse(await fs.readFile("data/repos.json", "utf8"));

const repoQueries = repos
  .map(
    (r, i) =>
      `repo${i}: repository(owner: "${r.owner}", name: "${r.repo}") { nameWithOwner }`
  )
  .join("\n");

const res = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: { ...githubHeaders(TOKEN), "Content-Type": "application/json" },
  body: JSON.stringify({ query: `query { ${repoQueries} }` }),
});

if (!res.ok) {
  const body = await res.text().catch(() => "");
  console.error(`GraphQL HTTP ${res.status}: ${body.slice(0, 200)}`);
  process.exit(1);
}

const data = await res.json();
const dead = [];

for (const err of data.errors || []) {
  if (err.type !== "NOT_FOUND") {
    console.warn(`Non-NOT_FOUND GraphQL error: ${JSON.stringify(err).slice(0, 200)}`);
    continue;
  }
  const alias = err.path?.[0];
  if (!alias || !alias.startsWith("repo")) continue;
  const idx = parseInt(alias.slice(4), 10);
  const r = repos[idx];
  if (!r) continue;
  dead.push({
    owner: r.owner,
    repo: r.repo,
    url: r.url || `https://github.com/${r.owner}/${r.repo}`,
  });
}

console.log(`Checked ${repos.length} repos: ${dead.length} dead`);

// ECOSYSTEM.md drift: it mirrors the catalog and is bundled into llms-full.txt
// + the RAG chunks, so repo rows left behind after a catalog removal quietly
// pollute LLM retrieval. Flag any ECOSYSTEM.md repo link not in data/repos.json.
let ecoDrift = [];
try {
  const eco = await fs.readFile("ECOSYSTEM.md", "utf8");
  const inCatalog = new Set(repos.map((r) => `${r.owner}/${r.repo}`.toLowerCase()));
  const linked = [
    ...new Set(
      [...eco.matchAll(/github\.com\/([\w.-]+\/[\w.-]+)/g)].map((m) =>
        m[1].replace(/\.git$/, "").toLowerCase()
      )
    ),
  ];
  ecoDrift = linked.filter(
    (k) => !inCatalog.has(k) && !k.startsWith("nousresearch/hermes-agent")
  );
  console.log(`ECOSYSTEM.md: ${ecoDrift.length} repo rows not in catalog`);
} catch (e) {
  console.warn(`Could not read ECOSYSTEM.md for drift check: ${e.message}`);
}

let body = "";
if (dead.length > 0) {
  body =
    `The following ${dead.length} repo${dead.length === 1 ? "" : "s"} in \`data/repos.json\` no longer resolve on GitHub. ` +
    `They may have been deleted, renamed, or made private.\n\n` +
    `**Why this matters**: dead GitHub entries leave stale external links, stale generated project pages, ` +
    `and incomplete metadata in Atlas.\n\n` +
    `## Dead entries\n\n`;
  for (const d of dead) {
    body += `- \`${d.owner}/${d.repo}\` — ${d.url}\n`;
  }
  body +=
    `\n## Fix\n\nRemove each entry from \`data/repos.json\` and merge. ` +
    `See PR #148 (Web3CZ removal) and a4e906e (iamagenius00/hermes-a2a removal) for prior examples.\n\n`;
}

if (ecoDrift.length > 0) {
  body +=
    `## ECOSYSTEM.md drift (${ecoDrift.length})\n\n` +
    `These repos are linked in \`ECOSYSTEM.md\` but are no longer in \`data/repos.json\`. ` +
    `\`ECOSYSTEM.md\` is bundled into \`llms-full.txt\` and the RAG chunks, so these stale rows ` +
    `pollute LLM retrieval.\n\n`;
  for (const k of ecoDrift) body += `- \`${k}\`\n`;
  body += `\n**Fix**: remove each stale row from \`ECOSYSTEM.md\` (or re-add the repo to the catalog).\n\n`;
}

if (body) {
  body +=
    `_Auto-detected by \`scripts/check-dead-repos.js\` via \`audit-summaries.yml\`. This issue updates in place; it auto-closes when the lists go empty._\n`;
}

await fs.writeFile("dead-repos.md", body);
