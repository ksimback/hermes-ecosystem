/**
 * Catalog health classification for data/repos.json and ECOSYSTEM.md.
 *
 * Pure functions over an already-fetched GitHub GraphQL response, so the
 * classification rules are testable without network access. The I/O and
 * orchestration live in scripts/check-dead-repos.js.
 *
 * The distinction that matters here is dead vs renamed. GitHub resolves a
 * renamed repository when queried by its OLD owner/name and returns the
 * CURRENT nameWithOwner, so a stale catalog entry answers 200, returns star
 * counts, and passes every availability check. Nothing fails; the catalog
 * just carries a name that no longer exists. Only NOT_FOUND means dead.
 */

// owner/repo are validated to this charset by validate-repos-json.js. Re-check
// here so a malformed entry can never inject into the GraphQL document.
const SAFE_NAME_RE = /^[A-Za-z0-9_.-]+$/;

export function isSafeName(name) {
  return SAFE_NAME_RE.test(name ?? "");
}

/**
 * Build an aliased GraphQL selection set for the given entries.
 *
 * Aliases keep the ORIGINAL array index (`${prefix}${i}`) even when entries are
 * skipped, so callers can map a response alias or error path back to the entry
 * that produced it.
 */
export function buildRepoQuery(entries, prefix = "repo") {
  const { queries, skipped } = buildRepoQueryBatches(entries, prefix, Infinity);
  return { query: queries[0] || "", skipped };
}

/**
 * Same selection set, split into several queries of at most `batchSize`
 * repositories. GitHub answers an oversized query with partial data plus
 * RESOURCE_LIMITS_EXCEEDED errors for the rest, so one query for the whole
 * catalog stopped covering entries past ~230 once the catalog grew. Aliases
 * still carry the ORIGINAL index, so batch results merge with Object.assign.
 */
export const REPO_QUERY_BATCH_SIZE = 100;

export function buildRepoQueryBatches(entries, prefix = "repo", batchSize = REPO_QUERY_BATCH_SIZE) {
  const skipped = [];
  const fields = [];
  for (const [i, entry] of entries.entries()) {
    if (!isSafeName(entry.owner) || !isSafeName(entry.repo)) {
      skipped.push({ index: i, entry });
      continue;
    }
    fields.push(`${prefix}${i}: repository(owner: "${entry.owner}", name: "${entry.repo}") { nameWithOwner }`);
  }
  const queries = [];
  for (let start = 0; start < fields.length; start += batchSize) {
    queries.push(fields.slice(start, start + batchSize).join("\n"));
  }
  return { queries, skipped };
}

/**
 * Entries the sweep learned nothing about: no resolved node and no NOT_FOUND
 * error. That is a failed check (rate limit, resource limit, partial outage),
 * not a healthy repo, and must never be reported as one.
 */
export function findUnresolvedRepos(entries, data = {}, errors = [], prefix = "repo") {
  const notFound = new Set(
    errors
      .filter((e) => e?.type === "NOT_FOUND")
      .map((e) => indexFromAlias(e.path?.[0], prefix))
      .filter((i) => i !== null)
  );
  const unresolved = [];
  for (const [i, entry] of entries.entries()) {
    if (data?.[`${prefix}${i}`]?.nameWithOwner || notFound.has(i)) continue;
    unresolved.push(`${entry.owner}/${entry.repo}`);
  }
  return unresolved;
}

function indexFromAlias(alias, prefix) {
  if (typeof alias !== "string" || !alias.startsWith(prefix)) return null;
  const idx = Number.parseInt(alias.slice(prefix.length), 10);
  return Number.isInteger(idx) ? idx : null;
}

/**
 * Entries GitHub reported as NOT_FOUND — deleted, made private, or the owner
 * account is gone. These are the entries that break the stars snapshot.
 */
export function findDeadRepos(entries, errors = [], prefix = "repo") {
  const dead = [];
  for (const err of errors) {
    if (err?.type !== "NOT_FOUND") continue;
    const idx = indexFromAlias(err.path?.[0], prefix);
    if (idx === null) continue;
    const entry = entries[idx];
    if (!entry) continue;
    dead.push({
      owner: entry.owner,
      repo: entry.repo,
      url: entry.url || `https://github.com/${entry.owner}/${entry.repo}`,
    });
  }
  return dead;
}

/**
 * Entries that resolve to a different nameWithOwner than the catalog records.
 * Compared case-insensitively: GitHub preserves owner/repo casing, and a
 * case-only difference is not a rename.
 */
export function findRenamedRepos(entries, data = {}, prefix = "repo") {
  const renamed = [];
  for (const [i, entry] of entries.entries()) {
    const current = data?.[`${prefix}${i}`]?.nameWithOwner;
    if (!current) continue;
    const recorded = `${entry.owner}/${entry.repo}`;
    if (current.toLowerCase() !== recorded.toLowerCase()) {
      renamed.push({ from: recorded, to: current });
    }
  }
  return renamed;
}

/**
 * Repo links present in ECOSYSTEM.md but absent from the catalog.
 *
 * ECOSYSTEM.md is bundled into llms-full.txt and the RAG chunks, so a row left
 * behind after a catalog change quietly pollutes LLM retrieval. Upstream
 * hermes-agent links are expected and never drift.
 */
export function findEcosystemDrift(ecoText, repos) {
  const inCatalog = new Set(repos.map((r) => `${r.owner}/${r.repo}`.toLowerCase()));
  const linked = [
    ...new Set(
      [...ecoText.matchAll(/github\.com\/([\w.-]+\/[\w.-]+)/g)].map((m) =>
        m[1].replace(/\.git$/, "").toLowerCase()
      )
    ),
  ];
  return linked.filter(
    (k) => !inCatalog.has(k) && !k.startsWith("nousresearch/hermes-agent")
  );
}

/**
 * Split drifted ECOSYSTEM.md rows into the three cases that need different
 * fixes. Treating them all as "stale rows to delete" removes live projects
 * from the LLM corpus, which is what a renamed row looks like.
 *
 *   renamed — resolves to a name that IS catalogued: rewrite the row
 *   dead    — NOT_FOUND on GitHub: delete the row
 *   missing — resolves, but nothing in the catalog matches: re-add or delete
 */
export function classifyDrift(driftNames, { data = {}, errors = [] } = {}, repos = []) {
  const inCatalog = new Set(repos.map((r) => `${r.owner}/${r.repo}`.toLowerCase()));
  const deadIndexes = new Set(
    errors
      .filter((e) => e?.type === "NOT_FOUND")
      .map((e) => indexFromAlias(e.path?.[0], "eco"))
      .filter((i) => i !== null)
  );

  const renamed = [];
  const dead = [];
  const missing = [];

  for (const [i, name] of driftNames.entries()) {
    if (deadIndexes.has(i)) {
      dead.push(name);
      continue;
    }
    const current = data?.[`eco${i}`]?.nameWithOwner;
    if (!current) {
      // No node and no NOT_FOUND: the query never resolved this row (unsafe
      // name, or a non-NOT_FOUND error). Report it rather than dropping it.
      missing.push({ name, current: null });
      continue;
    }
    if (inCatalog.has(current.toLowerCase())) renamed.push({ name, current });
    else missing.push({ name, current });
  }

  return { renamed, dead, missing };
}

export function renderIssueBody({ dead = [], renamed = [], drift = null, unresolved = [] } = {}) {
  const d = drift || { renamed: [], dead: [], missing: [] };
  let body = "";

  if (unresolved.length > 0) {
    body +=
      `## Sweep incomplete: ${unresolved.length} entr${unresolved.length === 1 ? "y" : "ies"} could not be checked\n\n` +
      `GitHub returned neither a repository nor NOT_FOUND for these entries (rate limit, resource ` +
      `limit, or a partial outage). **They are unverified, not healthy**, and the lists below may be ` +
      `incomplete. The audit run failed on purpose; re-run it, and if this repeats, look at the ` +
      `GraphQL errors in the run log.\n\n`;
    for (const name of unresolved.slice(0, 50)) body += `- \`${name}\`\n`;
    if (unresolved.length > 50) body += `- …and ${unresolved.length - 50} more\n`;
    body += `\n`;
  }

  if (dead.length > 0) {
    body +=
      `The following ${dead.length} repo${dead.length === 1 ? "" : "s"} in \`data/repos.json\` no longer resolve on GitHub. ` +
      `They were deleted, made private, or the owner account is gone.\n\n` +
      `**Why this matters**: a dead entry makes \`push-stars-snapshot.js\` publish an incomplete ` +
      `snapshot and exit 1, which fails both Refresh GitHub Stars (6-hourly) and the Post-Deploy ` +
      `Smoke Test. It also leaves stale external links and generated project pages.\n\n` +
      `## Dead entries\n\n`;
    for (const x of dead) body += `- \`${x.owner}/${x.repo}\` — ${x.url}\n`;
    body +=
      `\n**Fix**: remove each entry from \`data/repos.json\`, re-run the regen pipeline, and merge. ` +
      `See PR #675 (Rainhoole removal) and #662 (ndesv21/socialclaw) for prior examples.\n\n`;
  }

  if (renamed.length > 0) {
    body +=
      `## Renamed entries (${renamed.length})\n\n` +
      `These entries still resolve, so nothing fails — GitHub redirects a renamed repo and returns ` +
      `its current name. The catalog is simply carrying a name that no longer exists, which means ` +
      `stale slugs, duplicate risk on the next discovery run, and a project page that disagrees ` +
      `with the project's real identity.\n\n`;
    for (const x of renamed) body += `- \`${x.from}\` → \`${x.to}\`\n`;
    body +=
      `\n**Fix**: update \`owner\`/\`repo\`/\`url\` in \`data/repos.json\`, move the matching ` +
      `\`data/summaries.json\` key with the entry (\`readmeHash\` caching depends on it), rename the ` +
      `\`data/list-summaries.json\` key and any \`data/use-cases.json\` pick, update the ` +
      `\`ECOSYSTEM.md\` row, and add a \`{source, destination, permanent: true}\` entry to ` +
      `\`vercel.json\` redirects for the old \`/projects/{owner}/{repo}\` path. See PR #665.\n\n`;
  }

  const driftTotal = d.renamed.length + d.dead.length + d.missing.length;
  if (driftTotal > 0) {
    body +=
      `## ECOSYSTEM.md drift (${driftTotal})\n\n` +
      `These rows are linked in \`ECOSYSTEM.md\` but not in \`data/repos.json\`. ` +
      `\`ECOSYSTEM.md\` is bundled into \`llms-full.txt\` and the RAG chunks, so stale rows ` +
      `pollute LLM retrieval.\n\n` +
      `**Each row is resolved against GitHub below — do not blanket-delete them.** ` +
      `A renamed repo looks identical to a stale row, and deleting it removes a live project ` +
      `from the LLM corpus.\n\n`;

    if (d.renamed.length > 0) {
      body += `### Renamed — rewrite the row (do NOT delete)\n\n`;
      for (const x of d.renamed) body += `- \`${x.name}\` → \`${x.current}\` (already in the catalog)\n`;
      body += `\n`;
    }
    if (d.dead.length > 0) {
      body += `### Dead — delete the row\n\n`;
      for (const name of d.dead) body += `- \`${name}\`\n`;
      body += `\n`;
    }
    if (d.missing.length > 0) {
      body += `### Not in the catalog — re-add the repo, or delete the row\n\n`;
      for (const x of d.missing) {
        body += x.current
          ? `- \`${x.name}\` — resolves to \`${x.current}\`, which is not catalogued\n`
          : `- \`${x.name}\` — could not be resolved; check manually\n`;
      }
      body += `\n`;
    }
  }

  if (body) {
    body +=
      `_Auto-detected by \`scripts/check-dead-repos.js\` via \`audit-summaries.yml\`. ` +
      `This issue updates in place; it auto-closes when the lists go empty._\n`;
  }

  return body;
}
