import assert from "node:assert/strict";
import { test } from "node:test";

import {
  extractTrackedReleaseTags,
  latestStableRelease,
  planReleaseBatch,
  releaseBranchName,
  releaseTagFromPrTitle,
  renderReleaseMarkdown,
} from "../lib/release-sync.js";
import { GitHubApiError, GitHubClient, listOpenPulls, syncReleases } from "../scripts/sync-releases.js";

const release = (tag, publishedAt, version) => ({
  tag_name: tag,
  name: `Hermes Agent ${version}`,
  published_at: publishedAt,
  body: `# Hermes Agent ${version} (${tag})\n\n${"Authoritative release notes. ".repeat(5)}`,
  draft: false,
  prerelease: false,
});

test("GitHubClient retries transient read failures including non-JSON 503 bodies", async () => {
  const responses = [
    {
      ok: false,
      status: 503,
      headers: { get: () => null },
      text: async () => "<html><title>Unicorn!</title></html>",
    },
    {
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: async () => JSON.stringify([{ tag_name: "v2026.7.7.2" }]),
    },
  ];
  const delays = [];
  let calls = 0;
  const client = new GitHubClient({
    token: "test-token",
    fetchImpl: async () => responses[calls++],
    sleepImpl: async (delay) => delays.push(delay),
    retryDelayMs: 25,
  });

  const result = await client.request("GET", "/repos/NousResearch/hermes-agent/releases");

  assert.deepEqual(result, [{ tag_name: "v2026.7.7.2" }]);
  assert.equal(calls, 2);
  assert.deepEqual(delays, [25]);
});

test("GitHubClient does not blindly retry mutating requests", async () => {
  let calls = 0;
  const client = new GitHubClient({
    token: "test-token",
    fetchImpl: async () => {
      calls++;
      return {
        ok: false,
        status: 503,
        headers: { get: () => null },
        text: async () => "<html><title>Unicorn!</title></html>",
      };
    },
    sleepImpl: async () => assert.fail("mutation retry must not sleep"),
    retryDelayMs: 0,
  });

  await assert.rejects(
    client.request("POST", "/repos/ksimback/hermes-ecosystem/issues", { title: "test" }),
    (error) => error instanceof GitHubApiError && error.status === 503,
  );
  assert.equal(calls, 1);
});

test("release sync falls back to GraphQL when REST pull listing is unavailable", async () => {
  const calls = [];
  const client = {
    async request(method, apiPath, body, options) {
      calls.push({ method, apiPath, body, options });
      if (method === "GET") {
        throw new GitHubApiError("REST unavailable", 503, "<html>Unicorn</html>");
      }
      return {
        data: {
          repository: {
            pullRequests: {
              nodes: [{ number: 498, title: "Contributor PR", state: "OPEN", headRefName: "feature" }],
            },
          },
        },
      };
    },
  };

  const pulls = await listOpenPulls(client, "ksimback/hermes-ecosystem");

  assert.deepEqual(pulls, [{
    number: 498,
    title: "Contributor PR",
    state: "open",
    head: { ref: "feature" },
  }]);
  assert.equal(calls[1].apiPath, "/graphql");
  assert.equal(calls[1].options.retryableRead, true);
});

test("extractTrackedReleaseTags reads exact release metadata and source URLs", () => {
  const tags = extractTrackedReleaseTags([
    {
      path: "research/48-release-2026-7-1.md",
      content: "**Version:** v2026.7.1\n**Source:** https://github.com/NousResearch/hermes-agent/releases/tag/v2026.7.1",
    },
    {
      path: "research/unrelated.md",
      content: "# Hermes Agent v0.18.0\n**Version:** v0.18.0",
    },
  ]);

  assert.deepEqual([...tags], ["v2026.7.1"]);
});

test("planReleaseBatch ingests every missing release oldest to newest", () => {
  const plan = planReleaseBatch({
    upstreamReleases: [
      release("v2026.7.7.2", "2026-07-08T03:11:22Z", "v0.18.2"),
      release("v2026.7.7", "2026-07-08T01:15:00Z", "v0.18.1"),
      release("v2026.7.1", "2026-07-01T20:08:06Z", "v0.18.0"),
    ],
    researchFiles: [{
      path: "research/48-release-2026-7-1.md",
      content: "**Version:** v2026.7.1\n**Published:** 2026-07-01T20:08:06Z",
    }],
  });

  assert.deepEqual(plan.missing.map((item) => item.tag_name), ["v2026.7.7", "v2026.7.7.2"]);
  assert.deepEqual(plan.documents.map((item) => item.path), [
    "research/49-release-2026-7-7.md",
    "research/50-release-2026-7-7-2.md",
  ]);
  assert.match(plan.documents[1].content, /Hermes Agent v0\.18\.2/);
});

test("planReleaseBatch is idempotent when all tags are already tracked", () => {
  const upstream = release("v2026.7.7", "2026-07-08T01:15:00Z", "v0.18.1");
  const plan = planReleaseBatch({
    upstreamReleases: [upstream],
    researchFiles: [{
      path: "research/49-release-2026-7-7.md",
      content: renderReleaseMarkdown(upstream),
    }],
  });
  assert.equal(plan.documents.length, 0);
});

test("latestStableRelease ignores drafts and prereleases", () => {
  const stable = release("v2026.7.7.2", "2026-07-08T03:11:22Z", "v0.18.2");
  assert.equal(latestStableRelease([
    { ...release("v2026.7.8", "2026-07-09T00:00:00Z", "v0.19.0"), prerelease: true },
    { ...release("v2026.7.9", "2026-07-10T00:00:00Z", "v0.19.1"), draft: true },
    stable,
  ]), stable);
});

test("syncReleases dispatches a rebuild when the corpus is current but the release artifact is stale", async () => {
  const upstream = release("v2026.7.7.2", "2026-07-08T03:11:22Z", "v0.18.2");
  const stalePull = {
    number: 494,
    title: "New release: Hermes Agent v2026.7.7.2",
    head: { ref: "release-notes-2026.7.7.2" },
  };
  const calls = [];
  const client = {
    async request(method, apiPath, body) {
      calls.push({ method, apiPath, body });
      if (apiPath.includes("/releases?")) return [upstream];
      if (apiPath.endsWith("/pulls?state=open&per_page=100")) return [stalePull];
      if (method === "POST" && apiPath.endsWith("/issues/494/comments")) return {};
      if (method === "PATCH" && apiPath.endsWith("/pulls/494")) return {};
      if (apiPath.endsWith("/actions/workflows/rebuild-chunks.yml/dispatches")) return null;
      throw new Error(`Unexpected request: ${method} ${apiPath}`);
    },
  };

  const result = await syncReleases({
    client,
    repository: "ksimback/hermes-ecosystem",
    researchFiles: [{
      path: "research/50-release-2026-7-7-2.md",
      content: renderReleaseMarkdown(upstream),
    }],
    latestReleaseData: { tag: "v2026.7.1" },
  });

  assert.equal(result.merged, false);
  assert.equal(result.rebuildDispatched, true);
  assert.ok(calls.some((call) => call.apiPath.endsWith("/actions/workflows/rebuild-chunks.yml/dispatches")));
  assert.ok(calls.some((call) => call.method === "PATCH" && call.apiPath.endsWith("/pulls/494")));
});

test("syncReleases defers PR cleanup when the current release corpus is healthy", async () => {
  const upstream = release("v2026.7.7.2", "2026-07-08T03:11:22Z", "v0.18.2");
  const calls = [];
  const client = {
    async request(method, apiPath) {
      calls.push({ method, apiPath });
      if (apiPath.includes("/releases?")) return [upstream];
      if (apiPath.endsWith("/pulls?state=open&per_page=100") || apiPath === "/graphql") {
        throw new GitHubApiError("GitHub unavailable", 503, "<html>Unicorn</html>");
      }
      throw new Error(`Unexpected request: ${method} ${apiPath}`);
    },
  };

  const result = await syncReleases({
    client,
    repository: "ksimback/hermes-ecosystem",
    researchFiles: [{
      path: "research/50-release-2026-7-7-2.md",
      content: renderReleaseMarkdown(upstream),
    }],
    latestReleaseData: { tag: "v2026.7.7.2" },
  });

  assert.deepEqual(result, { merged: false, documents: [], rebuildDispatched: false });
  assert.equal(calls.some((call) => call.apiPath === "/graphql"), true);
});

test("planReleaseBatch does not backfill intentional gaps before the watermark", () => {
  const plan = planReleaseBatch({
    upstreamReleases: [
      release("v2026.7.7", "2026-07-08T01:15:00Z", "v0.18.1"),
      release("v2026.3.12", "2026-03-12T12:00:00Z", "v0.8.0"),
    ],
    researchFiles: [{
      path: "research/48-release-2026-7-1.md",
      content: "**Version:** v2026.7.1\n**Published:** 2026-07-01T20:08:06Z",
    }],
  });

  assert.deepEqual(plan.missing.map((item) => item.tag_name), ["v2026.7.7"]);
});

test("renderReleaseMarkdown fails rather than silently skipping empty notes", () => {
  assert.throws(
    () => renderReleaseMarkdown({ tag_name: "v2026.7.7", published_at: "2026-07-08T01:15:00Z", body: "short" }),
    /no usable release notes/,
  );
});

test("release PR helpers create stable retry keys", () => {
  assert.equal(releaseTagFromPrTitle("New release: Hermes Agent v2026.7.7.2"), "v2026.7.7.2");
  assert.equal(releaseBranchName("v2026.7.7.2"), "release-notes-batch-2026-7-7-2");
});

test("syncReleases reuses a stuck PR, merges the full batch, and dispatches the RAG rebuild", async () => {
  const upstreamReleases = [
    release("v2026.7.7.2", "2026-07-08T03:11:22Z", "v0.18.2"),
    release("v2026.7.7", "2026-07-08T01:15:00Z", "v0.18.1"),
  ];
  const stuckPull = {
    number: 494,
    title: "New release: Hermes Agent v2026.7.7.2",
    head: { ref: "release-notes-2026.7.7.2" },
  };
  const calls = [];
  let blobNumber = 0;
  let pullListNumber = 0;
  const client = {
    async request(method, apiPath, body) {
      calls.push({ method, apiPath, body });
      if (apiPath.includes("/releases?")) return upstreamReleases;
      if (apiPath.endsWith("/pulls?state=open&per_page=100")) {
        pullListNumber++;
        return pullListNumber < 3 ? [stuckPull] : [];
      }
      if (apiPath.endsWith("/git/ref/heads/main")) return { object: { sha: "main-sha" } };
      if (apiPath.endsWith("/git/commits/main-sha")) return { tree: { sha: "base-tree" } };
      if (apiPath.endsWith("/git/blobs")) return { sha: `blob-${++blobNumber}` };
      if (apiPath.endsWith("/git/trees")) return { sha: "new-tree" };
      if (apiPath.endsWith("/git/commits")) return { sha: "release-commit" };
      if (apiPath.endsWith("/git/refs/heads/release-notes-2026.7.7.2")) return {};
      if (method === "GET" && apiPath.endsWith("/pulls/494")) {
        return { ...stuckPull, mergeable: true, mergeable_state: "clean" };
      }
      if (method === "PUT" && apiPath.endsWith("/pulls/494/merge")) return { merged: true };
      if (apiPath.endsWith("/actions/workflows/rebuild-chunks.yml/dispatches")) return null;
      throw new Error(`Unexpected request: ${method} ${apiPath}`);
    },
  };

  const result = await syncReleases({
    client,
    repository: "ksimback/hermes-ecosystem",
    researchFiles: [{
      path: "research/48-release-2026-7-1.md",
      content: "**Version:** v2026.7.1\n**Published:** 2026-07-01T20:08:06Z",
    }],
  });

  assert.equal(result.merged, true);
  assert.equal(result.documents.length, 2);
  assert.equal(calls.filter((call) => call.apiPath.endsWith("/git/blobs")).length, 2);
  assert.ok(calls.some((call) => call.method === "PATCH" && call.body.force === true));
  assert.ok(calls.some((call) => call.method === "PUT" && call.apiPath.endsWith("/pulls/494/merge")));
  assert.ok(calls.some((call) => call.apiPath.endsWith("/actions/workflows/rebuild-chunks.yml/dispatches")));
  assert.equal(calls.some((call) => call.method === "POST" && call.apiPath.endsWith("/pulls")), false);
});
