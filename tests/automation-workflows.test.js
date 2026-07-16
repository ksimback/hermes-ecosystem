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
