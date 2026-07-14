import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "fs/promises";
import { pushStarsSnapshot } from "../scripts/push-stars-snapshot.js";

const repos = [{ owner: "example", repo: "tool", stars: 6 }];

test("scheduled publisher fetches GitHub and posts an authenticated snapshot", async () => {
  const requests = [];
  const result = await pushStarsSnapshot({
    githubToken: "github-token",
    cronSecret: "cron-secret",
    endpoint: "https://example.test/api/stars?cron=1",
    repoList: repos,
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      if (url === "https://api.github.com/graphql") {
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              data: {
                repo0: {
                  stargazerCount: 7,
                  updatedAt: "2026-07-14T00:00:00Z",
                  pushedAt: null,
                },
                atlas: { stargazerCount: 42 },
              },
            };
          },
        };
      }
      return {
        ok: true,
        status: 200,
        async json() {
          return { source: "github-actions", stale: false, totals: { count: 1 } };
        },
      };
    },
  });

  assert.equal(requests.length, 2);
  assert.equal(requests[1].options.headers.Authorization, "Bearer cron-secret");
  assert.deepEqual(JSON.parse(requests[1].options.body), {
    starData: [{
      owner: "example",
      repo: "tool",
      stars: 7,
      updatedAt: "2026-07-14T00:00:00Z",
    }],
    hermesRelease: null,
    atlasStars: 42,
    complete: true,
    unavailableRepos: [],
  });
  assert.equal(result.source, "github-actions");
});

test("scheduled publisher rejects a degraded ingestion response", async () => {
  let call = 0;
  await assert.rejects(
    pushStarsSnapshot({
      githubToken: "github-token",
      cronSecret: "cron-secret",
      repoList: repos,
      fetchImpl: async () => {
        call += 1;
        if (call === 1) {
          return {
            ok: true,
            status: 200,
            async json() {
              return {
                data: {
                  repo0: {
                    stargazerCount: 7,
                    updatedAt: "2026-07-14T00:00:00Z",
                    pushedAt: null,
                  },
                  atlas: { stargazerCount: 42 },
                },
              };
            },
          };
        }
        return {
          ok: true,
          status: 200,
          async json() { return { source: "static", stale: true }; },
        };
      },
    }),
    /degraded response/,
  );
});

test("scheduled publisher alerts after persisting an explicitly partial snapshot", async () => {
  let call = 0;
  await assert.rejects(
    pushStarsSnapshot({
      githubToken: "github-token",
      cronSecret: "cron-secret",
      repoList: repos,
      fetchImpl: async () => {
        call += 1;
        if (call === 1) {
          return {
            ok: true,
            status: 200,
            async json() {
              return {
                data: {
                  repo0: null,
                  atlas: { stargazerCount: 42 },
                },
                errors: [{
                  message: "repository deleted",
                  path: ["repo0"],
                }],
              };
            },
          };
        }
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              source: "github-actions",
              stale: false,
              complete: false,
              unavailableRepos: [{ owner: "example", repo: "tool" }],
            };
          },
        };
      },
    }),
    /unavailable catalog repositories: example\/tool/,
  );
  assert.equal(call, 2, "partial snapshot must reach ingestion before the workflow alerts");
});

test("refresh workflow owns scheduling, authentication, and alert recovery", async () => {
  const workflow = await readFile(new URL("../.github/workflows/refresh-stars.yml", import.meta.url), "utf8");
  const vercel = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.match(workflow, /cron: '17 \*\/6 \* \* \*'/);
  assert.match(workflow, /GITHUB_TOKEN: \$\{\{ github\.token \}\}/);
  assert.match(workflow, /CRON_SECRET: \$\{\{ secrets\.CRON_SECRET \}\}/);
  assert.match(workflow, /push-stars-snapshot\.js/);
  assert.match(workflow, /GitHub stars refresh failed/);
  assert.equal(vercel.crons, undefined);
});
