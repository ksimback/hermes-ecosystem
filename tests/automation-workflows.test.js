import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const workflowFiles = [
  ".github/workflows/build-pages.yml",
  ".github/workflows/rebuild-chunks.yml",
  ".github/workflows/refresh-docs.yml",
  ".github/workflows/audit-summaries.yml",
  ".github/workflows/rotate-featured.yml",
];

test("main-writing workflows have independent concurrency queues", () => {
  const groups = workflowFiles.map((file) => {
    const workflow = fs.readFileSync(file, "utf-8");
    const group = workflow.match(/concurrency:\s*\n\s*group:\s*([^\n]+)/)?.[1]?.trim();
    assert.ok(group, `${file} has a concurrency group`);
    assert.doesNotMatch(group, /main-bot-push/, `${file} must not use the shared eviction-prone queue`);
    return group;
  });

  assert.equal(new Set(groups).size, groups.length, "every main-writing workflow has its own queue");
});

test("knowledge rebuild has a scheduled reconciliation path", () => {
  const workflow = fs.readFileSync(".github/workflows/rebuild-chunks.yml", "utf-8");
  assert.match(workflow, /schedule:[\s\S]{0,300}- cron: '20 6 \* \* \*'/);
  assert.match(workflow, /workflow_dispatch:/);
});

test("page build regenerates from latest main after a rejected push", () => {
  const workflow = fs.readFileSync(".github/workflows/build-pages.yml", "utf-8");
  assert.match(workflow, /Push rejected \(attempt \$attempt\).*regenerating from latest main/);
  assert.match(workflow, /git reset --hard origin\/main/);
  assert.match(workflow, /git clean -fd/);
  assert.match(workflow, /node scripts\/generate-summaries\.js/);
  assert.match(workflow, /node scripts\/build-pages\.js/);
  assert.match(workflow, /node scripts\/stage-build-artifacts\.js/);
  assert.doesNotMatch(workflow, /git pull --rebase origin main/);
});

test("bot-authored page builds dispatch smoke for the exact deployed commit", () => {
  const build = fs.readFileSync(".github/workflows/build-pages.yml", "utf-8");
  const smoke = fs.readFileSync(".github/workflows/post-deploy-smoke.yml", "utf-8");

  assert.match(build, /actions: write/);
  assert.match(build, /Dispatch post-deploy smoke/);
  assert.match(build, /-f target_sha="\$\(git rev-parse HEAD\)"/);
  assert.match(smoke, /target_sha:/);
  assert.match(smoke, /process\.env\.TARGET_SHA \|\| context\.sha/);
  assert.match(smoke, /github\.event_name == 'push' \|\| inputs\.target_sha != ''/);
});

test("docs mirror explicitly dispatches RAG ingestion after bot-authored pushes", () => {
  const workflow = fs.readFileSync(".github/workflows/refresh-docs.yml", "utf-8");
  assert.match(workflow, /actions: write/);
  assert.match(workflow, /Dispatch knowledge-base rebuild/);
  assert.match(workflow, /gh workflow run rebuild-chunks\.yml --ref main/);
  assert.match(workflow, /if: steps\.diff\.outputs\.changed == 'true'/);
});

test("daily monitor dispatches docs ingestion independently and resolves its notification", () => {
  const monitor = fs.readFileSync(".github/workflows/release-monitor.yml", "utf-8");
  const refresh = fs.readFileSync(".github/workflows/refresh-docs.yml", "utf-8");

  assert.match(monitor, /Dispatch docs mirror refresh/);
  assert.match(monitor, /gh workflow run refresh-docs\.yml --ref main/);
  assert.ok(
    monitor.indexOf("Dispatch docs mirror refresh") < monitor.indexOf("Check for new official docs changes"),
    "docs ingestion must not wait on release-independent API checks",
  );
  assert.match(monitor, /id: releases\s+continue-on-error: true/);
  assert.match(monitor, /Preserve release synchronization failure/);
  assert.match(monitor, /if: steps\.releases\.outcome == 'failure'/);
  assert.match(refresh, /Close processed docs-update notifications/);
  assert.match(refresh, /--label docs-update/);
  assert.match(refresh, /Official docs mirror is current after workflow run/);
});

test("release monitor retries transient GitHub API failures", () => {
  const monitor = fs.readFileSync(".github/workflows/release-monitor.yml", "utf-8");
  const githubScriptSteps = monitor.match(/uses: actions\/github-script@v7/g) || [];
  const retrySettings = monitor.match(/^\s+retries: 3$/gm) || [];
  const retryExemptions = monitor.match(/^\s+retry-exempt-status-codes: 400,401,403,404,422$/gm) || [];

  assert.equal(githubScriptSteps.length, 5);
  assert.equal(retrySettings.length, githubScriptSteps.length);
  assert.equal(retryExemptions.length, githubScriptSteps.length);
});

test("recoverable workflow alerts close after a green run", () => {
  for (const file of [
    ".github/workflows/build-pages.yml",
    ".github/workflows/rebuild-chunks.yml",
    ".github/workflows/refresh-docs.yml",
    ".github/workflows/rotate-featured.yml",
  ]) {
    const workflow = fs.readFileSync(file, "utf-8");
    assert.match(workflow, /Close prior failure alert after recovery/, file);
    assert.match(workflow, /if: success\(\)/, file);
  }
});

test("PR smoke can report failures and release monitor closes resolved legacy alerts", () => {
  const smoke = fs.readFileSync(".github/workflows/smoke-test-pr.yml", "utf-8");
  assert.match(smoke, /pull-requests: write/);

  const release = fs.readFileSync(".github/workflows/release-monitor.yml", "utf-8");
  assert.match(release, /Close resolved legacy release alerts/);
  assert.match(release, /Auto-merge failed on release PR/);
});
