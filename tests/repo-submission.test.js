import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

import {
  findSubmissionCandidate,
  mergeSubmissionCandidate,
} from "../lib/repo-submission.js";
import {
  GitHubClient,
  isUnprocessedSuggestion,
  recoverRepoSubmissions,
} from "../scripts/recover-repo-submissions.js";

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

test("GitHubClient preserves HTTP status for recovery decisions", async () => {
  const client = new GitHubClient({
    token: "test",
    fetchImpl: async () => ({
      ok: false,
      status: 404,
      async text() { return JSON.stringify({ message: "Not Found" }); },
    }),
  });

  await assert.rejects(
    client.request("GET", "/repos/example/deleted"),
    (error) => error.status === 404 && /Not Found/.test(error.message),
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

test("isUnprocessedSuggestion recognizes legacy repo titles without sweeping unrelated issues", () => {
  const issue = (title, body, labels = []) => ({
    number: 293,
    state: "open",
    title,
    body,
    labels,
  });
  const url = "https://github.com/obra/superpowers";

  assert.equal(isUnprocessedSuggestion(issue("Add obra/superpowers", url)), true);
  assert.equal(isUnprocessedSuggestion(issue("Suggest a Hermes plugin", url)), true);
  assert.equal(isUnprocessedSuggestion(issue("[Suggest a Repo] agentcairn", url)), true);
  assert.equal(isUnprocessedSuggestion(issue("Content newsletter", url)), false);
  assert.equal(isUnprocessedSuggestion(issue("Add content newsletter", "No repository URL")), false);
  assert.equal(
    isUnprocessedSuggestion(issue("Add obra/superpowers", url, [{ name: "repo-suggestion" }])),
    false,
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
      if (apiPath.endsWith("/issues?state=open&labels=repo-suggestion&per_page=100")) return [];
      if (apiPath.endsWith("/issues?state=open&per_page=100")) return [];
      if (apiPath.endsWith("/pulls/516/files?per_page=100")) return [{ filename: "data/repos.json" }];
      if (apiPath.endsWith("/git/ref/heads/main")) return { object: { sha: "main-sha" } };
      if (apiPath.endsWith("/git/commits/main-sha")) return { tree: { sha: "main-tree" } };
      if (apiPath.endsWith("contents/data/repos.json?ref=main-sha")) return { content: encoded(mainRepos), sha: "main-file" };
      if (apiPath.endsWith("contents/data/repos.json?ref=add-repo-example-candidate")) {
        return { content: encoded(branchRepos), sha: "branch-file" };
      }
      if (method === "POST" && apiPath.endsWith("/git/blobs")) return { sha: "catalog-blob" };
      if (method === "POST" && apiPath.endsWith("/git/trees")) return { sha: "refreshed-tree" };
      if (method === "POST" && apiPath.endsWith("/git/commits")) return { sha: "refreshed-sha" };
      if (method === "PATCH" && apiPath.endsWith("/git/refs/heads/add-repo-example-candidate")) return {};
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
  const update = calls.find((call) => call.method === "POST" && call.apiPath.endsWith("/git/blobs"));
  const refreshed = JSON.parse(update.body.content);
  assert.deepEqual(refreshed.map((item) => item.repo), ["first", "newer-main", "candidate"]);
  const commit = calls.find((call) => call.method === "POST" && call.apiPath.endsWith("/git/commits"));
  assert.deepEqual(commit.body.parents, ["main-sha"]);
  const refUpdate = calls.find((call) => call.method === "PATCH" && call.apiPath.includes("/git/refs/heads/"));
  assert.deepEqual(refUpdate.body, { sha: "refreshed-sha", force: true });
  assert.ok(calls.some((call) => call.apiPath.endsWith("/pulls/516/merge")));
  assert.ok(calls.some((call) => call.apiPath.endsWith("/actions/workflows/build-pages.yml/dispatches")));
});

test("recoverRepoSubmissions closes cataloged and deleted suggestion issues", async () => {
  const catalog = [repo("example", "cataloged")];
  const suggestions = [
    { number: 100, body: "Repo: https://github.com/example/cataloged" },
    { number: 101, body: "Repo: https://github.com/example/deleted" },
  ];
  const calls = [];
  const encoded = (value) => Buffer.from(JSON.stringify(value)).toString("base64");
  const client = {
    async request(method, apiPath, body) {
      calls.push({ method, apiPath, body });
      if (apiPath.endsWith("/pulls?state=open&per_page=100")) return [];
      if (apiPath.endsWith("/issues?state=open&labels=workflow-issue&per_page=100")) return [];
      if (apiPath.endsWith("/issues?state=open&labels=repo-suggestion&per_page=100")) return suggestions;
      if (apiPath.endsWith("/issues?state=open&per_page=100")) return [];
      if (apiPath.endsWith("contents/data/repos.json?ref=main")) return { content: encoded(catalog) };
      if (method === "GET" && apiPath.endsWith("/repos/example/deleted")) {
        const error = new Error("Not Found");
        error.status = 404;
        throw error;
      }
      if (method === "POST" && apiPath.match(/\/issues\/10[01]\/comments$/)) return {};
      if (method === "PATCH" && apiPath.match(/\/issues\/10[01]$/)) return {};
      throw new Error(`Unexpected request: ${method} ${apiPath}`);
    },
  };

  const result = await recoverRepoSubmissions({ client, repository: "ksimback/hermes-ecosystem" });
  assert.equal(result.mergedCount, 0);
  const closures = calls.filter((call) => call.method === "PATCH" && call.apiPath.match(/\/issues\/10[01]$/));
  assert.deepEqual(closures.map((call) => call.body.state_reason), ["completed", "not_planned"]);
});

test("recoverRepoSubmissions dispatches the oldest stranded suggestion", async () => {
  const calls = [];
  const oldIssue = {
    number: 293,
    state: "open",
    created_at: "2026-05-01T00:00:00Z",
    title: "Add obra/superpowers",
    body: "https://github.com/obra/superpowers",
    labels: [],
  };
  const newerIssue = {
    ...oldIssue,
    number: 326,
    created_at: "2026-05-02T00:00:00Z",
    title: "Add zero-sq/space0-mcp",
    body: "https://github.com/zero-sq/space0-mcp",
  };
  const client = {
    async request(method, apiPath, body) {
      calls.push({ method, apiPath, body });
      if (apiPath.endsWith("/pulls?state=open&per_page=100")) return [];
      if (apiPath.endsWith("/issues?state=open&labels=workflow-issue&per_page=100")) return [];
      if (apiPath.endsWith("/issues?state=open&labels=repo-suggestion&per_page=100")) return [];
      if (apiPath.endsWith("/issues?state=open&per_page=100")) return [newerIssue, oldIssue];
      if (method === "POST" && apiPath.endsWith("/actions/workflows/validate-repo-suggestion.yml/dispatches")) return null;
      if (method === "POST" && apiPath.endsWith("/issues/293/labels")) return [];
      throw new Error(`Unexpected request: ${method} ${apiPath}`);
    },
  };

  const result = await recoverRepoSubmissions({ client, repository: "ksimback/hermes-ecosystem" });
  assert.equal(result.dispatchedIssue, 293);
  const dispatch = calls.find((call) => call.apiPath.endsWith("/dispatches"));
  assert.deepEqual(dispatch.body.inputs, { issue_number: "293" });
  assert.ok(calls.some((call) => call.apiPath.endsWith("/issues/293/labels")));
  assert.ok(!calls.some((call) => call.apiPath.endsWith("/issues/326/labels")));
});

test("validator workflow does not wait for impossible bot-triggered CheckRuns", () => {
  const workflow = fs.readFileSync(".github/workflows/validate-repo-suggestion.yml", "utf-8");
  assert.match(workflow, /CANONICAL_CATEGORIES, validateRepos \} = await import/);
  assert.match(workflow, /\['CLEAN', 'HAS_HOOKS', 'UNSTABLE'\]/);
  assert.match(workflow, /createWorkflowDispatch/);
  assert.match(workflow, /recover-open-prs:/);
  assert.match(workflow, /issue_number:/);
  assert.match(workflow, /SOURCE_ISSUE_NUMBER/);
  assert.match(workflow, /titleMatches && hasGitHubRepo/);
  assert.doesNotMatch(workflow, /const REQUIRED = \['validate', 'smoke'\]/);
});
