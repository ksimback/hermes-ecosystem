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
