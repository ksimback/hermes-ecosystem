import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflow = await readFile(
  path.join(ROOT, ".github", "workflows", "post-deploy-smoke.yml"),
  "utf8",
);

test("post-deploy smoke seeds stars before enforcing semantic freshness", () => {
  const seed = workflow.indexOf("Seed stars snapshot before semantic smoke");
  const smoke = workflow.indexOf("- name: Run smoke test");

  assert.ok(seed >= 0, "workflow must seed the snapshot after a push deploy");
  assert.ok(smoke > seed, "snapshot seed must complete before semantic smoke starts");
  assert.match(workflow, /if: github\.event_name == 'push'[\s\S]*?GITHUB_TOKEN: \$\{\{ github\.token \}\}[\s\S]*?CRON_SECRET: \$\{\{ secrets\.CRON_SECRET \}\}[\s\S]*?node scripts\/push-stars-snapshot\.js/);
});

// The release-freshness check calls the GitHub API. Unauthenticated that is 60
// requests/hour per IP, and Actions runners share IPs, so the call 403'd and
// reported production as stale when only the rate limit was at fault.
test("post-deploy smoke authenticates the upstream release-freshness call", () => {
  const smoke = workflow.indexOf("- name: Run smoke test");
  assert.ok(smoke >= 0, "workflow must run the smoke test");
  const step = workflow.slice(smoke);
  assert.match(
    step,
    /SMOKE_BASE:[\s\S]*?GITHUB_TOKEN: \$\{\{ github\.token \}\}[\s\S]*?node scripts\/smoke-test-prod\.js/,
    "smoke step must pass github.token so the upstream release call is authenticated",
  );
});

test("post-deploy smoke closes the one active alert after recovery", () => {
  const smoke = workflow.indexOf("- name: Run smoke test");
  const recovery = workflow.indexOf("Close smoke alert after recovery");

  assert.ok(recovery > smoke, "recovery close must run only after smoke succeeds");
  assert.match(workflow, /if: success\(\)[\s\S]*?title = 'Smoke test failure on production'[\s\S]*?labels: 'workflow-issue'[\s\S]*?state: 'closed'[\s\S]*?state_reason: 'completed'/);
});
