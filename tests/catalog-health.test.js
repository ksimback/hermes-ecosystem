import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRepoQuery,
  findDeadRepos,
  findRenamedRepos,
  findEcosystemDrift,
  classifyDrift,
  renderIssueBody,
} from "../lib/catalog-health.js";

const REPOS = [
  { owner: "alive", repo: "one", url: "https://github.com/alive/one" },
  { owner: "oldowner", repo: "two", url: "https://github.com/oldowner/two" },
  { owner: "gone", repo: "three", url: "https://github.com/gone/three" },
];

test("buildRepoQuery aliases by original index so skipped entries do not shift lookups", () => {
  const entries = [
    { owner: "ok", repo: "one" },
    { owner: 'bad"inject', repo: "two" },
    { owner: "ok", repo: "three" },
  ];
  const { query, skipped } = buildRepoQuery(entries);
  assert.equal(skipped.length, 1);
  assert.equal(skipped[0].index, 1);
  assert.match(query, /repo0: repository\(owner: "ok", name: "one"\)/);
  assert.match(query, /repo2: repository\(owner: "ok", name: "three"\)/);
  // The unsafe entry must not appear at all — no injection into the document.
  assert.doesNotMatch(query, /repo1:/);
  assert.doesNotMatch(query, /inject/);
});

test("buildRepoQuery honors the alias prefix so catalog and drift queries stay distinct", () => {
  const { query } = buildRepoQuery([{ owner: "a", repo: "b" }], "eco");
  assert.match(query, /^eco0: repository/);
});

test("findDeadRepos maps NOT_FOUND error paths back to catalog entries", () => {
  const errors = [{ type: "NOT_FOUND", path: ["repo2"] }];
  const dead = findDeadRepos(REPOS, errors);
  assert.deepEqual(dead, [
    { owner: "gone", repo: "three", url: "https://github.com/gone/three" },
  ]);
});

test("findDeadRepos ignores non-NOT_FOUND errors and unknown aliases", () => {
  const errors = [
    { type: "RATE_LIMITED", path: ["repo0"] },
    { type: "NOT_FOUND", path: ["totals"] },
    { type: "NOT_FOUND", path: ["repo99"] },
  ];
  assert.deepEqual(findDeadRepos(REPOS, errors), []);
});

test("findDeadRepos synthesizes a URL when the entry has none", () => {
  const repos = [{ owner: "gone", repo: "x" }];
  const dead = findDeadRepos(repos, [{ type: "NOT_FOUND", path: ["repo0"] }]);
  assert.equal(dead[0].url, "https://github.com/gone/x");
});

// The core blind spot: GitHub resolves a renamed repo queried by its old name
// and returns the CURRENT nameWithOwner, so the entry looks perfectly healthy.
test("findRenamedRepos detects an entry that resolves to a different name", () => {
  const data = {
    repo0: { nameWithOwner: "alive/one" },
    repo1: { nameWithOwner: "newowner/two" },
  };
  assert.deepEqual(findRenamedRepos(REPOS, data), [
    { from: "oldowner/two", to: "newowner/two" },
  ]);
});

test("findRenamedRepos treats a case-only difference as unchanged", () => {
  const data = { repo0: { nameWithOwner: "Alive/One" } };
  assert.deepEqual(findRenamedRepos([REPOS[0]], data), []);
});

test("findRenamedRepos skips entries with no resolved node", () => {
  assert.deepEqual(findRenamedRepos(REPOS, { repo2: null }), []);
});

test("findEcosystemDrift finds linked rows absent from the catalog, excluding upstream", () => {
  const eco = `
| [alive/one](https://github.com/alive/one) | x | — | Beta |
| [oldowner/two](https://github.com/oldowner/two) | x | — | Beta |
| [stale/row](https://github.com/stale/row) | x | — | Beta |
| [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) | x | — | Production |
`;
  const drift = findEcosystemDrift(eco, REPOS);
  assert.deepEqual(drift, ["stale/row"]);
});

test("findEcosystemDrift normalizes case and strips .git suffixes", () => {
  const eco = "https://github.com/ALIVE/ONE.git and https://github.com/other/thing";
  assert.deepEqual(findEcosystemDrift(eco, REPOS), ["other/thing"]);
});

// Regression guard for the 2026-07-29 incident: the sweep reported two renamed
// repos as "stale rows" and advised deleting them. Both were live and already
// catalogued under new owners; deleting would have dropped them from
// llms-full.txt and the RAG corpus.
test("classifyDrift separates a renamed row from a genuinely dead one", () => {
  const driftNames = ["oldowner/lint", "deleted/repo", "unknown/thing"];
  const repos = [{ owner: "newowner", repo: "lint" }];
  const result = classifyDrift(
    driftNames,
    {
      data: {
        eco0: { nameWithOwner: "newowner/lint" },
        eco2: { nameWithOwner: "unknown/thing" },
      },
      errors: [{ type: "NOT_FOUND", path: ["eco1"] }],
    },
    repos
  );
  assert.deepEqual(result.renamed, [{ name: "oldowner/lint", current: "newowner/lint" }]);
  assert.deepEqual(result.dead, ["deleted/repo"]);
  assert.deepEqual(result.missing, [{ name: "unknown/thing", current: "unknown/thing" }]);
});

test("classifyDrift reports an unresolved row instead of silently dropping it", () => {
  const result = classifyDrift(["weird/row"], { data: {}, errors: [] }, []);
  assert.deepEqual(result.missing, [{ name: "weird/row", current: null }]);
  assert.equal(result.dead.length, 0);
  assert.equal(result.renamed.length, 0);
});

test("renderIssueBody returns empty string when the catalog is healthy", () => {
  assert.equal(renderIssueBody({ dead: [], renamed: [], drift: null }), "");
  assert.equal(renderIssueBody(), "");
});

test("renderIssueBody tells the reader to rewrite renamed rows, never delete them", () => {
  const body = renderIssueBody({
    dead: [],
    renamed: [],
    drift: {
      renamed: [{ name: "old/x", current: "new/x" }],
      dead: [],
      missing: [],
    },
  });
  assert.match(body, /do not blanket-delete/i);
  assert.match(body, /Renamed — rewrite the row \(do NOT delete\)/);
  assert.match(body, /`old\/x` → `new\/x`/);
});

test("renderIssueBody documents the stars-snapshot blast radius for dead entries", () => {
  const body = renderIssueBody({
    dead: [{ owner: "gone", repo: "x", url: "https://github.com/gone/x" }],
  });
  assert.match(body, /push-stars-snapshot\.js/);
  assert.match(body, /Smoke Test/);
  assert.match(body, /`gone\/x`/);
});

test("renderIssueBody lists renamed catalog entries with the full rename checklist", () => {
  const body = renderIssueBody({ renamed: [{ from: "a/b", to: "c/b" }] });
  assert.match(body, /`a\/b` → `c\/b`/);
  assert.match(body, /summaries\.json/);
  assert.match(body, /vercel\.json/);
  assert.match(body, /ECOSYSTEM\.md/);
});

test("renderIssueBody always closes with the auto-close footer when non-empty", () => {
  const body = renderIssueBody({ renamed: [{ from: "a/b", to: "c/b" }] });
  assert.match(body, /auto-closes when the lists go empty/);
});
