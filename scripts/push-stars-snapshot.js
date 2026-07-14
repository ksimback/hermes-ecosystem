#!/usr/bin/env node
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import { resolve } from "path";
import { fetchGitHubStars } from "../lib/github-stars.js";

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
    const repos = (result.unavailableRepos || [])
      .map((item) => `${item.owner}/${item.repo}`)
      .join(", ");
    throw new Error(`Snapshot published with unavailable catalog repositories: ${repos}`);
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
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
