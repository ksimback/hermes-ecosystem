import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "fs/promises";
import {
  formatUnavailableReport,
  pushStarsSnapshot,
} from "../scripts/push-stars-snapshot.js";

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

test("partial-snapshot error carries the unavailable repos for the alert body", async () => {
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
                data: { repo0: null, atlas: { stargazerCount: 42 } },
                errors: [{ message: "repository deleted", path: ["repo0"] }],
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
              unavailableRepos: [{
                owner: "ndesv21",
                repo: "socialclaw",
                reason: "Could not resolve to a Repository",
              }],
            };
          },
        };
      },
    }),
    // Without this the workflow can only say "something failed" and a human has
    // to open the run log to learn which entry broke the catalog.
    (error) => {
      assert.deepEqual(error.unavailableRepos, [{
        owner: "ndesv21",
        repo: "socialclaw",
        reason: "Could not resolve to a Repository",
      }]);
      return true;
    },
  );
});

test("unavailable report names each repo, its reason, and the recovery steps", () => {
  const report = formatUnavailableReport([
    { owner: "ndesv21", repo: "socialclaw", reason: "Could not resolve to a Repository" },
    { owner: "example", repo: "gone" },
  ]);

  assert.match(report, /Unavailable catalog repositories \(2\)/);
  assert.match(report, /`ndesv21\/socialclaw` — https:\/\/github\.com\/ndesv21\/socialclaw — Could not resolve/);
  // A missing reason must not render as "undefined" next to the repo name.
  assert.match(report, /`example\/gone` — https:\/\/github\.com\/example\/gone\n/);
  assert.doesNotMatch(report, /undefined/);
  // The alert has to state the blast radius and the republish step, because
  // merging the removal alone leaves the live snapshot degraded.
  assert.match(report, /post-deploy smoke test/);
  assert.match(report, /data\/summaries\.json/);
  assert.match(report, /Refresh GitHub Stars/);
});

test("stars alert names the dead repos and does not repeat an unchanged diagnosis", async () => {
  const workflow = await readFile(new URL("../.github/workflows/refresh-stars.yml", import.meta.url), "utf8");
  // The alert must consume the report the script writes, or it degrades back
  // to the generic "workflow failed" body that started this incident.
  assert.match(workflow, /stars-unavailable\.md/);
  assert.match(workflow, /listComments/);
  assert.match(workflow, /not re-commenting/);
  // Run URLs differ every run; comparing them would defeat the dedupe.
  assert.match(workflow, /withoutRunUrl/);
});

test("dead-repo sweep runs daily while the billed summary audit stays weekly", async () => {
  const workflow = await readFile(new URL("../.github/workflows/audit-summaries.yml", import.meta.url), "utf8");
  assert.match(workflow, /cron: '0 8 \* \* 1'/);
  assert.match(workflow, /cron: '0 8 \* \* \*'/);
  // A weekly-only sweep left a dead repo breaking the 6-hourly refresh for 6+
  // days. The daily cron must still skip the OpenRouter-billed audit steps.
  assert.match(workflow, /if: github\.event\.schedule != '0 8 \* \* \*'/);
  assert.match(workflow, /check-dead-repos\.js/);
});
