import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { JSDOM } from "jsdom";

// The /ecosystem/ catalog page is fully generated from data/repos.json +
// data/categories.json (the homepage catalog's replacement). These tests run
// against the committed artifact: every repo renders exactly once, category
// counts match the data, hand-curated blurbs win over GitHub descriptions,
// and the search/sort controls behave like the homepage originals they
// replaced (progressive enhancement contract included).

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "ecosystem", "index.html"), "utf8");
const repos = JSON.parse(
  fs.readFileSync(path.join(ROOT, "data", "repos.json"), "utf8"),
);
const categories = JSON.parse(
  fs.readFileSync(path.join(ROOT, "data", "categories.json"), "utf8"),
);
const appJs = fs.readFileSync(
  path.join(ROOT, "assets", "js", "ecosystem.js"),
  "utf8",
);

function loadPage({ runScripts = true } = {}) {
  const window = new JSDOM(html, {
    url: "https://hermesatlas.com/ecosystem/",
    runScripts: "dangerously",
    beforeParse(window) {
      window.fetch = () => Promise.reject(new Error("network disabled in test"));
    },
  }).window;
  if (runScripts) {
    window.eval(appJs);
  }
  return window;
}

test("every catalog repo renders exactly one row", () => {
  const { document } = loadPage({ runScripts: false });
  const hrefs = Array.from(document.querySelectorAll("a.repo-row")).map((a) =>
    a.getAttribute("href"),
  );
  assert.equal(hrefs.length, repos.length, "one row per repos.json entry");
  assert.equal(new Set(hrefs).size, hrefs.length, "no duplicate rows");
  for (const r of repos) {
    assert.ok(
      hrefs.includes(`/projects/${r.owner}/${r.repo}`),
      `missing row for ${r.owner}/${r.repo}`,
    );
  }
});

test("all 12 category sections render in categories.json order with correct counts", () => {
  const { document } = loadPage({ runScripts: false });
  const sections = Array.from(document.querySelectorAll("section.cat"));
  assert.equal(sections.length, categories.length);
  sections.forEach((sec, i) => {
    const cat = categories[i];
    assert.equal(sec.getAttribute("data-category"), cat.category);
    const expected = repos.filter((r) => r.category === cat.category).length;
    assert.equal(
      parseInt(sec.querySelector(".cat-count-n").textContent, 10),
      expected,
      `count for ${cat.category}`,
    );
    assert.equal(sec.querySelectorAll("a.repo-row").length, expected);
  });
});

test("hand-curated blurbs win over GitHub descriptions in rendered rows", () => {
  const { document } = loadPage({ runScripts: false });
  const withBlurb = repos.filter((r) => r.blurb);
  assert.ok(withBlurb.length > 0, "expected at least one blurb in repos.json");
  for (const r of withBlurb) {
    const row = document.querySelector(
      `a.repo-row[href="/projects/${r.owner}/${r.repo}"]`,
    );
    assert.ok(row, `row missing for ${r.owner}/${r.repo}`);
    assert.equal(row.getAttribute("data-desc"), r.blurb);
    assert.ok(
      row.querySelector(".repo-desc").textContent.startsWith(r.blurb.replace(/\.$/, "")),
      `rendered desc for ${r.owner}/${r.repo} should use the blurb`,
    );
  }
});

test("rows within each category are sorted by stars descending (no-JS order)", () => {
  const { document } = loadPage({ runScripts: false });
  const starsByKey = new Map(
    repos.map((r) => [`/projects/${r.owner}/${r.repo}`, r.stars || 0]),
  );
  for (const list of document.querySelectorAll(".cat-list")) {
    const stars = Array.from(list.querySelectorAll("a.repo-row")).map((a) =>
      starsByKey.get(a.getAttribute("href")),
    );
    const sorted = [...stars].sort((a, b) => b - a);
    assert.deepEqual(stars, sorted);
  }
});

test("catalog controls are progressive enhancement: hidden without JS, revealed with JS", () => {
  const noJs = loadPage({ runScripts: false });
  assert.equal(noJs.document.getElementById("catalog-controls").hidden, true);

  const withJs = loadPage();
  assert.equal(withJs.document.getElementById("catalog-controls").hidden, false);
});

test("filter narrows visible rows and clearing restores all", () => {
  const window = loadPage();
  const { document } = window;

  const rows = Array.from(document.querySelectorAll(".repo-row"));
  assert.ok(rows.length > 100, `expected a populated catalog, got ${rows.length} rows`);
  const visibleCount = () => rows.filter((r) => r.style.display !== "none").length;

  assert.equal(visibleCount(), rows.length);

  const search = document.getElementById("catalog-search");
  search.value = "memory";
  search.dispatchEvent(new window.Event("input", { bubbles: true }));

  const narrowed = visibleCount();
  assert.ok(narrowed > 0, "filter should match at least one row");
  assert.ok(narrowed < rows.length, "filter should hide non-matching rows");

  search.value = "";
  search.dispatchEvent(new window.Event("input", { bubbles: true }));
  assert.equal(visibleCount(), rows.length);
});

test("page head is self-describing: canonical, Dataset JSON-LD, no chat widget", () => {
  const { document } = loadPage({ runScripts: false });
  assert.equal(
    document.querySelector('link[rel="canonical"]').getAttribute("href"),
    "https://hermesatlas.com/ecosystem/",
  );
  const ldBlocks = Array.from(
    document.querySelectorAll('script[type="application/ld+json"]'),
  ).map((s) => JSON.parse(s.textContent));
  assert.ok(
    ldBlocks.some((b) => b["@type"] === "Dataset"),
    "Dataset JSON-LD present",
  );
  // Chat stays homepage-only.
  assert.equal(document.getElementById("chat-panel"), null);
});
