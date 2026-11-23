import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { LABELS, REVIEW_STATUS, TIERS, catalogDeletions, classifyPr, mergeCommit, mergeReadiness } from "../lib/merge-tiers.js";

const trusted = { author: "ksimback", isFork: false, trustedAuthors: ["ksimback", "simba-bot"] };
const files = (...names) => names.map((filename) => ({ filename, status: "modified" }));
const tierOf = (names, extra = {}) => classifyPr({ ...trusted, files: files(...names), ...extra }).tier;

test("data, research and drafts from a trusted author are auto tier", () => {
  assert.equal(tierOf(["data/repos.json", "research/40-release-v0.24.md", "drafts/guide-mobile.md"]), TIERS.auto);
});

test("code and page changes are review tier", () => {
  assert.equal(tierOf(["scripts/build-pages.js"]), TIERS.review);
  assert.equal(tierOf(["data/repos.json", "guide/mobile/index.html"]), TIERS.review);
  assert.equal(tierOf(["api/chat.js"]), TIERS.review);
});

test("sensitive paths are human tier, whatever else the PR touches", () => {
  for (const path of [
    ".github/workflows/build-pages.yml",
    "vercel.json",
    "lib/llm.js",
    "package.json",
    "package-lock.json",
    "lib/merge-tiers.js",
    "scripts/merge-policy.js",
    ".env.local",
    "hermes-atlas-bot.private-key.pem",
  ]) {
    assert.equal(tierOf(["data/repos.json", path]), TIERS.human, path);
  }
});

test("renaming a file out of a sensitive path is still human tier", () => {
  const r = classifyPr({ ...trusted, files: [{ filename: "notes/llm.js", previous_filename: "lib/llm.js", status: "renamed" }] });
  assert.equal(r.tier, TIERS.human);
});

test("untrusted authors and forks are human tier even for data", () => {
  assert.equal(tierOf(["data/repos.json"], { author: "stranger" }), TIERS.human);
  assert.equal(tierOf(["data/repos.json"], { isFork: true }), TIERS.human);
  assert.equal(tierOf(["drafts/x.md"], { author: "simba-bot" }), TIERS.auto);
});

test("catalog deletions are human tier; additions and edits are not", () => {
  const base = [{ owner: "a", repo: "one" }, { owner: "b", repo: "two" }];
  assert.deepEqual(catalogDeletions(base, [...base, { owner: "c", repo: "three" }]), []);
  assert.deepEqual(catalogDeletions(base, [{ owner: "A", repo: "One" }]), ["b/two"]);
  assert.deepEqual(catalogDeletions(null, base), []);
  const r = classifyPr({ ...trusted, files: files("data/repos.json"), deletions: ["b/two"] });
  assert.equal(r.tier, TIERS.human);
  assert.match(r.reasons.join(), /b\/two/);
});

test("deleting a data file or a huge PR is human tier", () => {
  assert.equal(classifyPr({ ...trusted, files: [{ filename: "data/featured.json", status: "removed" }] }).tier, TIERS.human);
  assert.equal(tierOf(Array.from({ length: 300 }, (_, i) => `drafts/${i}.md`)), TIERS.human);
});

const pr = { number: 9, title: "Add repos", draft: false, mergeable: true, labels: [] };
const green = [{ name: "test", status: "completed", conclusion: "success" }, { name: "classify", status: "completed", conclusion: "skipped" }];
const ok = [{ context: "Vercel", state: "success" }];
const ready = (over = {}) => mergeReadiness({ pr, tier: TIERS.auto, checkRuns: green, statuses: ok, ...over });

test("auto tier merges when every check and status is green", () => {
  assert.equal(ready().ready, true);
});

test("never merges human tier, drafts, held PRs or conflicts", () => {
  assert.equal(ready({ tier: TIERS.human }).ready, false);
  assert.equal(ready({ pr: { ...pr, draft: true } }).ready, false);
  assert.equal(ready({ pr: { ...pr, labels: [{ name: LABELS.hold }] } }).state, "blocked");
  assert.equal(ready({ pr: { ...pr, mergeable: false } }).state, "blocked");
  assert.equal(ready({ pr: { ...pr, mergeable: null } }).state, "waiting");
});

test("waits for the required test check and running checks; blocks on failures", () => {
  assert.equal(ready({ checkRuns: [] }).state, "waiting");
  assert.equal(ready({ checkRuns: [...green, { name: "smoke", status: "in_progress", conclusion: null }] }).state, "waiting");
  assert.equal(ready({ checkRuns: [...green, { name: "smoke", status: "completed", conclusion: "failure" }] }).state, "blocked");
  assert.equal(ready({ statuses: [{ context: "Vercel", state: "pending" }] }).state, "waiting");
  assert.equal(ready({ statuses: [{ context: "Vercel", state: "failure" }] }).state, "blocked");
});

test("review tier needs a passing Claude review on the head commit", () => {
  const review = (state) => ready({ tier: TIERS.review, statuses: [...ok, ...(state ? [{ context: REVIEW_STATUS, state }] : [])] });
  assert.equal(review(null).state, "waiting");
  assert.equal(review("pending").state, "waiting");
  assert.equal(review("failure").state, "blocked");
  assert.equal(review("error").state, "blocked");
  assert.equal(review("success").ready, true);
  // The review status never counts for auto tier, so a red one can't block it.
  assert.equal(ready({ statuses: [...ok, { context: REVIEW_STATUS, state: "failure" }] }).ready, true);
});

test("merge commit drops skip markers so merged PRs still trigger rebuilds", () => {
  const { commit_title, commit_message } = mergeCommit({ number: 12, title: "Bots use the app [skip ci] token" }, TIERS.review);
  assert.equal(commit_title, "Bots use the app token (#12)");
  assert.doesNotMatch(commit_message, /skip/i);
});

test("merge policy workflow merges with the app and the review posts the status the policy reads", () => {
  const policy = fs.readFileSync(".github/workflows/merge-policy.yml", "utf-8");
  assert.match(policy, /MERGE_TOKEN: \$\{\{ steps\.app-token\.outputs\.token \}\}/);
  assert.match(policy, /workflows: \["Unit tests", "Claude review"\]/);
  assert.match(fs.readFileSync(".github/workflows/test.yml", "utf-8"), /^name: Unit tests$/m);
  const review = fs.readFileSync(".github/workflows/claude-review.yml", "utf-8");
  assert.match(review, /^name: Claude review$/m);
  assert.ok(review.includes(`context: '${REVIEW_STATUS}'`), "review posts the ai-review status");
  assert.match(review, /ref: main\n/, "classification uses main's policy");
  assert.doesNotMatch(review, /--allowedTools "[^"]*(Write|Edit|Bash\(gh)/, "Claude gets read-only tools");
});
