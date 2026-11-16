import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { JSDOM } from "jsdom";

// /guide/plugins/ is a hand-authored handbook page targeting the "hermes
// agent plugins" / "hermes plugin not loading" queries. These tests pin the
// contract: guide-page anatomy (Article + FAQPage + BreadcrumbList JSON-LD,
// current-version masthead + freshness phrasing, comparison tables, CSP),
// internal links resolve, FAQ JSON-LD mirrors the visible FAQ, the page is
// wired into the handbook hub, and its draft stays registered for RAG.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const version = JSON.parse(read("data/latest-release.json")).version;
const PAGE = "guide/plugins/index.html";
const norm = (s) => s.replace(/\s+/g, " ").trim();

const ldBlocks = (document) =>
  Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map((s) =>
    JSON.parse(s.textContent),
  );

test(`${PAGE} has the guide-page anatomy`, () => {
  const html = read(PAGE);
  const { document } = new JSDOM(html).window;

  assert.equal(
    document.querySelector('link[rel="canonical"]').getAttribute("href"),
    "https://hermesatlas.com/guide/plugins/",
  );
  assert.equal(document.querySelectorAll("h1").length, 1);

  const types = ldBlocks(document).map((b) => b["@type"]);
  for (const t of ["Article", "FAQPage", "BreadcrumbList"]) {
    assert.ok(types.includes(t), `${t} JSON-LD present`);
  }

  assert.ok(document.querySelector("header.masthead"), "masthead present");
  assert.ok(html.includes(`hermes·${version}`), "masthead version is current");
  // Freshness pass (build-pages.js factRules) re-stamps this exact phrasing.
  assert.match(html, new RegExp(`Current release is ${version.replace(/\./g, "\\.")} \\(as of \\d{4}-\\d{2}-\\d{2}\\)`));
  assert.ok(document.querySelector("main.article"), "article layout");
  assert.ok(document.querySelectorAll(".article-table-scroll table").length >= 2, "comparison tables present");
  assert.ok(document.querySelector("#theme-toggle"), "theme toggle present");
  assert.ok(document.querySelector('.article-header a[href="https://x.com/ksimback"]'), "byline links to X");

  // CSP contract: no inline executable scripts, no style attrs/elements.
  for (const s of document.querySelectorAll("script")) {
    assert.ok(
      s.getAttribute("src") || s.getAttribute("type") === "application/ld+json",
      "no inline executable scripts",
    );
  }
  assert.equal(document.querySelectorAll("style, [style]").length, 0, "no inline styles");

  // In-page anchors resolve.
  for (const a of document.querySelectorAll('a[href^="#"]')) {
    assert.ok(document.getElementById(a.getAttribute("href").slice(1)), `anchor ${a.getAttribute("href")} exists`);
  }

  // External official-docs links open in a new tab.
  for (const a of document.querySelectorAll('a[href^="https://hermes-agent.nousresearch.com/docs/"]')) {
    assert.equal(a.getAttribute("target"), "_blank");
    assert.equal(a.getAttribute("rel"), "noopener");
  }
});

test(`${PAGE} internal links resolve to files on disk`, () => {
  const { document } = new JSDOM(read(PAGE)).window;
  const hrefs = new Set();
  for (const a of document.querySelectorAll("a[href]")) {
    const href = a.getAttribute("href") || "";
    if (href.startsWith("/") && !href.startsWith("//")) hrefs.add(href.split("#")[0].split("?")[0]);
  }
  for (const required of ["/guide/memory/", "/guide/desktop/", "/skills/", "/ecosystem/", "/dev/building-on-hermes"]) {
    assert.ok(hrefs.has(required), `links ${required}`);
  }
  for (const href of hrefs) {
    if (!href || href === "/") continue;
    const relPath = href.replace(/^\//, "").replace(/\/$/, "");
    const candidates = [
      path.join(ROOT, relPath, "index.html"),
      path.join(ROOT, `${relPath}.html`),
      path.join(ROOT, relPath),
    ];
    assert.ok(candidates.some((p) => fs.existsSync(p)), `${PAGE} links ${href} but no file exists for it`);
  }
});

test(`${PAGE} FAQ JSON-LD matches the visible FAQ`, () => {
  const { document } = new JSDOM(read(PAGE)).window;
  const faq = ldBlocks(document).find((b) => b["@type"] === "FAQPage");
  const faqHeading = document.getElementById("frequently-asked-questions");
  const pairs = [];
  for (let el = faqHeading.nextElementSibling; el; el = el.nextElementSibling) {
    if (el.tagName === "H3") pairs.push({ q: norm(el.textContent), a: norm(el.nextElementSibling.textContent) });
  }
  assert.ok(faq.mainEntity.length >= 5, "at least five FAQ entries");
  assert.equal(faq.mainEntity.length, pairs.length, "same number of Q&As in JSON-LD and body");
  faq.mainEntity.forEach((entry, i) => {
    assert.equal(entry.name, pairs[i].q, "question text matches");
    // JSON-LD uses backticks for code; the body renders <code>.
    assert.equal(norm(entry.acceptedAnswer.text.replace(/`/g, "")), pairs[i].a, `answer to "${entry.name}" matches`);
  });
});

test("plugins guide is wired into the handbook, dev tutorial and RAG", () => {
  assert.ok(read("guide/index.html").includes('href="/guide/plugins/"'), "handbook hub links it");
  assert.ok(read("guide/desktop/index.html").includes('href="/guide/plugins/"'), "desktop guide links it");
  assert.ok(read("dev/building-on-hermes.html").includes('href="/guide/plugins/"'), "dev tutorial links it");
  const chunks = read("scripts/build-chunks.js");
  assert.ok(chunks.includes('{ file: "guide-plugins.md", source: "guide/plugins/" }'), "registered in guideSources");
  assert.ok(fs.existsSync(path.join(ROOT, "drafts", "guide-plugins.md")), "draft exists");
  const pages = read("scripts/build-pages.js");
  assert.ok(pages.includes("${SITE_URL}/guide/plugins/):"), "llms.txt Guide bullet");
  assert.ok(pages.includes('"guide-plugins.md"'), "llms-full section");
});

test("desktop guide no longer denies a Desktop plugin format", () => {
  for (const rel of ["guide/desktop/index.html", "drafts/guide-desktop.md"]) {
    const src = read(rel);
    assert.ok(!/no separate .?desktop plugin.? format/i.test(src), `${rel} drops the old claim`);
    assert.ok(src.includes("@hermes/plugin-sdk"), `${rel} names the Desktop plugin SDK`);
  }
});
