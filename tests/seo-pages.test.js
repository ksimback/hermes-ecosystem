import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf-8");
const repos = JSON.parse(read("data/repos.json"));
const lists = JSON.parse(read("data/lists.json"));
const desktopPlugins = JSON.parse(read("data/desktop-plugins.json"));
const useCases = JSON.parse(read("data/use-cases.json"));
const latestRelease = JSON.parse(read("data/latest-release.json"));

function walkHtml(dir, out = []) {
  for (const d of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${d.name}`;
    if (d.isDirectory()) walkHtml(rel, out);
    else if (d.name.endsWith(".html")) out.push(rel);
  }
  return out;
}

test("project pages have unique, owner-qualified titles", () => {
  const seen = new Map();
  for (const rel of walkHtml("projects")) {
    const m = read(rel).match(/<title>([^<]+)<\/title>/);
    assert.ok(m, `${rel} has a <title>`);
    assert.ok(
      !seen.has(m[1]),
      `duplicate <title> "${m[1]}" in ${rel} and ${seen.get(m[1])}`
    );
    seen.set(m[1], rel);
  }
  // Owner qualification is what guarantees uniqueness for same-name repos.
  const sample = read(`projects/${repos[0].owner}/${repos[0].repo}.html`);
  assert.match(sample, new RegExp(`<title>${repos[0].owner}/`));
});

test("guide pages carry the current Hermes release, not a stale one", () => {
  const version = latestRelease.version;
  assert.ok(version, "data/latest-release.json has a version");

  const guide = read("guide/index.html");
  assert.ok(
    guide.includes(`Hermes Agent ${version}:`),
    `guide <title>/H1 mentions current release ${version}`
  );
  const currentRelease = guide.match(/Current release is (v[\d.]+)/);
  assert.ok(currentRelease, "guide states a current release");
  assert.equal(currentRelease[1], version, "stated current release matches latest-release.json");

  for (const rel of [
    "guide/index.html",
    "guide/install/index.html",
    "guide/memory/index.html",
    "guide/vs-claude-code/index.html",
  ]) {
    assert.ok(
      read(rel).includes(`hermes·${version}`),
      `${rel} masthead shows hermes·${version}`
    );
  }
});

test("homepage baked counters match the catalog", () => {
  const html = read("index.html");
  const metaCount = html.match(/<span id="meta-count">(\d+)·repos<\/span>/);
  assert.ok(metaCount, "meta-count span present");
  assert.equal(Number(metaCount[1]), repos.length);

  const statTotal = html.match(/<span class="n" id="stat-total-repos">(\d+)<\/span>/);
  assert.ok(statTotal, "stat-total-repos span present");
  assert.equal(Number(statTotal[1]), repos.length);
});

test("sitemap covers lists index + all projects, with lastmod on every URL", () => {
  const sitemap = read("sitemap.xml");
  assert.ok(sitemap.includes("<loc>https://hermesatlas.com/lists/</loc>"), "/lists/ in sitemap");
  assert.ok(sitemap.includes("<loc>https://hermesatlas.com/masterclass/</loc>"), "/masterclass/ in sitemap");
  for (const r of repos) {
    assert.ok(
      sitemap.includes(`<loc>https://hermesatlas.com/projects/${r.owner}/${r.repo}</loc>`),
      `sitemap has /projects/${r.owner}/${r.repo}`
    );
  }
  const urlBlocks = sitemap.match(/<url>.*?<\/url>/gs) || [];
  assert.ok(urlBlocks.length >= repos.length + lists.length, "sitemap has expected URL count");
  for (const block of urlBlocks) {
    assert.match(block, /<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/, `URL entry missing lastmod: ${block}`);
  }
});

test("lists index is templated, canonical, and links every list", () => {
  const html = read("lists/index.html");
  assert.ok(html.includes('<link rel="canonical" href="https://hermesatlas.com/lists/">'));
  assert.ok(html.includes('class="masthead"'), "lists index uses the shared masthead");
  assert.ok(html.includes("application/ld+json"), "lists index has JSON-LD");
  for (const l of lists) {
    assert.ok(html.includes(`href="/lists/${l.slug}"`), `lists index links /lists/${l.slug}`);
  }
  assert.ok(html.includes(`${desktopPlugins.plugins.length} verified repos`));
});

test("desktop plugin evidence list is searchable and links every verified repository", () => {
  const html = read("lists/desktop-plugins.html");
  assert.ok(html.includes('id="desktop-search"'));
  assert.ok(html.includes('id="desktop-type"'));
  assert.ok(html.includes('id="desktop-status"'));
  const desktopList = lists.find((list) => list.filter?.desktopPlugins);
  assert.ok(desktopList);
  assert.ok(html.includes(`href="${desktopList.methodology}"`));
  assert.ok(html.includes('application/ld+json'));
  assert.ok(html.includes("<div>repository</div>"));
  assert.equal((html.match(/class="list-row"/g) || []).length, desktopPlugins.plugins.length);
  const canonical = new Map(repos.map((repo) => [`${repo.owner}/${repo.repo}`.toLowerCase(), repo]));
  for (const plugin of desktopPlugins.plugins) {
    const atlasRepo = canonical.get(plugin.repository.toLowerCase());
    const href = atlasRepo ? `/projects/${atlasRepo.owner}/${atlasRepo.repo}` : plugin.url;
    assert.ok(html.includes(`href="${href}"`), `desktop list links ${plugin.repository}`);
  }
  assert.ok(read("sitemap.xml").includes("https://hermesatlas.com/lists/desktop-plugins"));
});

test("use-case pages are in the sitemap, canonical, and cross-linked", () => {
  const sitemap = read("sitemap.xml");
  const index = read("use-cases/index.html");
  assert.ok(sitemap.includes("<loc>https://hermesatlas.com/use-cases/</loc>"), "/use-cases/ in sitemap");
  assert.ok(index.includes('<link rel="canonical" href="https://hermesatlas.com/use-cases/">'));
  assert.ok(index.includes('class="masthead"'), "use-cases index uses the shared masthead");

  for (const uc of useCases) {
    assert.ok(
      sitemap.includes(`<loc>https://hermesatlas.com/use-cases/${uc.slug}</loc>`),
      `sitemap has /use-cases/${uc.slug}`
    );
    assert.ok(index.includes(`href="/use-cases/${uc.slug}"`), `index links /use-cases/${uc.slug}`);

    // Every recommended repo must link to its live project page, and the page
    // must carry the evidence section that distinguishes it from a /lists/ page.
    const page = read(`use-cases/${uc.slug}.html`);
    assert.ok(
      page.includes(`<link rel="canonical" href="https://hermesatlas.com/use-cases/${uc.slug}">`),
      `${uc.slug} has a canonical URL`
    );
    for (const item of uc.stack) {
      assert.ok(
        page.includes(`href="/projects/${item.owner}/${item.repo}"`),
        `${uc.slug} links /projects/${item.owner}/${item.repo}`
      );
    }
    assert.match(page, /class="uc-evidence-grid"/, `${uc.slug} renders cited evidence`);
  }
});

test("llms.txt advertises the use-case bundles", () => {
  const llms = read("llms.txt");
  assert.ok(llms.includes("## Use Cases"), "llms.txt has a Use Cases section");
  for (const uc of useCases) {
    assert.ok(
      llms.includes(`https://hermesatlas.com/use-cases/${uc.slug}`),
      `llms.txt lists /use-cases/${uc.slug}`
    );
  }
});

test("project meta descriptions prefer the English AI summary when present", () => {
  const summaries = JSON.parse(read("data/summaries.json"));
  const key = Object.keys(summaries).find((k) => summaries[k]?.summary);
  assert.ok(key, "at least one summary exists");
  const [owner, repo] = key.split("/");
  const html = read(`projects/${owner}/${repo}.html`);
  const m = html.match(/<meta name="description" content="([^"]+)">/);
  assert.ok(m, "project page has meta description");
  const expectedPrefix = summaries[key].summary.slice(0, 40);
  assert.ok(
    m[1].startsWith(expectedPrefix.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")),
    `meta description starts with the AI summary for ${key}`
  );
});
