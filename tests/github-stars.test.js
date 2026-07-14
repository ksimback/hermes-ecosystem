import test from "node:test";
import assert from "node:assert/strict";
import { fetchGitHubStars, validateStarData } from "../lib/github-stars.js";

const repos = [
  { owner: "NousResearch", repo: "hermes-agent", stars: 90 },
  { owner: "example", repo: "tool", stars: 6 },
];

function githubResponse(payload, ok = true, status = 200) {
  return {
    ok,
    status,
    async json() { return payload; },
  };
}

test("fetchGitHubStars maps a complete GraphQL snapshot", async () => {
  let request;
  const result = await fetchGitHubStars({
    repoList: repos,
    token: "token",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return githubResponse({
        data: {
          repo0: {
            stargazerCount: 100,
            updatedAt: "2026-07-13T00:00:00Z",
            pushedAt: "2026-07-14T00:00:00Z",
            latestRelease: {
              tagName: "v2026.7.7.2",
              name: "Hermes Agent v0.18.2 (v2026.7.7.2)",
              publishedAt: "2026-07-07T00:00:00Z",
            },
          },
          repo1: {
            stargazerCount: 7,
            updatedAt: "2026-07-12T00:00:00Z",
            pushedAt: null,
          },
          atlas: { stargazerCount: 42 },
        },
      });
    },
  });

  assert.equal(request.url, "https://api.github.com/graphql");
  assert.match(request.options.headers.Authorization, /token/);
  assert.deepEqual(result, {
    starData: [
      {
        owner: "NousResearch",
        repo: "hermes-agent",
        stars: 100,
        updatedAt: "2026-07-14T00:00:00Z",
      },
      {
        owner: "example",
        repo: "tool",
        stars: 7,
        updatedAt: "2026-07-12T00:00:00Z",
      },
    ],
    hermesRelease: {
      version: "v0.18.2",
      tag: "v2026.7.7.2",
      name: "Hermes Agent v0.18.2 (v2026.7.7.2)",
      publishedAt: "2026-07-07T00:00:00Z",
    },
    atlasStars: 42,
    complete: true,
    unavailableRepos: [],
  });
});

test("fetchGitHubStars rejects partial GraphQL success", async () => {
  await assert.rejects(
    fetchGitHubStars({
      repoList: repos,
      token: "token",
      fetchImpl: async () => githubResponse({
        data: { repo0: null },
        errors: [{ message: "rate limited" }],
      }),
    }),
    /GraphQL errors: rate limited/,
  );
});

test("fetchGitHubStars preserves partial data and identifies a missing repository", async () => {
  const result = await fetchGitHubStars({
      repoList: repos,
      token: "token",
      fetchImpl: async () => githubResponse({
        data: {
          repo0: {
            stargazerCount: 100,
            updatedAt: "2026-07-14T00:00:00Z",
            pushedAt: null,
            latestRelease: null,
          },
          repo1: null,
          atlas: { stargazerCount: 42 },
        },
      }),
  });
  assert.equal(result.complete, false);
  assert.deepEqual(result.starData[1], {
    owner: "example",
    repo: "tool",
    stars: 6,
    updatedAt: null,
  });
  assert.match(result.unavailableRepos[0].reason, /no repository node/);
});

test("validateStarData rejects duplicates and invalid counts", () => {
  assert.throws(
    () => validateStarData([
      { owner: "NousResearch", repo: "hermes-agent", stars: 1, updatedAt: "2026-07-14T00:00:00Z" },
      { owner: "NousResearch", repo: "hermes-agent", stars: -1, updatedAt: "2026-07-14T00:00:00Z" },
    ], repos),
    /Duplicate repo|Invalid star count/,
  );
});
