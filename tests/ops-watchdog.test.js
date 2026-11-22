import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { WATCHED, LABELS, assessWorkflow, planActions, titleFor } from "../lib/ops-watchdog.js";

const H = 3600 * 1000;
const now = new Date("2026-11-22T12:00:00Z");
const ago = (h) => new Date(now - h * H).toISOString();
const run = (conclusion, hoursAgo, event = "schedule") => ({
  status: "completed",
  conclusion,
  event,
  created_at: ago(hoursAgo),
  html_url: `https://example.invalid/run/${hoursAgo}`,
});
const daily = { file: "build-pages.yml", maxGapHours: 36, title: "[Workflow] build-pages failed" };

test("every scheduled workflow is watched (a new cron job cannot go unmonitored)", () => {
  const dir = ".github/workflows";
  const scheduled = fs
    .readdirSync(dir)
    .filter((f) => /^\s*schedule:\s*$/m.test(fs.readFileSync(`${dir}/${f}`, "utf-8")));
  const watched = new Set(WATCHED.map((w) => w.file));
  for (const file of scheduled) assert.ok(watched.has(file), `${file} has a schedule but is missing from WATCHED in lib/ops-watchdog.js`);
  for (const file of watched) assert.ok(fs.existsSync(`${dir}/${file}`), `WATCHED lists ${file}, which does not exist`);
});

test("watchdog titles match the issues the workflows' own failure steps open", () => {
  for (const entry of WATCHED.filter((w) => w.title)) {
    const src = fs.readFileSync(`.github/workflows/${entry.file}`, "utf-8");
    const stem = entry.title.match(/^\[Workflow\] (.+) failed$/)?.[1];
    assert.ok(src.includes(entry.title) || (stem && src.includes(`const wf = '${stem}'`)), `${entry.file} does not open "${entry.title}"`);
  }
});

test("latest failed run is unhealthy; cancelled runs are ignored", () => {
  assert.equal(assessWorkflow(daily, [run("failure", 1), run("success", 25)], now).healthy, false);
  assert.equal(assessWorkflow(daily, [run("cancelled", 1), run("success", 2)], now).healthy, true);
});

test("a workflow that stops running goes red once past its gap", () => {
  assert.equal(assessWorkflow(daily, [run("success", 30)], now).healthy, true);
  const stale = assessWorkflow(daily, [run("success", 40)], now);
  assert.equal(stale.healthy, false);
  assert.match(stale.reason, /stopped running/);
});

test("event filter ignores issue-triggered runs", () => {
  const entry = { file: "validate-repo-suggestion.yml", maxGapHours: 36, events: ["schedule"] };
  assert.equal(assessWorkflow(entry, [run("failure", 1, "issues"), run("success", 5)], now).healthy, true);
});

test("no runs yet is not an alarm", () => {
  assert.equal(assessWorkflow(daily, [], now).healthy, true);
});

const red = { [daily.file]: { healthy: false, reason: "latest run failure", latestUrl: "u" } };
const issue = (hoursOld, labels = [LABELS.alert]) => ({
  number: 7,
  title: titleFor(daily),
  created_at: ago(hoursOld),
  labels: labels.map((name) => ({ name })),
});

test("red with no issue opens one in the ops queue", () => {
  const [a] = planActions({ watched: [daily], assessments: red, openIssues: [], now, escalateTo: "kev" });
  assert.equal(a.type, "open");
  assert.equal(a.title, "[Workflow] build-pages failed");
});

test("red issue under 24h gets the ops label but no escalation", () => {
  const actions = planActions({ watched: [daily], assessments: red, openIssues: [issue(3)], now, escalateTo: "kev" });
  assert.deepEqual(actions.map((a) => a.type), ["label"]);
});

test("red for 24h+ escalates exactly once", () => {
  const first = planActions({ watched: [daily], assessments: red, openIssues: [issue(25, [LABELS.alert, LABELS.queue])], now, escalateTo: "kev" });
  assert.deepEqual(first.map((a) => a.type), ["escalate"]);
  assert.equal(first[0].assignee, "kev");
  assert.match(first[0].body, /@kev/);
  const again = planActions({ watched: [daily], assessments: red, openIssues: [issue(30, [LABELS.alert, LABELS.queue, LABELS.escalated])], now, escalateTo: "kev" });
  assert.deepEqual(again, []);
});

test("recovery closes the open issue; healthy with no issue is a no-op", () => {
  const ok = { [daily.file]: { healthy: true } };
  assert.deepEqual(planActions({ watched: [daily], assessments: ok, openIssues: [issue(5)], now, escalateTo: "kev" }).map((a) => a.type), ["close"]);
  assert.deepEqual(planActions({ watched: [daily], assessments: ok, openIssues: [], now, escalateTo: "kev" }), []);
});
