#!/usr/bin/env node
/**
 * Catalog health sweep for data/repos.json and ECOSYSTEM.md.
 *
 * Issues one GraphQL query for every catalog entry and a second for any
 * ECOSYSTEM.md row that is not in the catalog, then writes a markdown
 * tracking-issue body to dead-repos.md. Empty file = healthy.
 *
 * Reports three distinct conditions, because they need different fixes:
 *
 *   dead    — NOT_FOUND. Breaks the stars snapshot; remove the entry.
 *   renamed — resolves to a different nameWithOwner. Nothing fails, which is
 *             why this went undetected for months: GitHub redirects renamed
 *             repos, so a stale entry returns stars and passes availability
 *             checks while the catalog carries a name that no longer exists.
 *   drift   — an ECOSYSTEM.md row with no catalog entry, sub-classified by
 *             resolving it, since a rename is indistinguishable from a stale
 *             row by string comparison alone.
 *
 * Classification rules live in lib/catalog-health.js and are unit-tested.
 */
import fs from "node:fs/promises";
import { githubHeaders } from "../lib/github.js";
import {
  buildRepoQueryBatches,
  findDeadRepos,
  findUnresolvedRepos,
  findRenamedRepos,
  findEcosystemDrift,
  classifyDrift,
  renderIssueBody,
} from "../lib/catalog-health.js";

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

async function graphql(query) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { ...githubHeaders(TOKEN), "Content-Type": "application/json" },
    body: JSON.stringify({ query: `query { ${query} }` }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`GraphQL HTTP ${res.status}: ${body.slice(0, 200)}`);
    process.exit(1);
  }
  const json = await res.json();
  for (const err of json.errors || []) {
    if (err?.type !== "NOT_FOUND") {
      console.warn(`Non-NOT_FOUND GraphQL error: ${JSON.stringify(err).slice(0, 200)}`);
    }
  }
  return { data: json.data || {}, errors: json.errors || [] };
}

const repos = JSON.parse(await fs.readFile("data/repos.json", "utf8"));

// One query per batch, merged. Aliases carry the original catalog index, so
// the merged result reads exactly like a single response.
async function graphqlBatches(queries) {
  const merged = { data: {}, errors: [] };
  for (const query of queries) {
    const result = await graphql(query);
    Object.assign(merged.data, result.data);
    merged.errors.push(...result.errors);
  }
  return merged;
}

const { queries: repoQueries, skipped } = buildRepoQueryBatches(repos, "repo");
for (const s of skipped) {
  console.warn(
    `Skipping entry ${s.index} with unsafe owner/repo: ` +
    `${JSON.stringify(s.entry.owner)}/${JSON.stringify(s.entry.repo)}`
  );
}
if (repoQueries.length === 0) {
  console.error("No valid repo entries to check; aborting.");
  process.exit(1);
}

const catalogResult = await graphqlBatches(repoQueries);
const dead = findDeadRepos(repos, catalogResult.errors, "repo");
const renamed = findRenamedRepos(repos, catalogResult.data, "repo");
// Anything that came back as neither a repository nor NOT_FOUND was not
// checked. Until 2026-11 these were logged and then counted as healthy.
const unresolved = findUnresolvedRepos(repos, catalogResult.data, catalogResult.errors, "repo");

console.log(
  `Checked ${repos.length - unresolved.length} of ${repos.length} repos: ` +
  `${dead.length} dead, ${renamed.length} renamed, ${unresolved.length} unresolved`
);
for (const r of renamed) console.log(`  renamed: ${r.from} -> ${r.to}`);

// ECOSYSTEM.md drift, resolved rather than assumed. Advising a blanket delete
// here would strip live projects out of llms-full.txt and the RAG corpus
// whenever a repo is renamed.
let drift = null;
try {
  const eco = await fs.readFile("ECOSYSTEM.md", "utf8");
  const driftNames = findEcosystemDrift(eco, repos);
  console.log(`ECOSYSTEM.md: ${driftNames.length} repo rows not in catalog`);

  if (driftNames.length > 0) {
    const entries = driftNames.map((name) => {
      const [owner, repo] = name.split("/");
      return { owner, repo };
    });
    const { queries: ecoQueries } = buildRepoQueryBatches(entries, "eco");
    const ecoResult = await graphqlBatches(ecoQueries);
    drift = classifyDrift(driftNames, ecoResult, repos);
    console.log(
      `  drift breakdown: ${drift.renamed.length} renamed, ` +
      `${drift.dead.length} dead, ${drift.missing.length} not catalogued`
    );
  } else {
    drift = { renamed: [], dead: [], missing: [] };
  }
} catch (e) {
  console.warn(`Could not read ECOSYSTEM.md for drift check: ${e.message}`);
}

// Write the body before failing: the workflow's issue step runs with
// `if: always()` and treats a missing/empty file as "catalog healthy".
await fs.writeFile("dead-repos.md", renderIssueBody({ dead, renamed, drift, unresolved }));

if (unresolved.length > 0) {
  console.error(
    `Catalog health sweep incomplete: ${unresolved.length} entries could not be checked ` +
    `(first: ${unresolved.slice(0, 5).join(", ")}). Failing so this is not read as healthy.`
  );
  process.exit(1);
}
