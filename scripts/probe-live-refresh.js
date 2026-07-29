#!/usr/bin/env node
/**
 * Probe the serverless live-refresh path so a dead Vercel GITHUB_TOKEN fails
 * loudly instead of silently.
 *
 * Why this exists: nothing exercised that token. push-stars-snapshot.js fetches
 * GitHub with the *Actions* token and POSTs the result, so the 6-hourly refresh
 * passes regardless of what Vercel holds. api/stars.js only reaches for its own
 * GITHUB_TOKEN when the cached snapshot is missing or invalid, and on failure it
 * logs and serves the last-good snapshot with a 200. So an expired token stayed
 * invisible until the cache also went cold — a latent double failure. That is
 * how the previous token sat dead undetected.
 *
 * An authenticated GET with the cron flag bypasses the cache and forces the live
 * path, which returns 503 when the token cannot fetch. Running it right after
 * publication converts that latent failure into a workflow failure, and the
 * existing alert step in refresh-stars.yml opens the issue.
 *
 * Writes stars-probe.md on failure so the alert body names the cause.
 */
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function buildProbeReport({ reason, endpoint }) {
  return (
    `## Live star refresh probe failed\n\n` +
    `An authenticated \`GET ${endpoint}\` did not return a fresh snapshot.\n\n` +
    `**Reason**: ${reason}\n\n` +
    `**What this means**: the serverless function could not fetch star counts ` +
    `using the \`GITHUB_TOKEN\` configured in Vercel. This is a *different* token ` +
    `from the one this workflow uses — \`push-stars-snapshot.js\` fetches GitHub ` +
    `with the Actions token, so publication can keep succeeding while the ` +
    `Vercel token is dead.\n\n` +
    `**Blast radius**: none while the published snapshot stays warm. ` +
    `\`api/stars.js\` serves the cached snapshot and only falls back to a live ` +
    `fetch when that cache is missing or invalid. If the token is still dead ` +
    `then, \`/api/stars\` starts serving \`stale: true\` from last-good, and the ` +
    `smoke test's stars-freshness assertion fails.\n\n` +
    `## Fix\n\n` +
    `1. Check the token: \`vercel env ls\` and confirm \`GITHUB_TOKEN\` exists for production.\n` +
    `2. A classic PAT with **no scopes** is sufficient — the query only reads public ` +
    `\`stargazerCount\`/\`pushedAt\`. Do not grant \`public_repo\`; that adds *write* access.\n` +
    `3. Verify the new token against the real query before saving it, then ` +
    `\`vercel env rm GITHUB_TOKEN production\` / \`vercel env add\` and redeploy.\n` +
    `4. Re-run \`gh workflow run "Refresh GitHub Stars" --ref main\` to confirm recovery.\n\n` +
    `_Auto-detected by \`scripts/probe-live-refresh.js\`._\n`
  );
}

export async function probeLiveRefresh({
  cronSecret,
  endpoint = "https://hermesatlas.com/api/stars?cron=1",
  fetchImpl = fetch,
} = {}) {
  if (!cronSecret) throw new Error("CRON_SECRET is required");

  const response = await fetchImpl(endpoint, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${cronSecret}`,
      "User-Agent": "hermes-atlas-stars-probe",
    },
  });

  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 500);
    throw new Error(`HTTP ${response.status} ${detail}`.trim());
  }

  const result = await response.json();

  // The cron flag bypasses the cache, so a healthy probe must come back from a
  // live fetch. "last-good" here means the live path failed and the handler
  // quietly degraded — precisely the condition this probe exists to catch.
  if (result.source !== "github-api") {
    throw new Error(
      `expected a live snapshot (source "github-api"), got "${result.source}"` +
      (result.degradedReason ? ` — ${result.degradedReason}` : "")
    );
  }
  if (result.stale) throw new Error("live snapshot reported stale");
  if (result.complete === false) {
    // Dead catalog entries are push-stars-snapshot.js's alert to raise; this
    // probe is about token health, so don't duplicate that diagnosis.
    const names = (result.unavailableRepos || [])
      .map((item) => `${item.owner}/${item.repo}`)
      .join(", ");
    throw new Error(`live snapshot incomplete — unavailable: ${names || "unknown"}`);
  }

  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const endpoint =
    process.env.STARS_ENDPOINT || "https://hermesatlas.com/api/stars?cron=1";
  try {
    const result = await probeLiveRefresh({
      cronSecret: process.env.CRON_SECRET,
      endpoint,
    });
    console.log(
      `Live refresh probe OK: ${result.totals?.count ?? "?"} repos from ${result.source} at ${result.fetchedAt}`
    );
  } catch (error) {
    console.error(`Live refresh probe failed: ${error.message}`);
    await writeFile("stars-probe.md", buildProbeReport({ reason: error.message, endpoint }));
    process.exit(1);
  }
}
