import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { JSDOM } from "jsdom";

// The mode decision hub (/guide/modes/) and its desktop satellite
// (/guide/desktop/) are hand-authored pages targeting the largest unserved
// GSC queries ("hermes desktop": 13K impressions). These tests pin the
// contract: pages exist with the guide-page anatomy (Article + FAQPage +
// BreadcrumbList JSON-LD, current-version masthead, comparison tables),
// their internal links resolve, the homepage mode door points at the hub,
// and their RAG drafts stay registered in build-chunks.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const version = JSON.parse(read("data/latest-release.json")).version;

const PAGES = ["guide/modes/index.html", "guide/desktop/index.html"];

for (const rel of PAGES) {
  test(`${rel} has the guide-page anatomy`, () => {
    const html = read(rel);
    const { document } = new JSDOM(html).window;

    const canonical = document.querySelector('link[rel="canonical"]');
    assert.ok(canonical, "canonical present");
    assert.match(canonical.getAttribute("href"), /^https:\/\/hermesatlas\.com\/guide\/(modes|desktop)\/$/);

    const ldTypes = Array.from(
      document.querySelectorAll('script[type="application/ld+json"]'),
    ).map((s) => JSON.parse(s.textContent)["@type"]);
    for (const t of ["Article", "FAQPage", "BreadcrumbList"]) {
      assert.ok(ldTypes.includes(t), `${t} JSON-LD present`);
    }

    assert.ok(document.querySelector("header.masthead"), "masthead present");
    assert.ok(html.includes(`hermes·${version}`), "masthead version is current");
    assert.ok(document.querySelector("main.article"), "article layout");
    assert.ok(document.querySelector(".article-table-scroll table"), "comparison table present");
    assert.ok(document.querySelector("#theme-toggle"), "theme toggle present");

    // CSP contract: no inline executable scripts, no style attrs, no on* handlers.
    for (const s of document.querySelectorAll("script")) {
      assert.ok(
        s.getAttribute("src") || s.getAttribute("type") === "application/ld+json",
        "no inline executable scripts",
      );
    }
    assert.equal(document.querySelectorAll("[style]").length, 0, "no style attributes");
  });

  test(`${rel} internal links resolve to files on disk`, () => {
    const { document } = new JSDOM(read(rel)).window;
    const hrefs = new Set();
    for (const a of document.querySelectorAll("a[href]")) {
      const href = a.getAttribute("href") || "";
      if (href.startsWith("/") && !href.startsWith("//")) {
        hrefs.add(href.split("#")[0].split("?")[0]);
      }
    }
    for (const href of hrefs) {
      if (!href || href === "/") continue;
      const relPath = href.replace(/^\//, "").replace(/\/$/, "");
      const candidates = [
        path.join(ROOT, relPath, "index.html"),
        path.join(ROOT, `${relPath}.html`),
        path.join(ROOT, relPath),
      ];
      assert.ok(
        candidates.some((p) => fs.existsSync(p)),
        `${rel} links ${href} but no file exists for it`,
      );
    }
  });

  test(`${rel} FAQ JSON-LD questions appear on the page`, () => {
    const html = read(rel);
    const { document } = new JSDOM(html).window;
    const faq = Array.from(
      document.querySelectorAll('script[type="application/ld+json"]'),
    )
      .map((s) => JSON.parse(s.textContent))
      .find((b) => b["@type"] === "FAQPage");
    assert.ok(faq.mainEntity.length >= 5, "at least five FAQ entries");
    for (const q of faq.mainEntity) {
      assert.ok(
        html.includes(q.name.replace(/&/g, "&amp;").slice(0, 30)) || html.includes(q.name.slice(0, 30)),
        `FAQ question "${q.name}" appears in the page body`,
      );
    }
  });
}

test("homepage 'pick your mode' door routes to /guide/modes/", () => {
  const { document } = new JSDOM(read("index.html")).window;
  const link = Array.from(document.querySelectorAll(".door-links a")).find((a) =>
    /pick your mode/i.test(a.textContent),
  );
  assert.ok(link, "mode door link exists");
  assert.equal(link.getAttribute("href"), "/guide/modes/");
});

test("mode drafts are registered as RAG guide sources", () => {
  const chunks = read("scripts/build-chunks.js");
  for (const [file, source] of [
    ["guide-modes.md", "guide/modes/"],
    ["guide-desktop.md", "guide/desktop/"],
    ["guide-memory.md", "guide/memory/"],
  ]) {
    assert.ok(chunks.includes(`"${file}"`), `${file} in guideSources`);
    assert.ok(chunks.includes(`"${source}"`), `${source} label in guideSources`);
    assert.ok(fs.existsSync(path.join(ROOT, "drafts", file)), `drafts/${file} exists`);
  }
});
