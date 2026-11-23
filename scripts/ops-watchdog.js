#!/usr/bin/env node
/**
 * Ops watchdog (run by .github/workflows/ops-watchdog.yml every 3h).
 * Checks every scheduled workflow in lib/ops-watchdog.js, opens/labels an
 * alert issue when one is red or has stopped running, escalates to a human
 * after 24h, and closes the issue on recovery.
 *
 * Env: GITHUB_TOKEN, GITHUB_REPOSITORY (owner/repo), OPS_ESCALATE_TO
 * (default ksimback), DRY_RUN=1 to print the plan without writing.
 */
import { githubHeaders } from "../lib/github.js";
import { WATCHED, LABELS, assessWorkflow, planActions } from "../lib/ops-watchdog.js";

const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY || "ksimback/hermes-ecosystem";
const escalateTo = process.env.OPS_ESCALATE_TO || "ksimback";
const dryRun = process.env.DRY_RUN === "1";
if (!token) {
  console.error("GITHUB_TOKEN is required");
  process.exit(1);
}
const headers = { ...githubHeaders(token), "Content-Type": "application/json" };

async function gh(method, path, body) {
  const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok && !(method === "POST" && path === "/labels" && res.status === 422)) {
    throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`);
  }
  return res.status === 204 ? null : res.json();
}

const now = new Date();
const assessments = {};
for (const entry of WATCHED) {
  try {
    const data = await gh("GET", `/actions/workflows/${entry.file}/runs?branch=main&per_page=30`);
    assessments[entry.file] = assessWorkflow(entry, data.workflow_runs || [], now);
  } catch (err) {
    if (!/-> 404 /.test(err.message)) throw err;
    // Renamed or deleted on main: never treat as "no runs, fine".
    assessments[entry.file] = { healthy: false, reason: "workflow file not found on main (renamed or deleted?)", latestUrl: null };
  }
  console.log(`${assessments[entry.file].healthy ? "OK  " : "RED "} ${entry.file}: ${assessments[entry.file].reason}`);
}

const openIssues = await gh("GET", `/issues?state=open&labels=${LABELS.alert}&per_page=100`);
const actions = planActions({ assessments, openIssues, now, escalateTo });
console.log(`\n${actions.length} action(s)${dryRun ? " (dry run)" : ""}`);
for (const a of actions) console.log(`  ${a.type} ${a.file}${a.number ? ` #${a.number}` : ""}`);
if (dryRun || actions.length === 0) process.exit(0);

for (const name of Object.values(LABELS)) await gh("POST", "/labels", { name, color: name === LABELS.escalated ? "b60205" : "fbca04" });

for (const a of actions) {
  if (a.type === "open") {
    await gh("POST", "/issues", { title: a.title, body: a.body, labels: [LABELS.alert, LABELS.queue] });
  } else if (a.type === "label") {
    await gh("POST", `/issues/${a.number}/labels`, { labels: a.labels });
  } else if (a.type === "escalate") {
    await gh("POST", `/issues/${a.number}/labels`, { labels: [LABELS.escalated, LABELS.queue] });
    await gh("POST", `/issues/${a.number}/assignees`, { assignees: [a.assignee] });
    await gh("POST", `/issues/${a.number}/comments`, { body: a.body });
  } else if (a.type === "close") {
    await gh("POST", `/issues/${a.number}/comments`, { body: a.body });
    await gh("PATCH", `/issues/${a.number}`, { state: "closed" });
  }
}
