import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

import {
  findSubmissionCandidate,
  mergeSubmissionCandidate,
} from "../lib/repo-submission.js";
import { recoverRepoSubmissions } from "../scripts/recover-repo-submissions.js";

const repo = (owner, name, category = "Developer Tools") => ({
  owner,
  repo: name,
  name,
  description: `${name} for Hermes Agent`,
  stars: 10,
  url: `https://github.com/${owner}/${name}`,
  official: false,
  category,
});

test("findSubmissionCandidate isolates the one branch-only repo", () => {
  const existing = repo("example", "existing");
  const candidate = repo("example", "candidate");
  assert.deepEqual(findSubmissionCandidate([existing], [existing, candidate]), candidate);
  assert.equal(findSubmissionCandidate([existing, candidate], [existing, candidate]), null);
  assert.throws(
    () => findSubmissionCandidate([existing], [existing, candidate, repo("example", "second")]),
    /Expected one repo addition/,
  );
});

test("findSubmissionCandidate selects the PR-owned repo when a stale branch has extra history", () => {
  const main = [repo("example", "existing")];
  const removedFromMain = repo("example", "removed-later");
  const candidate = repo("example", "candidate");

  assert.deepEqual(
    findSubmissionCandidate(
      main,
      [main[0], removedFromMain, candidate],
      "example/candidate",
    ),
    candidate,
  );
});

test("mergeSubmissionCandidate preserves current main and validates the candidate", () => {
  const main = [repo("example", "first"), repo("example", "second")];
  const next = mergeSubmissionCandidate(main, repo("example", "third"));
  assert.deepEqual(next.map((item) => item.repo), ["first", "second", "third"]);
  const repaired = mergeSubmissionCandidate(
    main,
    repo("example", "repaired", "Memory & Context on plugin performance"),
  );
  assert.equal(repaired.at(-1).category, "Memory & Context");
  assert.throws(
    () => mergeSubmissionCandidate(main, repo("example", "bad", "Not a category")),
    /category must be one of/,
  );
});

test("recoverRepoSubmissions refreshes a stale PR onto main before merging", async () => {
  const mainRepos = [repo("example", "first"), repo("example", "newer-main")];
  const candidate = repo("example", "candidate");
  const branchRepos = [repo("example", "first"), candidate];
  const pull = {
    number: 516,
    created_at: "2026-07-12T00:00:00Z",
    body: "Adds [example/candidate](https://github.com/example/candidate) to the ecosystem map.",
    head: {
      ref: "add-repo-example-candidate",
      repo: { full_name: "ksimback/hermes-ecosystem" },
    },
  };
  const calls = [];
  const encoded = (value) => Buffer.from(JSON.stringify(value)).toString("base64");
  const client = {
    async request(method, apiPath, body) {
      calls.push({ method, apiPath, body });
      if (apiPath.endsWith("/pulls?state=open&per_page=100")) return [pull];
      if (apiPath.endsWith("/issues?state=open&labels=workflow-issue&per_page=100")) return [];
      if (apiPath.endsWith("/pulls/516/files?per_page=100")) return [{ filename: "data/repos.json" }];
      if (apiPath.endsWith("contents/data/repos.json?ref=main")) return { content: encoded(mainRepos), sha: "main-file" };
      if (apiPath.endsWith("contents/data/repos.json?ref=add-repo-example-candidate")) {
        return { content: encoded(branchRepos), sha: "branch-file" };
      }
      if (method === "PUT" && apiPath.endsWith("/contents/data/repos.json")) return {};
      if (method === "GET" && apiPath.endsWith("/pulls/516")) {
        return { ...pull, mergeable: true, mergeable_state: "unstable", head: { ...pull.head, sha: "refreshed-sha" } };
      }
      if (method === "PUT" && apiPath.endsWith("/pulls/516/merge")) return { merged: true };
      if (apiPath.endsWith("/actions/workflows/build-pages.yml/dispatches")) return null;
      throw new Error(`Unexpected request: ${method} ${apiPath}`);
    },
  };

  const result = await recoverRepoSubmissions({ client, repository: "ksimback/hermes-ecosystem" });
  assert.equal(result.mergedCount, 1);
  const update = calls.find((call) => call.method === "PUT" && call.apiPath.endsWith("/contents/data/repos.json"));
  const refreshed = JSON.parse(Buffer.from(update.body.content, "base64").toString("utf-8"));
  assert.deepEqual(refreshed.map((item) => item.repo), ["first", "newer-main", "candidate"]);
  assert.ok(calls.some((call) => call.apiPath.endsWith("/pulls/516/merge")));
  assert.ok(calls.some((call) => call.apiPath.endsWith("/actions/workflows/build-pages.yml/dispatches")));
});

test("validator workflow does not wait for impossible bot-triggered CheckRuns", () => {
  const workflow = fs.readFileSync(".github/workflows/validate-repo-suggestion.yml", "utf-8");
  assert.match(workflow, /CANONICAL_CATEGORIES, validateRepos \} = await import/);
  assert.match(workflow, /\['CLEAN', 'HAS_HOOKS', 'UNSTABLE'\]/);
  assert.match(workflow, /createWorkflowDispatch/);
  assert.match(workflow, /recover-open-prs:/);
  assert.doesNotMatch(workflow, /const REQUIRED = \['validate', 'smoke'\]/);
});
