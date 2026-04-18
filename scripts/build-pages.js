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
if (!GITHUB_TOKEN) {
  console.error("Error: GITHUB_TOKEN environment variable required");
  process.exit(1);
}

const GITHUB_HEADERS = githubHeaders(GITHUB_TOKEN);

// ── Check if a URL is absolute (skip rewriting) ──
function isAbsoluteUrl(url) {
  return /^(?:https?:\/\/|data:|mailto:|#|\/\/)/.test(url.trim());
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

// ── Project page template ──
function renderProjectPage(repo, meta, readmeHtml, relatedRepos, summary) {
  const title = `${repo.name} — Hermes Agent ${repo.category} | Hermes Atlas`;
  const desc = escapeHtml(
    (meta.description || repo.description).slice(0, 160)
  );
  const canonicalUrl = `${SITE_URL}/projects/${repo.owner}/${repo.repo}`;
  const stars = meta.stars || repo.stars;
  const listSlug = categoryToListSlug[repo.category];

  const relatedHtml = relatedRepos
    .filter((r) => r.repo !== repo.repo || r.owner !== repo.owner)
    .slice(0, 8)
    .map(
      (r) =>
        `<a href="/projects/${r.owner}/${r.repo}" class="related-chip">${r.name} <span class="related-stars">${formatStars(r.stars)}</span></a>`
    )
    .join("\n          ");

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
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🗺️</text></svg>">
<script>
  (function(){try{var s=localStorage.getItem('theme');var o=window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches;var t=s||(o?'light':'dark');document.documentElement.setAttribute('data-theme',t)}catch(e){document.documentElement.setAttribute('data-theme','dark')}})();
</script>
<link rel="stylesheet" href="/assets/css/tokens.css">
<link rel="stylesheet" href="/assets/css/base.css">
<link rel="stylesheet" href="/assets/css/page.css">
</head>
<body>
<nav class="nav">
  <a href="/" class="nav-brand">🗺️ Hermes Atlas</a>
  <div class="nav-actions">
    <a href="/" class="nav-link">Ecosystem Map</a>
    <button id="theme-toggle" aria-label="Toggle theme"><span class="icon-moon">☾</span><span class="icon-sun">☀</span></button>
  </div>
</nav>

<article class="project">
  <div class="breadcrumb">
    <a href="/">${escapeHtml(repo.category)}</a>
  </div>

  <h1>${escapeHtml(repo.name)}${repo.official ? ' <span style="font-size:14px;color:var(--brand-purple)">OFFICIAL</span>' : ""}</h1>
  <p class="project-desc">${escapeHtml(meta.description || repo.description)}</p>

  <div class="meta-row">
    <span class="stars">★ ${formatStars(stars).toLocaleString()}</span>
    ${meta.language ? `<span class="badge badge-lang">${escapeHtml(meta.language)}</span>` : ""}
    ${meta.license && meta.license !== "NOASSERTION" ? `<span class="badge badge-lang">${escapeHtml(meta.license)}</span>` : ""}
    ${repo.official ? '<span class="badge badge-official">Nous Research</span>' : ""}
    ${meta.pushedAt ? `<span>Updated ${new Date(meta.pushedAt).toLocaleDateString()}</span>` : ""}
  </div>

  <div class="actions">
    <a href="${escapeHtml(repo.url)}" target="_blank" rel="noopener" class="btn-primary">View on GitHub →</a>
    ${meta.homepage ? `<a href="${escapeHtml(meta.homepage)}" target="_blank" rel="noopener" class="btn-secondary">Homepage</a>` : ""}
  </div>

  ${summary ? `
  <section class="project-summary">
    <h2>Overview</h2>
    <p class="summary-text">${escapeHtml(summary.summary)}</p>
    <ul class="summary-highlights">
      ${summary.highlights.map(h => `<li>${escapeHtml(h)}</li>`).join("\n      ")}
    </ul>
  </section>` : ""}

  <details class="readme-details"${summary ? "" : " open"}>
    <summary class="readme-toggle">${summary ? "Full README from GitHub" : "README"}</summary>
    <section class="readme" data-nosnippet>
      ${readmeHtml || '<div class="no-readme">This project doesn\'t have a README yet. <a href="' + escapeHtml(repo.url) + '" target="_blank">Visit GitHub</a> for more details.</div>'}
    </section>
  </details>

  <aside class="related">
    <h2>More in ${escapeHtml(repo.category)}</h2>
    <div class="related-grid">
      ${relatedHtml}
    </div>
    ${listSlug ? `<p class="list-link"><a href="/lists/${listSlug}">See all ${escapeHtml(repo.category)} projects →</a></p>` : ""}
  </aside>
</article>

<div class="page-footer">
  <p><a href="/">Hermes Atlas</a> · The community map for <a href="https://github.com/NousResearch/hermes-agent">Hermes Agent</a> by Nous Research</p>
</div>

<script>
  document.getElementById('theme-toggle')?.addEventListener('click',()=>{
    const c=document.documentElement.getAttribute('data-theme');
    const n=c==='light'?'dark':'light';
    document.documentElement.setAttribute('data-theme',n);
    try{localStorage.setItem('theme',n)}catch(e){}
  });
</script>
</body>
</html>`;
}

// ── List page template ──
function renderListPage(list, matchedRepos, listSummaryEntries) {
  const title = `${list.title} | Hermes Atlas`;
  const desc = escapeHtml(list.description.slice(0, 160));
  const canonicalUrl = `${SITE_URL}/lists/${list.slug}`;

  const repoRows = matchedRepos
    .sort((a, b) => (b.meta?.stars || b.stars) - (a.meta?.stars || a.stars))
    .map(
      (r, i) => `
      <tr>
        <td style="font-weight:700;color:var(--text-tertiary)">${i + 1}</td>
        <td><a href="/projects/${r.owner}/${r.repo}"><strong>${escapeHtml(r.name)}</strong></a>${r.official ? ' <span style="font-size:10px;color:var(--brand-purple);font-weight:700">OFFICIAL</span>' : ""}</td>
        <td style="color:var(--brand-star);font-weight:700">★ ${formatStars(r.meta?.stars || r.stars)}</td>
        <td style="color:var(--text-secondary);font-size:13px">${escapeHtml((r.meta?.description || r.description).slice(0, 120))}</td>
      </tr>`
    )
    .join("");

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
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🗺️</text></svg>">
<script>
  (function(){try{var s=localStorage.getItem('theme');var o=window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches;var t=s||(o?'light':'dark');document.documentElement.setAttribute('data-theme',t)}catch(e){document.documentElement.setAttribute('data-theme','dark')}})();
</script>
<link rel="stylesheet" href="/assets/css/tokens.css">
<link rel="stylesheet" href="/assets/css/base.css">
<link rel="stylesheet" href="/assets/css/page.css">
</head>
<body>
<nav class="nav">
  <a href="/" class="nav-brand">🗺️ Hermes Atlas</a>
  <div class="nav-actions">
    <a href="/" class="nav-link">Ecosystem Map</a>
    <button id="theme-toggle" aria-label="Toggle theme"><span class="icon-moon">☾</span><span class="icon-sun">☀</span></button>
  </div>
</nav>
<article class="list-page">
  <h1>${escapeHtml(list.title)}</h1>
  <p class="intro">${escapeHtml(list.description)}</p>
  <table>
    <thead><tr><th>#</th><th>Project</th><th>Stars</th><th>Description</th></tr></thead>
    <tbody>${repoRows}</tbody>
  </table>
  ${listSummaryEntries && Object.keys(listSummaryEntries).length > 0 ? `
  <section class="listicle">
    <h2>Project Breakdown</h2>
    ${matchedRepos
      .sort((a, b) => (b.meta?.stars || b.stars) - (a.meta?.stars || a.stars))
      .map(r => {
        const key = `${r.owner}/${r.repo}`;
        const desc = listSummaryEntries[key];
        if (!desc) return "";
        return `<div class="listicle-entry">
      <h3><a href="/projects/${r.owner}/${r.repo}">${escapeHtml(r.name)}</a></h3>
      <p>${escapeHtml(desc)}</p>
    </div>`;
      })
      .filter(Boolean)
      .join("\n    ")}
  </section>` : ""}
  <p class="back-link"><a href="/">← Back to Ecosystem Map</a></p>
</article>
<div class="page-footer">
  <p><a href="/">Hermes Atlas</a> · The community map for <a href="https://github.com/NousResearch/hermes-agent">Hermes Agent</a> by Nous Research</p>
</div>
<script>
  document.getElementById('theme-toggle')?.addEventListener('click',()=>{
    const c=document.documentElement.getAttribute('data-theme');
    const n=c==='light'?'dark':'light';
    document.documentElement.setAttribute('data-theme',n);
    try{localStorage.setItem('theme',n)}catch(e){}
  });
</script>
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

  // Fetch metadata in one batch
  console.log("Fetching metadata via GraphQL...");
  const metadata = await fetchAllMetadata(repos, GITHUB_HEADERS);
  console.log(`  Got metadata for ${Object.keys(metadata).length} repos\n`);

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

    // Fetch README
    const readmeRaw = await fetchReadme(repo.owner, repo.repo, GITHUB_HEADERS);
    let readmeHtml = null;
    if (readmeRaw) {
      try {
        currentRawBase = `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/main/`;
        const readmeFixed = rewriteRelativeUrls(readmeRaw, repo.owner, repo.repo);
        readmeHtml = marked.parse(readmeFixed);
      } catch (e) {
        console.warn(`  Markdown parse error for ${key}: ${e.message}`);
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

    // Small delay to be polite to GitHub API
    await new Promise((r) => setTimeout(r, 100));
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
