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
  console.error("GITHUB_TOKEN required");
  process.exit(1);
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
    `See PR #148 (Web3CZ removal) and a4e906e (iamagenius00/hermes-a2a removal) for prior examples.\n\n` +
    `_Auto-detected by \`scripts/check-dead-repos.js\` via \`audit-summaries.yml\`. This issue updates in place; it auto-closes when the list goes empty._\n`;
}

await fs.writeFile("dead-repos.md", body);
