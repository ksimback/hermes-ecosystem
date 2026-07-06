import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { JSDOM } from "jsdom";

// Regression tests for PR #476: the catalog controls (#471) are the single
// search/sort surface on the homepage. The old header controls must stay gone,
// and the catalog controls must keep working (reveal, filter, sort) — verified
// here the same way #476 was verified pre-merge, but committed.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
// The homepage app was externalized (CSP stage A: no inline scripts). jsdom
// does not fetch external <script src> tags, so we read the app bundle and run
// it manually via window.eval() after construction. The DOM is fully parsed by
// then, which matches the `defer` semantics the real page relies on.
const appJs = fs.readFileSync(
  path.join(__dirname, "..", "assets", "js", "homepage.js"),
  "utf8",
);

function loadHomepage({ runScripts = true } = {}) {
  const window = new JSDOM(html, {
    url: "https://hermesatlas.com/",
    // Always "dangerously" so window.eval is available and the src-only theme
    // scripts parse cleanly (they don't fetch — fine). No inline scripts remain
    // in the page, so nothing executes on its own; the app runs only when we
    // eval it below.
    runScripts: "dangerously",
    beforeParse(window) {
      // API calls (stars, version) are irrelevant here and both callers
      // catch failures; keep the test hermetic.
      window.fetch = () => Promise.reject(new Error("network disabled in test"));
    },
  }).window;
  if (runScripts) {
    window.eval(appJs);
  }
  return window;
}

test("old header search/sort controls stay absent (removed in #476)", () => {
  const { document } = loadHomepage({ runScripts: false });

  assert.equal(document.getElementById("search-input"), null);
  assert.equal(document.getElementById("result-count"), null);
  assert.equal(document.querySelector(".sort-btn"), null);
});

test("catalog controls are the single search/sort surface", () => {
  const { document } = loadHomepage({ runScripts: false });

  const searches = document.querySelectorAll('input[type="search"]');
  assert.equal(searches.length, 1, "exactly one search input on the page");
  assert.equal(searches[0].id, "catalog-search");

  const sorts = document.querySelectorAll("select");
  assert.equal(sorts.length, 1, "exactly one sort control on the page");
  assert.equal(sorts[0].id, "catalog-sort");
});

test("catalog controls are progressive enhancement: hidden without JS, revealed with JS", () => {
  const noJs = loadHomepage({ runScripts: false });
  assert.equal(noJs.document.getElementById("catalog-controls").hidden, true);

  const withJs = loadHomepage();
  assert.equal(withJs.document.getElementById("catalog-controls").hidden, false);
});

test("filter narrows visible rows and clearing restores all", () => {
  const window = loadHomepage();
  const { document } = window;

  const rows = Array.from(document.querySelectorAll(".repo-row"));
  assert.ok(rows.length > 100, `expected a populated catalog, got ${rows.length} rows`);
  const visibleCount = () =>
    rows.filter((r) => r.style.display !== "none").length;

  assert.equal(visibleCount(), rows.length);

  const search = document.getElementById("catalog-search");
  search.value = "hermes-workspace";
  search.dispatchEvent(new window.Event("input", { bubbles: true }));

  const narrowed = visibleCount();
  assert.ok(narrowed > 0, "filter should match at least one row");
  assert.ok(narrowed < rows.length, "filter should hide non-matching rows");
  assert.match(
    document.getElementById("catalog-result-count").textContent,
    /^\d+ match(es)?$/,
  );

  search.value = "";
  search.dispatchEvent(new window.Event("input", { bubbles: true }));
  assert.equal(visibleCount(), rows.length);
  assert.equal(
    document.getElementById("catalog-result-count").textContent,
    "",
  );
});

test("sort reorders rows within each category (stars desc, name asc)", () => {
  const window = loadHomepage();
  const { document } = window;
  const sortSel = document.getElementById("catalog-sort");
  const lists = Array.from(document.querySelectorAll(".cat-list"));
  assert.ok(lists.length > 0, "expected category lists");

  // Initial sort on load is by stars (applySort() runs in init).
  const starsOf = (row) => parseInt(row.getAttribute("data-stars"), 10) || 0;
  for (const list of lists) {
    const stars = Array.from(list.querySelectorAll(".repo-row")).map(starsOf);
    const sorted = [...stars].sort((a, b) => b - a);
    assert.deepEqual(stars, sorted, "rows should be sorted by stars descending");
  }

  sortSel.value = "name";
  sortSel.dispatchEvent(new window.Event("change", { bubbles: true }));
  const nameOf = (row) => (row.getAttribute("href") || "").toLowerCase();
  for (const list of lists) {
    const names = Array.from(list.querySelectorAll(".repo-row")).map(nameOf);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    assert.deepEqual(names, sorted, "rows should be sorted by name ascending");
  }
});
