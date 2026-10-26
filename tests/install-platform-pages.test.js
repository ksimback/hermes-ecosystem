import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { JSDOM } from "jsdom";

// The per-platform install split (/guide/install/<platform>/) targets the
// highest-impression GSC page on the site (/guide/install/: 157K impressions
// at 0.85% CTR) with one page per query shape — Windows, macOS, Linux,
// Raspberry Pi, VPS. These tests pin the contract: each satellite has the
// guide-page anatomy (Article + FAQPage + BreadcrumbList JSON-LD,
// current-version masthead, a table, CSP-clean markup), internal links
// resolve, the hub keeps its HowTo anchor IDs and routes to every satellite,
// the sitemap reaches the nested pages, and the RAG drafts stay registered.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const version = JSON.parse(read("data/latest-release.json")).version;

const PLATFORMS = ["windows", "macos", "linux", "raspberry-pi", "vps"];
const PAGES = PLATFORMS.map((p) => `guide/install/${p}/index.html`);

for (const rel of PAGES) {
  test(`${rel} has the guide-page anatomy`, () => {
    const html = read(rel);
    const { document } = new JSDOM(html).window;

    const canonical = document.querySelector('link[rel="canonical"]');
    assert.ok(canonical, "canonical present");
    assert.match(
      canonical.getAttribute("href"),
      /^https:\/\/hermesatlas\.com\/guide\/install\/(windows|macos|linux|raspberry-pi|vps)\/$/,
    );

    const ldTypes = Array.from(
      document.querySelectorAll('script[type="application/ld+json"]'),
    ).map((s) => JSON.parse(s.textContent)["@type"]);
    for (const t of ["Article", "FAQPage", "BreadcrumbList"]) {
      assert.ok(ldTypes.includes(t), `${t} JSON-LD present`);
    }

    assert.ok(document.querySelector("header.masthead"), "masthead present");
    assert.ok(html.includes(`hermes·${version}`), "masthead version is current");
    assert.ok(document.querySelector("main.article"), "article layout");
    assert.ok(document.querySelector(".article-table-scroll table"), "table present");
    assert.ok(document.querySelector("#theme-toggle"), "theme toggle present");

    // CSP contract: no inline executable scripts, no style attrs.
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

  test(`${rel} links back to the install hub`, () => {
    const { document } = new JSDOM(read(rel)).window;
    const hubLink = Array.from(document.querySelectorAll('a[href^="/guide/install/"]')).find(
      (a) => a.getAttribute("href").split("#")[0] === "/guide/install/",
    );
    assert.ok(hubLink, "page links to /guide/install/");
  });
}

test("install hub routes to every platform page and keeps its HowTo anchors", () => {
  const html = read("guide/install/index.html");
  const { document } = new JSDOM(html).window;

  for (const p of PLATFORMS) {
    const link = document.querySelector(`a[href="/guide/install/${p}/"]`);
    assert.ok(link, `hub links to /guide/install/${p}/`);
  }

  // The hub's HowTo JSON-LD steps anchor to these fragments; the platform
  // pages deep-link #verify/#first-run/#troubleshooting. Keep them stable.
  for (const id of ["install-macos", "install-linux", "install-windows", "verify", "first-run", "troubleshooting"]) {
    assert.ok(document.getElementById(id), `hub keeps #${id}`);
  }
});

test("sitemap reaches the nested install pages", () => {
  const sitemap = read("sitemap.xml");
  for (const p of PLATFORMS) {
    assert.ok(
      sitemap.includes(`https://hermesatlas.com/guide/install/${p}/`),
      `sitemap.xml contains /guide/install/${p}/`,
    );
  }
});

test("install drafts are registered as RAG guide sources", () => {
  const chunks = read("scripts/build-chunks.js");
  for (const p of PLATFORMS) {
    const file = `guide-install-${p}.md`;
    const source = `guide/install/${p}/`;
    assert.ok(chunks.includes(`"${file}"`), `${file} in guideSources`);
    assert.ok(chunks.includes(`"${source}"`), `${source} label in guideSources`);
    assert.ok(fs.existsSync(path.join(ROOT, "drafts", file)), `drafts/${file} exists`);
  }
});

test("install drafts trigger the chunk rebuild workflow", () => {
  const workflow = read(".github/workflows/rebuild-chunks.yml");
  for (const p of PLATFORMS) {
    assert.ok(
      workflow.includes(`drafts/guide-install-${p}.md`),
      `rebuild-chunks.yml triggers on drafts/guide-install-${p}.md`,
    );
  }
});
