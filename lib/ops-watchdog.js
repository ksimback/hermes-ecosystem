// Ops watchdog: one place that decides whether each scheduled workflow is
// healthy, so a red or silently stopped job can't go unnoticed for a week
// again. Before this, build-pages was red from 2026-11-15 to 2026-11-22 while
// its alert issue (#1467) collected 22 comments nobody read.
//
// Pure logic lives here (tested in tests/ops-watchdog.test.js). Network I/O is
// in scripts/ops-watchdog.js.

const H = 3600 * 1000;

// GitHub runs scheduled workflows late, often by hours (the 06:30 UTC build
// cron typically starts around 15:00). Thresholds allow one late run plus slack.
export const GAP = { sixHourly: 18, daily: 36, weekly: 8 * 24 };

// Every workflow with a `schedule:` trigger must be listed here; the test suite
// fails if one is missing. `title` matches the issue the workflow's own
// failure step opens (where one exists), so the watchdog updates that issue
// instead of opening a duplicate.
export const WATCHED = [
  { file: "audit-plugins.yml", maxGapHours: GAP.weekly },
  { file: "audit-repos.yml", maxGapHours: GAP.weekly },
  { file: "audit-summaries.yml", maxGapHours: GAP.daily },
  { file: "build-pages.yml", maxGapHours: GAP.daily, title: "[Workflow] build-pages failed" },
  { file: "post-deploy-smoke.yml", maxGapHours: GAP.daily, title: "Smoke test failure on production" },
  { file: "pr-conflict-alarm.yml", maxGapHours: GAP.sixHourly },
  { file: "rebuild-chunks.yml", maxGapHours: GAP.daily, title: "[Workflow] rebuild-chunks failed" },
  { file: "refresh-docs.yml", maxGapHours: GAP.weekly, title: "[Workflow] refresh-docs failed" },
  { file: "refresh-stars.yml", maxGapHours: GAP.sixHourly, title: "[Workflow] GitHub stars refresh failed" },
  { file: "release-monitor.yml", maxGapHours: GAP.sixHourly },
  { file: "rotate-featured.yml", maxGapHours: GAP.weekly, title: "[Workflow] rotate-featured failed" },
  // Issue-triggered runs can fail on a bad submission; only the scheduled
  // sweep says whether the pipeline itself is healthy.
  { file: "validate-repo-suggestion.yml", maxGapHours: GAP.daily, events: ["schedule", "workflow_dispatch"] },
  { file: "weekly-discovery.yml", maxGapHours: GAP.weekly },
  { file: "ops-watchdog.yml", maxGapHours: GAP.sixHourly },
  { file: "merge-policy.yml", maxGapHours: GAP.sixHourly },
];

export const LABELS = { alert: "workflow-issue", queue: "ops", escalated: "escalated" };
export const ESCALATE_AFTER_HOURS = 24;

const FAILED = new Set(["failure", "timed_out", "startup_failure"]);
const HEALTHY = new Set(["success", "skipped", "neutral"]);

export function titleFor(entry) {
  return entry.title || `[Workflow] ${entry.file.replace(/\.ya?ml$/, "")} failed`;
}

/**
 * runs: GitHub workflow runs, newest first ({ conclusion, status, event, created_at, html_url }).
 * Returns { healthy, reason, lastSuccessAt, latestUrl }.
 */
export function assessWorkflow(entry, runs, now) {
  const relevant = runs.filter(
    (r) => r.status === "completed" && r.conclusion !== "cancelled" && (!entry.events || entry.events.includes(r.event))
  );
  const latest = relevant[0];
  const lastSuccess = relevant.find((r) => HEALTHY.has(r.conclusion));
  const lastSuccessAt = lastSuccess ? new Date(lastSuccess.created_at) : null;
  const gapHours = lastSuccessAt ? (now - lastSuccessAt) / H : Infinity;

  // A workflow that has never run here (e.g. just added) is not an alarm.
  if (!latest) return { healthy: true, reason: "no completed runs yet", lastSuccessAt, latestUrl: null };

  if (FAILED.has(latest.conclusion)) {
    return { healthy: false, reason: `latest run ${latest.conclusion}`, lastSuccessAt, latestUrl: latest.html_url };
  }
  if (gapHours > entry.maxGapHours) {
    const since = lastSuccessAt ? lastSuccessAt.toISOString() : "never";
    return {
      healthy: false,
      reason: `no successful run in ${Math.round(gapHours)}h (limit ${entry.maxGapHours}h; last success ${since}). It may have stopped running.`,
      lastSuccessAt,
      latestUrl: latest.html_url,
    };
  }
  return { healthy: true, reason: "ok", lastSuccessAt, latestUrl: latest.html_url };
}

/**
 * Decide what to do. Comments only on state changes (open, escalate, close)
 * so the alert issue stays readable.
 * openIssues: open issues labelled LABELS.alert ({ number, title, created_at, labels: [{name}] }).
 */
export function planActions({ watched = WATCHED, assessments, openIssues, now, escalateTo }) {
  const actions = [];
  for (const entry of watched) {
    const a = assessments[entry.file];
    if (!a) continue;
    const title = titleFor(entry);
    const issue = openIssues.find((i) => i.title === title);
    const labels = new Set((issue?.labels || []).map((l) => (typeof l === "string" ? l : l.name)));

    if (a.healthy) {
      if (issue) actions.push({ type: "close", file: entry.file, number: issue.number, body: `Recovered: \`${entry.file}\` is healthy again (ops watchdog).` });
      continue;
    }

    const detail = `**Workflow:** \`${entry.file}\`\n**Problem:** ${a.reason}\n**Latest run:** ${a.latestUrl || "n/a"}`;
    if (!issue) {
      actions.push({
        type: "open",
        file: entry.file,
        title,
        body: `${detail}\n\nOpened by the ops watchdog. Owner: Simba (label \`${LABELS.queue}\`). Escalates to @${escalateTo} if still open after ${ESCALATE_AFTER_HOURS}h.`,
      });
      continue;
    }
    if (!labels.has(LABELS.queue)) actions.push({ type: "label", file: entry.file, number: issue.number, labels: [LABELS.queue] });
    const ageHours = (now - new Date(issue.created_at)) / H;
    if (ageHours >= ESCALATE_AFTER_HOURS && !labels.has(LABELS.escalated)) {
      actions.push({
        type: "escalate",
        file: entry.file,
        number: issue.number,
        assignee: escalateTo,
        body: `@${escalateTo}: this has been red for ${Math.round(ageHours)}h without a fix.\n\n${detail}`,
      });
    }
  }
  return actions;
}
