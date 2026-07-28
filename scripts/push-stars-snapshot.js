#!/usr/bin/env node
import { readFile, writeFile } from "fs/promises";
import { fileURLToPath } from "url";
import { resolve } from "path";
import { fetchGitHubStars } from "../lib/github-stars.js";

// The workflow reads this file to name the offending repos in its alert issue.
// Without it the alert can only say "something failed", which cost ~26h and a
// manual investigation when ndesv21/socialclaw was deleted (PR #662).
export const UNAVAILABLE_REPORT_PATH = "stars-unavailable.md";

/**
 * Render the catalog entries GitHub could not resolve as an actionable issue
 * body. The snapshot still publishes when this happens — these entries are a
 * data problem in `data/repos.json`, not a fault in the refresh itself.
 */
export function formatUnavailableReport(unavailable) {
  const rows = unavailable
    .map((item) => {
      const key = `${item.owner}/${item.repo}`;
      const reason = item.reason ? ` — ${item.reason}` : "";
      return `- \`${key}\` — https://github.com/${key}${reason}`;
    })
    .join("\n");

  return (
    `## Unavailable catalog repositories (${unavailable.length})\n\n` +
    `${rows}\n\n` +
    `These entries in \`data/repos.json\` no longer resolve on GitHub — deleted, ` +
    `renamed, or made private. The snapshot still published; it is flagged ` +
    `\`complete: false\` so a partial catalog cannot pass as healthy.\n\n` +
    `**This blocks every 6-hourly stars refresh and the post-deploy smoke test ` +
    `(which seeds stars through the same script) until the entry is removed.**\n\n` +
    `### Fix\n\n` +
    `1. Confirm with \`gh api repos/OWNER/REPO\` (check the owner account too — ` +
    `it may be gone as well), and search for a rename target before removing.\n` +
    `2. Remove the entry from \`data/repos.json\` **and** its \`data/summaries.json\` ` +
    `record, then rebuild — \`build-pages.js\` prunes the orphan project page and ` +
    `homepage row on its own.\n` +
    `3. After merging, run \`gh workflow run "Refresh GitHub Stars" --ref main\` and ` +
    `confirm \`/api/stars\` reports \`complete: true\`. The live snapshot stays ` +
    `degraded until a refresh republishes it.\n\n` +
    `See PR #662 (ndesv21/socialclaw) and PR #148 (Web3CZ) for prior removals.\n`
  );
}

export async function pushStarsSnapshot({
  githubToken,
  cronSecret,
  endpoint = "https://hermesatlas.com/api/stars?cron=1",
  fetchImpl = fetch,
  repoList,
} = {}) {
  if (!githubToken) throw new Error("GITHUB_TOKEN is required");
  if (!cronSecret) throw new Error("CRON_SECRET is required");
  const repos = repoList || JSON.parse(await readFile(new URL("../data/repos.json", import.meta.url), "utf8"));
  const snapshot = await fetchGitHubStars({ repoList: repos, token: githubToken, fetchImpl });
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cronSecret}`,
      "Content-Type": "application/json",
      "User-Agent": "hermes-atlas-stars-workflow",
    },
    body: JSON.stringify(snapshot),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Snapshot ingestion failed: HTTP ${response.status} ${detail}`.trim());
  }
  const result = await response.json();
  if (result.stale || result.source !== "github-actions") {
    throw new Error("Snapshot ingestion returned a degraded response");
  }
  if (result.complete === false) {
    const unavailable = result.unavailableRepos || [];
    const names = unavailable.map((item) => `${item.owner}/${item.repo}`).join(", ");
    const error = new Error(`Snapshot published with unavailable catalog repositories: ${names}`);
    // Carried so the CLI can write a named, actionable alert body. The throw
    // itself is unchanged: a partial catalog must still fail the workflow.
    error.unavailableRepos = unavailable;
    throw error;
  }
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  pushStarsSnapshot({
    githubToken: process.env.GITHUB_TOKEN,
    cronSecret: process.env.CRON_SECRET,
    endpoint: process.env.STARS_ENDPOINT,
  })
    .then((result) => {
      console.log(
        `Published ${result.totals.count} repos (${result.totals.stars} stars) at ${result.fetchedAt}`,
      );
    })
    .catch(async (error) => {
      console.error(error.message);
      if (error.unavailableRepos?.length) {
        await writeFile(UNAVAILABLE_REPORT_PATH, formatUnavailableReport(error.unavailableRepos));
      }
      process.exitCode = 1;
    });
}
