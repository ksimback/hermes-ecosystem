import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Generated-output assertions, in the style of tests/seo-pages.test.js: the
// Skills Hub is templated inside build-pages.js, so the committed HTML on disk
// is the artifact worth guarding. These fail if a rebuild drops the freshness
// stamp, loses catalog coverage, or breaks /lists/top-skills — the crown-jewel
// URL the hub is built to defend rather than replace.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf-8");
const readJson = (rel) => JSON.parse(read(rel));

const repos = readJson("data/repos.json");
const skills = readJson("data/skills.json");
const latestRelease = readJson("data/latest-release.json");

const SKILLS_CATEGORY = "Skills & Skill Registries";
const catalog = repos.filter((r) => r.category === SKILLS_CATEGORY);
const enrichedKeys = new Set(skills.skills.map((s) => `${s.owner}/${s.repo}`));

test("skills hub is canonical, templated, and carries the honest freshness stamp", () => {
  const html = read("skills/index.html");

  assert.ok(
    html.includes('<link rel="canonical" href="https://hermesatlas.com/skills/">'),
    "hub declares its canonical URL"
  );
  assert.ok(html.includes('class="masthead"'), "hub uses the shared masthead");
  assert.ok(html.includes("application/ld+json"), "hub has JSON-LD");

  const stamp = html.match(/<p class="sk-freshness">([\s\S]*?)<\/p>/);
  assert.ok(stamp, "hub renders a freshness stamp");
  assert.ok(
    stamp[1].includes(`Updated ${skills.updatedAt}`),
    "stamp shows data/skills.json updatedAt, not build day"
  );
  assert.ok(
    stamp[1].includes(`tested against Hermes ${skills.testedAgainst}`),
    "stamp shows the version the picks were verified against"
  );

  // The stale warning is the whole point of the stamp: it must appear exactly
  // when the catalog's Hermes release has moved past the last curation pass.
  const isStale = skills.testedAgainst !== latestRelease.version;
  assert.equal(
    stamp[1].includes("re-verification pending"),
    isStale,
    isStale
      ? `stamp must flag that Hermes ${latestRelease.version} is out`
      : "stamp must not claim re-verification is pending when it isn't"
  );
});

test("skills hub lists every repo in the skills catalog, enriched or not", () => {
  const html = read("skills/index.html");
  assert.ok(catalog.length > 0, "catalog category is non-empty");
  for (const r of catalog) {
    assert.ok(
      html.includes(`href="/projects/${r.owner}/${r.repo}"`),
      `hub links /projects/${r.owner}/${r.repo}`
    );
  }
  assert.ok(
    html.includes(`the full catalog — ${catalog.length} projects`),
    "hub states the live catalog size"
  );
});

test("skills hub links the ranked list and every per-use-case page", () => {
  const html = read("skills/index.html");
  assert.ok(html.includes('href="/lists/top-skills"'), "hub links the ranked list");
  for (const group of skills.useCases) {
    assert.ok(
      html.includes(`href="/skills/for-${group.slug}"`),
      `hub links /skills/for-${group.slug}`
    );
  }
});

test("each /skills/for-* page is canonical, ranked, and carries FAQ JSON-LD", () => {
  for (const group of skills.useCases) {
    const rel = `skills/for-${group.slug}.html`;
    const html = read(rel);

    assert.ok(
      html.includes(`<link rel="canonical" href="https://hermesatlas.com/skills/for-${group.slug}">`),
      `${rel} has a canonical URL`
    );
    assert.ok(html.includes(group.title), `${rel} uses the group title as its h1`);

    const ldBlocks = [...html.matchAll(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/g)]
      .map((m) => JSON.parse(m[1]));
    const faq = ldBlocks.find((node) => node["@type"] === "FAQPage");
    assert.ok(faq, `${rel} emits FAQPage JSON-LD`);
    assert.ok(faq.mainEntity.length >= 2, `${rel} FAQ has at least 2 questions`);
    assert.ok(
      faq.mainEntity.some((q) => /how do i install/i.test(q.name)),
      `${rel} answers the install question`
    );
    for (const q of faq.mainEntity) {
      assert.ok(q.acceptedAnswer?.text?.length > 0, `${rel} FAQ answers are non-empty`);
    }

    // Every curated entry in the group must be present with its install command.
    const members = skills.skills.filter((s) => s.useCases.includes(group.slug));
    assert.ok(members.length >= 2, `${group.slug} has at least 2 picks`);
    for (const s of members) {
      assert.ok(
        html.includes(`href="/projects/${s.owner}/${s.repo}"`),
        `${rel} links /projects/${s.owner}/${s.repo}`
      );
    }
    assert.ok(html.includes("how we picked"), `${rel} discloses the curation method`);
  }
});

test("install box appears on curated project pages and nowhere else", () => {
  const enriched = skills.skills[0];
  const enrichedHtml = read(`projects/${enriched.owner}/${enriched.repo}.html`);
  assert.ok(
    enrichedHtml.includes('class="install-box"'),
    `${enriched.owner}/${enriched.repo} renders the install box`
  );
  assert.ok(enrichedHtml.includes('class="ib-cmd"'), "install box shows the command");
  assert.ok(enrichedHtml.includes('href="/skills/"'), "install box links back to the hub");

  const plain = repos.find((r) => !enrichedKeys.has(`${r.owner}/${r.repo}`));
  assert.ok(plain, "at least one repo has no curated skills entry");
  assert.ok(
    !read(`projects/${plain.owner}/${plain.repo}.html`).includes('class="install-box"'),
    `${plain.owner}/${plain.repo} must not render an install box`
  );
});

test("/lists/top-skills keeps its full ranked table and gains only a hub link", () => {
  const html = read("lists/top-skills.html");

  assert.ok(
    html.includes('<link rel="canonical" href="https://hermesatlas.com/lists/top-skills">'),
    "top-skills canonical unchanged"
  );
  assert.ok(html.includes('class="list-table"'), "ranked table still present");
  const rows = html.match(/<a class="list-row" href="\/projects\//g) || [];
  assert.equal(rows.length, catalog.length, "every skills repo still ranked on top-skills");
  assert.ok(html.includes('href="/skills/"'), "top-skills links into the hub");
});

test("sitemap and llms.txt advertise the skills hub", () => {
  const sitemap = read("sitemap.xml");
  assert.ok(sitemap.includes("<loc>https://hermesatlas.com/skills/</loc>"), "/skills/ in sitemap");
  for (const group of skills.useCases) {
    assert.ok(
      sitemap.includes(`<loc>https://hermesatlas.com/skills/for-${group.slug}</loc>`),
      `sitemap has /skills/for-${group.slug}`
    );
  }

  const llms = read("llms.txt");
  assert.ok(llms.includes("## Skills"), "llms.txt has a Skills section");
  assert.ok(llms.includes("https://hermesatlas.com/skills/"), "llms.txt links the hub");
  for (const group of skills.useCases) {
    assert.ok(
      llms.includes(`https://hermesatlas.com/skills/for-${group.slug}`),
      `llms.txt lists /skills/for-${group.slug}`
    );
  }
  assert.ok(
    Buffer.byteLength(read("llms-full.txt"), "utf-8") < 1_000_000,
    "llms-full.txt stays under the 1 MB ingestion cap"
  );
});

test("the skills nav item is on generated and hand-authored pages alike", () => {
  for (const rel of [
    "skills/index.html",
    "lists/index.html",
    "use-cases/index.html",
    `projects/${repos[0].owner}/${repos[0].repo}.html`,
    "index.html",
    "guide/index.html",
  ]) {
    assert.match(
      read(rel),
      /<nav class="mast-nav"[\s\S]*?<a href="\/skills\/"[\s\S]*?<\/nav>/,
      `${rel} masthead links /skills/`
    );
  }
  assert.match(
    read("skills/index.html"),
    /<a href="\/skills\/" class="active">skills<\/a>/,
    "hub marks the skills nav item active"
  );
});
