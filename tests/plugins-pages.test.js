import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

// Generated-output assertions for the Plugins Hub, in the style of
// tests/skills-pages.test.js: /plugins/ is templated inside build-pages.js, so
// the committed HTML on disk is the artifact worth guarding.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf-8");
const readJson = (rel) => JSON.parse(read(rel));

const repos = readJson("data/repos.json");
const plugins = readJson("data/plugins.json");
const html = read("plugins/index.html");
const { document } = new JSDOM(html).window;

const repoIndex = new Map(repos.map((r) => [`${r.owner}/${r.repo}`.toLowerCase(), r]));

test("plugins hub is canonical, templated, and has JSON-LD", () => {
  assert.ok(html.includes('<link rel="canonical" href="https://hermesatlas.com/plugins/">'));
  assert.ok(html.includes('class="masthead"'), "hub uses the shared masthead");
  const ld = [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent));
  const types = ld.map((n) => n["@type"]);
  assert.ok(types.includes("BreadcrumbList"), "BreadcrumbList JSON-LD");
  const collection = ld.find((n) => n["@type"] === "CollectionPage");
  assert.equal(collection?.mainEntity?.["@type"], "ItemList", "ItemList JSON-LD");
  assert.equal(collection.mainEntity.numberOfItems, plugins.plugins.length);
  assert.match(document.title, /^Best Hermes Agent Plugins \(\w+ \d{4}\): Curated Picks by Use Case \| Hermes Atlas$/);
});

test("hub renders a card for every curated plugin, with its catalog install", () => {
  for (const p of plugins.plugins) {
    const card = document.querySelector(`article[data-plugin="${p.name}"]`);
    assert.ok(card, `card for ${p.name}`);
    assert.equal(card.querySelector("code.sk-install")?.textContent, p.install, `${p.name} install`);
    assert.ok(card.querySelector(`a[href="https://github.com/${p.repo}"]`), `${p.name} links its GitHub repo`);
    if (p.caveat) assert.ok(card.querySelector(".pl-caveat"), `${p.name} shows its caveat`);
    if (p.requiresHermes) {
      assert.ok(card.textContent.includes(`Requires Hermes ${p.requiresHermes}`), `${p.name} shows requiresHermes`);
    }
  }
});

test("each group has one hero for its topPick, and none without one", () => {
  for (const group of plugins.useCases) {
    const section = document.getElementById(group.slug);
    assert.ok(section, `section for ${group.slug}`);
    const heroes = section.querySelectorAll(".pl-hero");
    const topPick = plugins.plugins.find((p) => p.topPick && p.useCases.includes(group.slug));
    assert.equal(heroes.length, topPick ? 1 : 0, `${group.slug} hero count`);
    if (topPick) assert.equal(heroes[0].dataset.plugin, topPick.name, `${group.slug} hero is the topPick`);
  }
});

test("Atlas project links appear only for repos in data/repos.json, with repos.json casing", () => {
  const projectLinks = [...document.querySelectorAll('a[href^="/projects/"]')].map((a) => a.getAttribute("href"));
  for (const href of projectLinks) {
    const [, , owner, repo] = href.split("/");
    assert.ok(
      repos.some((r) => r.owner === owner && r.repo === repo),
      `${href} must be an Atlas catalog project`
    );
  }
  for (const p of plugins.plugins) {
    const card = document.querySelector(`article[data-plugin="${p.name}"]`);
    const catalog = repoIndex.get(p.repo.toLowerCase());
    const link = card.querySelector('a[href^="/projects/"]');
    if (catalog) {
      assert.equal(link?.getAttribute("href"), `/projects/${catalog.owner}/${catalog.repo}`, `${p.name} links its Atlas page`);
    } else {
      assert.equal(link, null, `${p.name} has no Atlas page to link`);
    }
  }
});

test("freshness line, memory callout, skipped list and cross-links render", () => {
  const stamp = document.querySelector("p.sk-freshness")?.textContent || "";
  assert.ok(stamp.includes(`Checked against the official catalog on ${plugins.catalogCheckedAt}.`));
  assert.equal(
    stamp.includes("the Atlas has not install-tested these"),
    plugins.testedAgainst === null,
    "untested disclaimer shows exactly when testedAgainst is null"
  );
  assert.ok(html.includes(`lists ${plugins.catalogEntries.toLocaleString("en-US")} plugins`), "states catalog size");
  // Stale notice fires on a new minor release only, not a patch release.
  const latest = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "latest-release.json"), "utf-8")).version;
  const minor = (v) => String(v).replace(/^v/, "").split(".").slice(0, 2).join(".");
  if (plugins.testedAgainst) {
    assert.equal(
      stamp.includes("re-verification pending"),
      minor(plugins.testedAgainst) !== minor(latest),
      "stale notice shows exactly when the tested minor version is behind the latest release"
    );
  }

  const callout = document.querySelector(".pl-callout");
  assert.ok(callout?.textContent.includes("Memory providers are deliberately not listed"));
  assert.ok(callout.querySelector('a[href="/guide/memory/"]'));
  assert.ok(callout.querySelector('a[href="/lists/best-memory-providers"]'));

  const skipped = [...document.querySelectorAll(".pl-skipped li")].map((li) => li.textContent);
  assert.deepEqual(skipped, plugins.skipped);

  for (const href of ["/guide/plugins/", "/skills/", "https://hermes-agent.nousresearch.com/docs/plugins"]) {
    assert.ok(document.querySelector(`a[href="${href}"]`), `hub links ${href}`);
  }
});

test("skills hub, ecosystem, sitemap and llms files point at /plugins/", () => {
  assert.match(read("skills/index.html"), /<a href="\/plugins\/">The Plugins Hub<\/a>/);
  assert.match(read("ecosystem/index.html"), /Looking for plugins\? <a href="\/plugins\/">Curated picks →<\/a>/);
  assert.ok(read("sitemap.xml").includes("<loc>https://hermesatlas.com/plugins/</loc>"));
  assert.ok(read("llms.txt").includes("[Hermes Plugins Hub](https://hermesatlas.com/plugins/)"));
  assert.ok(read("llms-full.txt").includes("# Plugins Hub (/plugins/)"));
});
