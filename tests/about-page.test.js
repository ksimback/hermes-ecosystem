import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf-8");
const text = (html) => html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

test("about page FAQ JSON-LD matches the visible FAQ word for word", () => {
  const html = read("about/index.html");
  const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(ld, "about page has JSON-LD");
  const faq = JSON.parse(ld[1]);
  assert.equal(faq["@type"], "FAQPage");
  assert.ok(faq.mainEntity.length >= 5, "FAQ has entries");

  // Search engines reject FAQ markup whose answers differ from the page text.
  const visible = [...html.matchAll(/<h3>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>/g)]
    .map(([, q, a]) => ({ q: text(q), a: text(a) }));
  assert.deepEqual(
    faq.mainEntity.map((e) => ({ q: e.name, a: e.acceptedAnswer.text })),
    visible,
  );
  assert.doesNotMatch(html, /\[(CONFIRM|ADD):/, "no unfilled template markers");
});

test("about page is canonical, in the sitemap and llms.txt, and linked from the footer", () => {
  const html = read("about/index.html");
  assert.match(html, /<link rel="canonical" href="https:\/\/hermesatlas\.com\/about">/);
  assert.match(read("sitemap.xml"), /<loc>https:\/\/hermesatlas\.com\/about<\/loc>/);
  assert.match(read("llms.txt"), /\[About Hermes Atlas\]\(https:\/\/hermesatlas\.com\/about\)/);
  for (const rel of ["index.html", "ecosystem/index.html", "about/index.html"]) {
    assert.match(read(rel), /<div class="fn-left">[^\n]*<a href="\/about">about<\/a>/, `${rel} footer links /about`);
  }
});
