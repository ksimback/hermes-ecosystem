#!/usr/bin/env node
/**
 * build-pages.js
 *
 * Generates static HTML pages for each repo in the Hermes Atlas ecosystem:
 *   - Individual project pages at projects/{owner}/{repo}.html
 *   - Curated list pages at lists/{slug}.html
 *   - sitemap.xml
 *
 * Usage: GITHUB_TOKEN=... node scripts/build-pages.js
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { marked } from "marked";
import { githubHeaders, fetchReadme, fetchAllMetadata } from "../lib/github.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SITE_URL = "https://hermesatlas.com";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const SKIP_FETCH = !GITHUB_TOKEN;
if (SKIP_FETCH) {
  console.warn("⚠ GITHUB_TOKEN not set — rendering pages from repos.json only (no README, no live metadata). CI will re-fetch.");
}

const GITHUB_HEADERS = GITHUB_TOKEN ? githubHeaders(GITHUB_TOKEN) : null;

// ── Check if a URL is absolute (skip rewriting) ──
function isAbsoluteUrl(url) {
  return /^(?:https?:\/\/|data:|mailto:|#|\/\/)/.test(url.trim());
}

// ── Safe external link (http/https only; blocks javascript:, data:, etc.) ──
function safeExternalUrl(url) {
  if (!url || typeof url !== "string") return null;
  return /^https?:\/\//i.test(url.trim()) ? url.trim() : null;
}

// ── Strip leading ./ from paths and encode spaces ──
function cleanRelativePath(p) {
  return p.replace(/^\.\//, "").replace(/ /g, "%20");
}

// ── Transform relative URLs in README markdown to absolute GitHub URLs ──
function rewriteRelativeUrls(markdown, owner, repo) {
  const rawBase = `https://raw.githubusercontent.com/${owner}/${repo}/main/`;
  const blobBase = `https://github.com/${owner}/${repo}/blob/main/`;

  // Rewrite image references: ![alt](relative/path)
  markdown = markdown.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (match, alt, url) => {
      if (isAbsoluteUrl(url)) return match;
      return `![${alt}](${rawBase}${cleanRelativePath(url)})`;
    }
  );

  // Rewrite HTML img src: <img src="relative/path" (handles both " and ')
  markdown = markdown.replace(
    /(<img\s[^>]*?src=["'])([^"']+)(["'])/gi,
    (match, prefix, url, suffix) => {
      if (isAbsoluteUrl(url)) return match;
      return `${prefix}${rawBase}${cleanRelativePath(url)}${suffix}`;
    }
  );

  // Rewrite HTML video/source src
  markdown = markdown.replace(
    /(<(?:source|video)\s[^>]*?src=["'])([^"']+)(["'])/gi,
    (match, prefix, url, suffix) => {
      if (isAbsoluteUrl(url)) return match;
      return `${prefix}${rawBase}${cleanRelativePath(url)}${suffix}`;
    }
  );

  // Rewrite link references to non-anchor, non-URL paths: [text](relative/path)
  // Only rewrite if the path looks like a file (has extension)
  markdown = markdown.replace(
    /(?<!!)\[([^\]]*)\]\(([^)]+\.(?:md|txt|rst|html|pdf|json|yaml|yml|toml|py|js|ts|go|rs|sh|ipynb)[^)]*)\)/g,
    (match, text, url) => {
      if (isAbsoluteUrl(url)) return match;
      return `[${text}](${blobBase}${cleanRelativePath(url)})`;
    }
  );

  return markdown;
}

// ── Configure marked with custom renderer to catch any remaining relative URLs ──
const renderer = new marked.Renderer();

// Per-repo base URLs — set before each parse call
let currentRawBase = "";

renderer.image = function ({ href, title, text }) {
  let src = href || "";
  if (src && !isAbsoluteUrl(src)) {
    src = currentRawBase + cleanRelativePath(src);
  }
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
  return `<img src="${escapeHtml(src)}" alt="${escapeHtml(text || "")}"${titleAttr}>`;
};

// Demote README heading levels so each page has a single <h1> (DESIGN.md §11).
// README h1 → h2, h2 → h3, ..., h5 → h6, h6 clamped to h6.
renderer.heading = function ({ tokens, depth }) {
  const text = this.parser.parseInline(tokens);
  const level = Math.min(depth + 1, 6);
  return `<h${level}>${text}</h${level}>\n`;
};

marked.setOptions({
  gfm: true,
  breaks: false,
  renderer,
});

// ── Load data ──
const repos = JSON.parse(
  fs.readFileSync(path.join(ROOT, "data", "repos.json"), "utf-8")
);

let lists = [];
const listsPath = path.join(ROOT, "data", "lists.json");
if (fs.existsSync(listsPath)) {
  lists = JSON.parse(fs.readFileSync(listsPath, "utf-8"));
}

// fetchAllMetadata and fetchReadme imported from lib/github.js

// ── Format star count ──
function formatStars(n) {
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 1 : 1) + "K";
  return String(n);
}

// ── Escape HTML ──
function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Map category to list slug ──
const categoryToListSlug = {};
for (const list of lists) {
  if (list.filter?.category) {
    categoryToListSlug[list.filter.category] = list.slug;
  }
}

// ── Shared favicon (brutalist amber square + H) ──
const FAVICON = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' fill='%23d49a4f'/><text x='16' y='23' font-family='Space Grotesk,sans-serif' font-size='22' font-weight='700' fill='%230e0d0b' text-anchor='middle'>H</text></svg>`;

// ── Shared theme init + toggle script ──
const THEME_INIT = `(function(){try{var s=localStorage.getItem('theme');var o=window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches;var t=s||(o?'light':'dark');document.documentElement.setAttribute('data-theme',t)}catch(e){document.documentElement.setAttribute('data-theme','dark')}})();`;

const THEME_TOGGLE_SCRIPT = `(function(){var t=document.getElementById('theme-toggle');if(!t)return;function render(){var c=document.documentElement.getAttribute('data-theme');t.querySelector('.tt-light').classList.toggle('tt-active',c==='light');t.querySelector('.tt-dark').classList.toggle('tt-active',c!=='light');}render();t.addEventListener('click',function(){var c=document.documentElement.getAttribute('data-theme');var n=c==='light'?'dark':'light';document.documentElement.setAttribute('data-theme',n);try{localStorage.setItem('theme',n)}catch(e){}render();});})();`;

// ── Shared masthead ──
function renderMasthead(activeNav) {
  const nav = [
    { href: "/", label: "map", id: "map" },
    { href: "/#curated-lists", label: "lists", id: "lists" },
    { href: "/reports/state-of-hermes-april-2026", label: "reports", id: "reports" },
    { href: "https://github.com/ksimback/hermes-ecosystem", label: "source", id: "source" },
  ];
  const navHtml = nav
    .map(n => `<a href="${n.href}"${n.id === activeNav ? ' class="active"' : ""}>${n.label}</a>`)
    .join("\n    ");
  return `<header class="masthead">
  <a href="/" class="brand" aria-label="Hermes Atlas — home">hermes atlas</a>
  <div class="mast-meta" aria-label="Site metadata">
    <span>apr·2026</span>
    <span>93·repos</span>
    <span>hermes·v0.10.0</span>
  </div>
  <nav class="mast-nav" aria-label="Primary">
    ${navHtml}
  </nav>
  <button id="theme-toggle" class="mast-toggle" aria-label="Toggle light/dark theme" title="Toggle theme">
    <span class="tt-light">light</span><span class="tt-sep">/</span><span class="tt-dark">dark</span>
  </button>
</header>`;
}

// ── Shared footer ──
const PAGE_FOOTER = `<footer class="page-footer">
  <div class="fn-left">hermes atlas · curated by <a href="https://github.com/ksimback">ksimback</a> · <a href="https://github.com/ksimback/hermes-ecosystem/issues">suggest a repo</a></div>
  <div>v2 · 2026.04</div>
</footer>`;

// ── Split owner/repo for display ──
function splitName(full) {
  // display name sometimes includes an `owner/` prefix; strip it for the repo portion
  const idx = full.indexOf("/");
  if (idx > -1) return { org: full.slice(0, idx).trim(), name: full.slice(idx + 1).trim() };
  return { org: "", name: full };
}

// ── Project page template ──
function renderProjectPage(repo, meta, readmeHtml, relatedRepos, summary) {
  const title = `${repo.name} — Hermes Agent ${repo.category} | Hermes Atlas`;
  const desc = escapeHtml(
    (meta.description || repo.description).slice(0, 160)
  );
  const canonicalUrl = `${SITE_URL}/projects/${repo.owner}/${repo.repo}`;
  const stars = meta.stars || repo.stars;
  const listSlug = categoryToListSlug[repo.category];

  const related = relatedRepos
    .filter((r) => r.repo !== repo.repo || r.owner !== repo.owner)
    .slice(0, 8);

  const relatedHtml = related
    .map((r) => {
      const s = r.meta?.stars || r.stars;
      return `<a class="related-row" href="/projects/${r.owner}/${r.repo}">
        <div class="stars">★ ${formatStars(s)}</div>
        <div class="name"><span class="org">${escapeHtml(r.owner)} /</span> ${escapeHtml(r.repo)}</div>
      </a>`;
    })
    .join("\n      ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${canonicalUrl}">
<meta property="og:title" content="${escapeHtml(repo.name)} — Hermes Atlas">
<meta property="og:description" content="${desc}">
<meta property="og:type" content="article">
<meta property="og:url" content="${canonicalUrl}">
<meta property="og:site_name" content="Hermes Atlas">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escapeHtml(repo.name)} — Hermes Atlas">
<meta name="twitter:description" content="${desc}">
<link rel="icon" href="${FAVICON}">
<script>${THEME_INIT}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="/assets/css/tokens.css">
<link rel="stylesheet" href="/assets/css/base.css">
<link rel="stylesheet" href="/assets/css/page.css">
</head>
<body>

<a class="skip-link" href="#main">Skip to content</a>

${renderMasthead("map")}

<div class="breadcrumb" aria-label="Breadcrumb">
  <a href="/">map</a><span class="sep">/</span><a href="${listSlug ? `/lists/${listSlug}` : "/"}">${escapeHtml(repo.category.toLowerCase())}</a><span class="sep">/</span>${escapeHtml(repo.repo.toLowerCase())}
</div>

<article id="main">

<section class="project">
  <h1 class="project-name">
    <span class="org">${escapeHtml(repo.owner)}</span><span class="slash">/</span>${escapeHtml(repo.repo)}${repo.official ? ' <span class="repo-flag">official</span>' : ""}
  </h1>
  <p class="project-desc">${escapeHtml(meta.description || repo.description)}</p>

  <div class="meta-row">
    <span class="stars">★ ${formatStars(stars)}</span>
    ${meta.language ? `<span><span class="meta-label">lang</span>${escapeHtml(meta.language)}</span>` : ""}
    ${meta.license && meta.license !== "NOASSERTION" ? `<span><span class="meta-label">license</span>${escapeHtml(meta.license)}</span>` : ""}
    ${repo.official ? '<span><span class="meta-label">maintainer</span>Nous Research</span>' : ""}
    ${meta.pushedAt ? `<span><span class="meta-label">updated</span>${new Date(meta.pushedAt).toISOString().slice(0, 10)}</span>` : ""}
  </div>

  <div class="actions">
    <a href="${escapeHtml(safeExternalUrl(repo.url) || "#")}" target="_blank" rel="noopener" class="btn-primary">view on github →</a>
    ${safeExternalUrl(meta.homepage) ? `<a href="${escapeHtml(safeExternalUrl(meta.homepage))}" target="_blank" rel="noopener" class="btn-secondary">homepage</a>` : ""}
  </div>
</section>

${summary ? `
<section class="project-summary">
  <div class="section-label">overview</div>
  <div>
    <p class="summary-text">${escapeHtml(summary.summary)}</p>
    <ul class="summary-highlights">
      ${summary.highlights.map(h => `<li>${escapeHtml(h)}</li>`).join("\n      ")}
    </ul>
  </div>
</section>` : ""}

<details class="readme-details"${summary ? "" : " open"}>
  <summary class="readme-toggle">${summary ? "full readme from github" : "readme"}</summary>
  <section class="readme" data-nosnippet>
    ${readmeHtml || '<div class="no-readme">This project doesn\'t have a README yet. <a href="' + escapeHtml(repo.url) + '" target="_blank">Visit GitHub</a> for more details.</div>'}
  </section>
</details>

<aside class="related" aria-label="Related repos">
  <div>
    <div class="section-label">more in ${escapeHtml(repo.category.toLowerCase())}</div>
    <div class="section-sub">other repos in this category, ranked by stars.</div>
  </div>
  <div>
    <div class="related-list">
      ${relatedHtml}
    </div>
    ${listSlug ? `<p class="list-link"><a href="/lists/${listSlug}">see all ${escapeHtml(repo.category.toLowerCase())} →</a></p>` : ""}
  </div>
</aside>

</article>

${PAGE_FOOTER}

<script>${THEME_TOGGLE_SCRIPT}</script>
</body>
</html>`;
}

// ── List page template ──
function renderListPage(list, matchedRepos, listSummaryEntries) {
  const title = `${list.title} | Hermes Atlas`;
  const desc = escapeHtml(list.description.slice(0, 160));
  const canonicalUrl = `${SITE_URL}/lists/${list.slug}`;

  const sorted = matchedRepos.slice().sort((a, b) => (b.meta?.stars || b.stars) - (a.meta?.stars || a.stars));

  const repoRows = sorted
    .map((r, i) => {
      const s = r.meta?.stars || r.stars;
      const rank = String(i + 1).padStart(2, '0');
      return `<a class="list-row" href="/projects/${r.owner}/${r.repo}">
    <div class="list-rank">${rank}</div>
    <div class="list-cell-body">
      <div class="list-cell-name"><span class="org">${escapeHtml(r.owner)} /</span> ${escapeHtml(r.repo)}${r.official ? ' <span class="repo-flag">official</span>' : ""}</div>
      <div class="list-cell-desc">${escapeHtml((r.meta?.description || r.description).slice(0, 140))}</div>
    </div>
    <div class="list-cell-stars">★ ${formatStars(s)}</div>
  </a>`;
    })
    .join("\n  ");

  const hasListicle = listSummaryEntries && Object.keys(listSummaryEntries).length > 0;
  const listicleHtml = hasListicle ? `
<section class="listicle" aria-label="Per-project breakdown">
  <div class="section-label">breakdown</div>
  <div class="listicle-entries">
    ${sorted
      .map(r => {
        const key = `${r.owner}/${r.repo}`;
        const entry = listSummaryEntries[key];
        if (!entry) return "";
        return `<article class="listicle-entry">
      <h3><a href="/projects/${r.owner}/${r.repo}">${escapeHtml(r.owner)} / ${escapeHtml(r.repo)}</a></h3>
      <p>${escapeHtml(entry)}</p>
    </article>`;
      })
      .filter(Boolean)
      .join("\n    ")}
  </div>
</section>` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${canonicalUrl}">
<meta property="og:title" content="${escapeHtml(list.title)}">
<meta property="og:description" content="${desc}">
<meta property="og:type" content="website">
<meta property="og:url" content="${canonicalUrl}">
<meta property="og:site_name" content="Hermes Atlas">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escapeHtml(list.title)}">
<link rel="icon" href="${FAVICON}">
<script>${THEME_INIT}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="/assets/css/tokens.css">
<link rel="stylesheet" href="/assets/css/base.css">
<link rel="stylesheet" href="/assets/css/page.css">
</head>
<body>

<a class="skip-link" href="#main">Skip to content</a>

${renderMasthead("lists")}

<div class="breadcrumb" aria-label="Breadcrumb">
  <a href="/">map</a><span class="sep">/</span><a href="/#curated-lists">lists</a><span class="sep">/</span>${escapeHtml(list.slug)}
</div>

<article id="main">

<section class="list-page">
  <h1 class="list-title">${escapeHtml(list.title)}</h1>
  <p class="list-intro">${escapeHtml(list.description)}</p>
</section>

<div class="list-table" aria-label="Ranked list">
  <div class="list-table-head">
    <div>#</div>
    <div>project</div>
    <div style="text-align:right">stars</div>
  </div>
  ${repoRows}
</div>
${listicleHtml}

<div class="back-link"><a href="/">← back to the map</a></div>

</article>

${PAGE_FOOTER}

<script>${THEME_TOGGLE_SCRIPT}</script>
</body>
</html>`;
}

// ── Generate sitemap.xml ──
function generateSitemap(projectPages, listPages) {
  const today = new Date().toISOString().slice(0, 10);

  let urls = `  <url><loc>${SITE_URL}/</loc><changefreq>daily</changefreq><priority>1.0</priority><lastmod>${today}</lastmod></url>\n`;
  urls += `  <url><loc>${SITE_URL}/reports/state-of-hermes-april-2026</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>\n`;

  for (const page of projectPages) {
    urls += `  <url><loc>${SITE_URL}/projects/${page.owner}/${page.repo}</loc><changefreq>weekly</changefreq><priority>0.8</priority><lastmod>${today}</lastmod></url>\n`;
  }

  for (const list of listPages) {
    urls += `  <url><loc>${SITE_URL}/lists/${list.slug}</loc><changefreq>weekly</changefreq><priority>0.6</priority><lastmod>${today}</lastmod></url>\n`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}</urlset>\n`;
}

// ── Main ──
async function main() {
  console.log(`Building pages for ${repos.length} repos + ${lists.length} lists...\n`);

  // Fetch metadata in one batch (skipped if no GITHUB_TOKEN)
  let metadata = {};
  if (GITHUB_HEADERS) {
    console.log("Fetching metadata via GraphQL...");
    metadata = await fetchAllMetadata(repos, GITHUB_HEADERS);
    console.log(`  Got metadata for ${Object.keys(metadata).length} repos\n`);
  } else {
    console.log("Skipping GitHub metadata fetch (no token).\n");
  }

  // Load generated summaries (if available)
  let summaries = {};
  let listSummaries = {};
  try {
    summaries = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "summaries.json"), "utf-8"));
    console.log(`  Loaded ${Object.keys(summaries).length} project summaries`);
  } catch { console.log("  No summaries.json found — pages will show README only"); }
  try {
    listSummaries = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "list-summaries.json"), "utf-8"));
    console.log(`  Loaded ${Object.keys(listSummaries).length} list summaries`);
  } catch { console.log("  No list-summaries.json found"); }
  console.log();

  // Ensure output directories exist
  const projectsDir = path.join(ROOT, "projects");
  const listsDir = path.join(ROOT, "lists");
  fs.mkdirSync(projectsDir, { recursive: true });
  fs.mkdirSync(listsDir, { recursive: true });

  // Generate project pages
  console.log("Generating project pages...");
  let generated = 0;
  let errors = 0;

  for (const repo of repos) {
    const key = `${repo.owner}/${repo.repo}`;
    const meta = metadata[key] || {};

    // Fetch README, or extract from existing page if offline
    let readmeHtml = null;
    if (GITHUB_HEADERS) {
      const readmeRaw = await fetchReadme(repo.owner, repo.repo, GITHUB_HEADERS);
      if (readmeRaw) {
        try {
          currentRawBase = `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/main/`;
          const readmeFixed = rewriteRelativeUrls(readmeRaw, repo.owner, repo.repo);
          readmeHtml = marked.parse(readmeFixed);
        } catch (e) {
          console.warn(`  Markdown parse error for ${key}: ${e.message}`);
        }
      }
    } else {
      // Offline: reuse the README HTML already baked into the existing page.
      // Demote heading levels (h1→h2, ..., h5→h6) so the page has one <h1>,
      // matching what the online `marked` renderer emits.
      const existingPath = path.join(projectsDir, repo.owner, `${repo.repo}.html`);
      if (fs.existsSync(existingPath)) {
        try {
          const existing = fs.readFileSync(existingPath, "utf-8");
          const match = existing.match(/<section class="readme"[^>]*>([\s\S]*?)<\/section>/);
          if (match && !match[1].includes("no-readme")) {
            readmeHtml = match[1]
              .replace(/<(\/?)h5(\s|>)/g, "<$1h6$2")
              .replace(/<(\/?)h4(\s|>)/g, "<$1h5$2")
              .replace(/<(\/?)h3(\s|>)/g, "<$1h4$2")
              .replace(/<(\/?)h2(\s|>)/g, "<$1h3$2")
              .replace(/<(\/?)h1(\s|>)/g, "<$1h2$2")
              .trim();
          }
        } catch {}
      }
    }

    // Get related repos (same category)
    const relatedRepos = repos
      .filter((r) => r.category === repo.category)
      .map((r) => ({ ...r, meta: metadata[`${r.owner}/${r.repo}`] }));

    // Generate HTML
    const html = renderProjectPage(
      repo,
      { ...repo, ...meta },
      readmeHtml,
      relatedRepos,
      summaries[key] || null
    );

    // Write file
    const ownerDir = path.join(projectsDir, repo.owner);
    fs.mkdirSync(ownerDir, { recursive: true });
    fs.writeFileSync(path.join(ownerDir, `${repo.repo}.html`), html, "utf-8");

    generated++;
    process.stdout.write(`  ${generated}/${repos.length} ${key}\r`);

    // Small delay to be polite to GitHub API (only if fetching)
    if (GITHUB_HEADERS) await new Promise((r) => setTimeout(r, 100));
  }

  console.log(`\n  Generated ${generated} project pages (${errors} errors)\n`);

  // Generate list pages
  console.log("Generating list pages...");
  for (const list of lists) {
    const matchedRepos = repos
      .filter((r) => {
        if (list.filter?.category) return r.category === list.filter.category;
        return false;
      })
      .map((r) => ({
        ...r,
        meta: metadata[`${r.owner}/${r.repo}`],
      }));

    const html = renderListPage(list, matchedRepos, listSummaries[list.slug]?.entries || {});
    fs.writeFileSync(path.join(listsDir, `${list.slug}.html`), html, "utf-8");
    console.log(`  ${list.slug} (${matchedRepos.length} repos)`);
  }

  // Generate sitemap
  console.log("\nGenerating sitemap.xml...");
  const sitemap = generateSitemap(repos, lists);
  fs.writeFileSync(path.join(ROOT, "sitemap.xml"), sitemap, "utf-8");
  console.log(`  ${repos.length + lists.length + 2} URLs`);

  // Generate robots.txt
  const robotsTxt = `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`;
  fs.writeFileSync(path.join(ROOT, "robots.txt"), robotsTxt, "utf-8");

  console.log("\nDone!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
