import assert from "node:assert/strict";
import test from "node:test";

import { expectedCatalogCounts, findPendingRemovals } from "../lib/smoke-catalog.js";

const repo = (owner, name, category) => ({ owner, repo: name, category });
const repos = [
  repo("a", "one", "Skills"),
  repo("b", "two", "Skills"),
  repo("c", "new", "Memory"),
];

test("expectedCatalogCounts is a plain repos.json count outside preview mode", () => {
  const { total, byCat } = expectedCatalogCounts({ repos });
  assert.equal(total, 3);
  assert.deepEqual([...byCat], [["Skills", 2], ["Memory", 1]]);
});

test("expectedCatalogCounts leaves out additions whose page is not built yet", () => {
  const { total, byCat } = expectedCatalogCounts({ repos, pendingPaths: new Set(["/projects/c/new"]) });
  assert.equal(total, 2);
  // A category made up only of pending entries is not expected on the page yet.
  assert.deepEqual([...byCat], [["Skills", 2]]);
});

test("expectedCatalogCounts keeps counting removals the deployment still renders", () => {
  const { total, byCat } = expectedCatalogCounts({
    repos,
    removals: [{ path: "/projects/d/gone", category: "Skills" }, { path: "/projects/e/unlinked", category: null }],
  });
  assert.equal(total, 5);
  // A removal whose section could not be found still counts toward the total.
  assert.equal(byCat.get("Skills"), 3);
});

test("findPendingRemovals reports pages with no catalog entry, case-insensitively", () => {
  assert.deepEqual(
    findPendingRemovals(["/projects/A/One", "/projects/b/two", "/projects/d/gone"], repos),
    ["/projects/d/gone"],
  );
});
