#!/usr/bin/env node
/**
 * Merge policy (run by .github/workflows/merge-policy.yml; tiers in
 * lib/merge-tiers.js). For each open PR against main: classify it, keep its
 * tier label current, hand human-tier PRs to Kevin once, and merge auto/review
 * PRs whose checks (and, for review tier, the Claude review) are green.
 *
 *   node scripts/merge-policy.js              all open PRs
 *   node scripts/merge-policy.js --classify N print PR N's tier (and write
 *                                             `tier=` to $GITHUB_OUTPUT)
 *
 * Env: GITHUB_TOKEN (read, labels, comments), MERGE_TOKEN (Hermes Atlas Bot
 * app token; merges), GITHUB_REPOSITORY, TRUSTED_PR_AUTHORS (comma list),
 * OPS_ESCALATE_TO (default ksimback), DRY_RUN=1 to print without writing.
 */
import fs from "node:fs";
import { githubHeaders } from "../lib/github.js";
import { LABELS, TIERS, catalogDeletions, classifyPr, mergeCommit, mergeReadiness } from "../lib/merge-tiers.js";

const token = process.env.GITHUB_TOKEN;
const mergeToken = process.env.MERGE_TOKEN;
const repo = process.env.GITHUB_REPOSITORY || "ksimback/hermes-ecosystem";
const escalateTo = process.env.OPS_ESCALATE_TO || "ksimback";
const trustedAuthors = (process.env.TRUSTED_PR_AUTHORS || "ksimback").split(",").map((s) => s.trim()).filter(Boolean);
const dryRun = process.env.DRY_RUN === "1";
if (!token) {
  console.error("GITHUB_TOKEN is required");
  process.exit(1);
}

async function gh(method, path, body, { auth = token, raw = false, allow = [] } = {}) {
  const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    method,
    headers: {
      ...githubHeaders(auth),
      "Content-Type": "application/json",
      ...(raw ? { Accept: "application/vnd.github.raw+json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (allow.includes(res.status)) return null;
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`);
  if (res.status === 204) return null;
  return raw ? res.text() : res.json();
}

async function listFiles(number) {
  const files = [];
  for (let page = 1; page <= 4; page++) {
    const batch = await gh("GET", `/pulls/${number}/files?per_page=100&page=${page}`);
    files.push(...batch);
    if (batch.length < 100) break;
  }
  return files;
}

async function reposAt(ref) {
  const text = await gh("GET", `/contents/data/repos.json?ref=${ref}`, null, { raw: true, allow: [404] });
  return text == null ? null : JSON.parse(text);
}

async function classify(pr) {
  const files = await listFiles(pr.number);
  let deletions = [];
  if (files.some((f) => f.filename === "data/repos.json")) {
    // Compare against the merge base, not current main: entries added to main
    // after the branch was cut are not deletions.
    const { merge_base_commit } = await gh("GET", `/compare/${pr.base.sha}...${pr.head.sha}`);
    deletions = catalogDeletions(await reposAt(merge_base_commit.sha), await reposAt(pr.head.sha));
  }
  return classifyPr({
    files,
    author: pr.user.login,
    isFork: pr.head.repo?.full_name !== repo,
    trustedAuthors,
    deletions,
  });
}

// Intake and release-notes PRs merge themselves (validate-repo-suggestion.yml,
// release-monitor.yml); recover-open-prs picks up any that stall.
const isSelfMergingBot = (pr) => pr.user.login === "github-actions[bot]";

if (process.argv[2] === "--classify") {
  const pr = await gh("GET", `/pulls/${Number(process.argv[3])}`);
  const { tier, reasons } = isSelfMergingBot(pr) ? { tier: "bot", reasons: [] } : await classify(pr);
  console.log(`#${pr.number}: ${tier}${reasons.length ? ` (${reasons.join("; ")})` : ""}`);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `tier=${tier}\n`);
  process.exit(0);
}

if (!dryRun) {
  for (const [key, name] of Object.entries(LABELS)) {
    const color = key === "needsKevin" || key === "hold" ? "b60205" : "c5def5";
    await gh("POST", "/labels", { name, color }, { allow: [422] });
  }
}

const write = async (fn) => (dryRun ? null : fn());
const tierLabel = { [TIERS.auto]: LABELS.auto, [TIERS.review]: LABELS.review, [TIERS.human]: LABELS.human };
const summary = [];
let failures = 0;

const open = await gh("GET", `/pulls?state=open&base=main&per_page=100`);
for (const listed of open) {
  if (isSelfMergingBot(listed)) continue;
  try {
    const pr = await gh("GET", `/pulls/${listed.number}`);
    const { tier, reasons } = await classify(pr);
    const has = new Set(pr.labels.map((l) => l.name));

    for (const stale of Object.values(tierLabel).filter((l) => l !== tierLabel[tier] && has.has(l))) {
      await write(() => gh("DELETE", `/issues/${pr.number}/labels/${encodeURIComponent(stale)}`, null, { allow: [404] }));
    }
    if (!has.has(tierLabel[tier])) await write(() => gh("POST", `/issues/${pr.number}/labels`, { labels: [tierLabel[tier]] }));

    if (tier === TIERS.human && !has.has(LABELS.needsKevin)) {
      await write(async () => {
        await gh("POST", `/issues/${pr.number}/labels`, { labels: [LABELS.needsKevin] });
        await gh("POST", `/issues/${pr.number}/assignees`, { assignees: [escalateTo] });
        await gh("POST", `/issues/${pr.number}/comments`, {
          body: `**Merge policy: needs @${escalateTo}.** This PR is never merged automatically because it touches:\n\n${reasons.map((r) => `- ${r}`).join("\n")}\n\nMerge it by hand when it's ready.`,
        });
      });
    } else if (tier !== TIERS.human && has.has(LABELS.needsKevin)) {
      await write(() => gh("DELETE", `/issues/${pr.number}/labels/${LABELS.needsKevin}`, null, { allow: [404] }));
    }

    const [{ check_runs }, { statuses }] = await Promise.all([
      gh("GET", `/commits/${pr.head.sha}/check-runs?per_page=100`),
      gh("GET", `/commits/${pr.head.sha}/status`),
    ]);
    const verdict = mergeReadiness({ pr, tier, checkRuns: check_runs, statuses });
    let outcome = `${verdict.state}: ${verdict.reason}`;

    if (verdict.ready) {
      if (!mergeToken) throw new Error("MERGE_TOKEN is required to merge");
      if (dryRun) outcome = "ready (dry run, not merged)";
      else {
        // `sha` makes GitHub refuse the merge if a commit landed after we checked.
        await gh("PUT", `/pulls/${pr.number}/merge`, { sha: pr.head.sha, merge_method: "squash", ...mergeCommit(pr, tier) }, { auth: mergeToken });
        outcome = "merged";
      }
    }
    summary.push(`| #${pr.number} | ${tier} | ${outcome}${reasons.length ? ` (${reasons.join("; ")})` : ""} |`);
    console.log(`#${pr.number} [${tier}] ${outcome}`);
  } catch (err) {
    failures++;
    summary.push(`| #${listed.number} | ? | error: ${err.message.slice(0, 200)} |`);
    console.error(`#${listed.number}: ${err.message}`);
  }
}

if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `| PR | Tier | Outcome |\n|---|---|---|\n${summary.join("\n")}\n`);
}
// One bad PR must not stop the others, but the run still goes red so the
// watchdog sees it.
if (failures) process.exit(1);
