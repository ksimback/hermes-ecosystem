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
import { execFileSync, execSync } from "child_process";
import { fileURLToPath } from "url";
import { marked } from "marked";
import { JSDOM } from "jsdom";
import createDOMPurify from "dompurify";
import { githubHeaders, fetchReadme, fetchAllMetadata } from "../lib/github.js";
import { REFRESHED_CONTENT_PATHS } from "../lib/build-artifacts.js";

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
  // README images sit below the fold on project pages — lazy-load + async-decode
  // to cut initial payload and avoid layout jank.
  return `<img src="${escapeHtml(src)}" alt="${escapeHtml(text || "")}"${titleAttr} loading="lazy" decoding="async">`;
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

// ── Sanitize untrusted README HTML (contributor READMEs can carry raw
// <script>/<iframe>/onerror=.../javascript: payloads → stored XSS).
// `style` is stripped too: the site CSP has no style-src 'unsafe-inline'
// (#487), so browsers ignore inline styles anyway — emitting them would just
// be dead markup and CSP-report noise. README images are sized by page.css. ──
const DOMPurify = createDOMPurify(new JSDOM("").window);
function sanitizeReadmeHtml(html) {
  if (!html) return html;
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true }, FORBID_ATTR: ["style"] });
}

// ── Emit JSON-LD with `<` escaped so a `</script>` inside any user-supplied
// string (repo description, summary) can't break out of the block. ──
function ldJson(node) {
  return `<script type="application/ld+json">\n${JSON.stringify(node, null, 2).replace(/</g, "\\u003c")}\n</script>`;
}

// Truncate at a word boundary + ellipsis so meta descriptions and feed blurbs
// don't cut off mid-word ("...these tools e"). Null-safe; returns unchanged if
// already within the limit.
function truncate(str, max) {
  const s = String(str || "");
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

// ── Change-aware page writer ──
// Skips the write when the generated content is byte-identical to what's on
// disk, and records every path that actually changed this build. The sitemap
// uses this set for honest <lastmod> values: changed-this-build pages get
// today, everything else keeps its last real change date from git history.
const changedPages = new Set();
function writePage(absPath, content) {
  const rel = path.relative(ROOT, absPath).split(path.sep).join("/");
  let existing = null;
  try {
    existing = fs.readFileSync(absPath, "utf-8");
  } catch {}
  if (existing === content) return false;
  fs.writeFileSync(absPath, content, "utf-8");
  changedPages.add(rel);
  return true;
}

// ── Last-commit date per file (one git-log pass, cached) ──
let gitLastmodCache = null;
function gitLastmod(relPath) {
  if (!gitLastmodCache) {
    gitLastmodCache = new Map();
    try {
      const out = execSync("git log --format=%x01%cs --name-only", {
        cwd: ROOT,
        encoding: "utf-8",
        maxBuffer: 128 * 1024 * 1024,
      });
      let date = null;
      for (const line of out.split("\n")) {
        if (line.charCodeAt(0) === 1) {
          date = line.slice(1).trim();
        } else {
          const f = line.trim();
          if (f && date && !gitLastmodCache.has(f)) gitLastmodCache.set(f, date);
        }
      }
    } catch (e) {
      console.warn("  gitLastmod: git log failed (non-fatal):", e.message);
    }
  }
  return gitLastmodCache.get(relPath) || null;
}

function lastmodFor(relPath) {
  const today = new Date().toISOString().slice(0, 10);
  if (changedPages.has(relPath)) return today;
  return gitLastmod(relPath) || today;
}

// ── Load data ──
const repos = JSON.parse(
  fs.readFileSync(path.join(ROOT, "data", "repos.json"), "utf-8")
);

let lists = [];
const listsPath = path.join(ROOT, "data", "lists.json");
if (fs.existsSync(listsPath)) {
  lists = JSON.parse(fs.readFileSync(listsPath, "utf-8"));
}

let reports = [];
const reportsPath = path.join(ROOT, "data", "reports.json");
if (fs.existsSync(reportsPath)) {
  reports = JSON.parse(fs.readFileSync(reportsPath, "utf-8"));
  // Newest first by date (ISO YYYY-MM-DD sorts lexicographically)
  reports.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

let latestHermesVersion = "v0.15.2";
const latestReleasePath = path.join(ROOT, "data", "latest-release.json");
if (fs.existsSync(latestReleasePath)) {
  try {
    latestHermesVersion = JSON.parse(fs.readFileSync(latestReleasePath, "utf-8")).version || latestHermesVersion;
  } catch {
    // Keep the fallback if the generated release metadata is temporarily malformed.
  }
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

// ── Build a /api/og image URL (HTML-escape the & separators via escapeHtml on use) ──
function ogImageUrl({ title, subtitle, kind }) {
  const u = new URLSearchParams();
  if (title) u.set("title", String(title).slice(0, 120));
  if (subtitle) u.set("subtitle", String(subtitle).slice(0, 180));
  if (kind) u.set("kind", String(kind).slice(0, 40));
  return `${SITE_URL}/api/og?${u.toString()}`;
}

// ── Map category to list slug ──
const categoryToListSlug = {};
for (const list of lists) {
  if (list.filter?.category) {
    categoryToListSlug[list.filter.category] = list.slug;
  }
}

// ── Shared favicon (brutalist amber square + H) ──
// Full link block — Google SERP needs a real fetchable icon URL, not a data:URI.
const FAVICON = `<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">`;

// ── Shared masthead ──
function renderMasthead(activeNav) {
  const nav = [
    { href: "/", label: "map", id: "map" },
    { href: "/lists/", label: "lists", id: "lists" },
    { href: "/guide/", label: "handbook", id: "handbook" },
    { href: "/masterclass/", label: "masterclass", id: "masterclass" },
    { href: "/dev/", label: "dev", id: "dev" },
    { href: "/reports/", label: "reports", id: "reports" },
    { href: "/#newsletter", label: "newsletter", id: "newsletter" },
    { href: "https://github.com/ksimback/hermes-ecosystem", label: "source", id: "source" },
  ];
  const navHtml = nav
    .map(n => `<a href="${n.href}"${n.id === activeNav ? ' class="active"' : ""}>${n.label}</a>`)
    .join("\n    ");
  return `<header class="masthead">
  <a href="/" class="brand" aria-label="Hermes Atlas — home">hermes atlas</a>
  <div class="mast-meta" aria-label="Site metadata">
    <span id="meta-count">${repos.length}·repos</span>
    <span id="meta-version">hermes·${latestHermesVersion}</span>
    <a class="mast-star" id="meta-atlas" href="https://github.com/ksimback/hermes-ecosystem" target="_blank" rel="noopener" aria-label="Star Hermes Atlas on GitHub">★ star this repo</a>
  </div>
  <nav class="mast-nav" aria-label="Primary">
    ${navHtml}
  </nav>
  <button id="theme-toggle" class="mast-toggle" aria-label="Toggle light/dark theme" title="Toggle theme">
    <span class="tt-icon tt-light" aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false"><circle cx="12" cy="12" r="3.5"/><path d="M12 2v2.25M12 19.75V22M4.93 4.93l1.59 1.59M17.48 17.48l1.59 1.59M2 12h2.25M19.75 12H22M4.93 19.07l1.59-1.59M17.48 6.52l1.59-1.59"/></svg>
    </span>
    <span class="tt-icon tt-dark" aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false"><path d="M20.2 15.1A8.4 8.4 0 0 1 8.9 3.8 8.5 8.5 0 1 0 20.2 15.1Z"/></svg>
    </span>
  </button>
</header>`;
}

// ── Shared footer ──
const PAGE_FOOTER = `<footer class="page-footer">
  <div class="fn-left">hermes atlas · curated by <a href="https://github.com/ksimback">ksimback</a> · <a href="https://github.com/ksimback/hermes-ecosystem/issues">suggest a repo</a> · <a href="/privacy">privacy</a></div>
  <div>v2 · 2026.04</div>
</footer>`;

// Keep the hand-authored surfaces on the same static masthead as generated
// project/list pages. The site deploys plain HTML, so navigation must be in the
// document itself (not injected client-side) for keyboard users and crawlers.
function refreshSiteChrome() {
  const targets = ["index.html", "404.html"];
  const roots = ["guide", "dev", "reports", "privacy", "masterclass"];

  const collect = (relDir) => {
    const absDir = path.join(ROOT, relDir);
    if (!fs.existsSync(absDir)) return;
    for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
      const rel = `${relDir}/${entry.name}`;
      if (entry.isDirectory()) collect(rel);
      else if (entry.name.endsWith(".html")) targets.push(rel);
    }
  };
  for (const relDir of roots) collect(relDir);

  const activeFor = (rel) => {
    if (rel === "index.html") return "map";
    if (rel.startsWith("guide/")) return "handbook";
    if (rel.startsWith("masterclass/")) return "masterclass";
    if (rel.startsWith("dev/")) return "dev";
    if (rel.startsWith("reports/")) return "reports";
    return null;
  };

  let refreshed = 0;
  for (const rel of [...new Set(targets)]) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    const original = fs.readFileSync(abs, "utf-8");
    if (!/<header class="masthead">/.test(original)) continue;
    const next = original.replace(
      /<header class="masthead">[\s\S]*?<\/header>/,
      renderMasthead(activeFor(rel)),
    );
    if (next !== original && writePage(abs, next)) refreshed++;
  }
  console.log(`  refreshed shared masthead on ${refreshed} hand-authored page(s)`);
}

// ── Split owner/repo for display ──
function splitName(full) {
  // display name sometimes includes an `owner/` prefix; strip it for the repo portion
  const idx = full.indexOf("/");
  if (idx > -1) return { org: full.slice(0, idx).trim(), name: full.slice(idx + 1).trim() };
  return { org: "", name: full };
}

// ── GEO: category → schema.org applicationCategory ──
const CATEGORY_TO_SCHEMA_APP = {
  "Core & Official": "DeveloperApplication",
  "Workspaces & GUIs": "DesktopEnhancementApplication",
  "Memory & Context": "UtilitiesApplication",
  "Skills & Skill Registries": "DeveloperApplication",
  "Plugins & Extensions": "BrowserApplication",
  "Integrations & Bridges": "CommunicationApplication",
  "Multi-Agent & Orchestration": "DeveloperApplication",
  "Developer Tools": "DeveloperApplication",
  "Deployment & Infra": "DeveloperApplication",
  "Domain Applications": "BusinessApplication",
  "Guides & Docs": "ReferenceApplication",
  "Forks & Derivatives": "DeveloperApplication",
};

// ── GEO: SoftwareApplication JSON-LD for a project page ──
function renderSoftwareApplicationLD(repo, meta, summary) {
  const canonicalUrl = `${SITE_URL}/projects/${repo.owner}/${repo.repo}`;
  const stars = meta.stars || repo.stars || 0;
  const description = String(summary?.summary || meta.description || repo.description || "").slice(0, 500);
  const appCategory = CATEGORY_TO_SCHEMA_APP[repo.category] || "DeveloperApplication";
  const license = meta.license && meta.license !== "NOASSERTION" && /^[A-Za-z0-9][\w\-.+]*$/.test(meta.license)
    ? `https://spdx.org/licenses/${meta.license}.html`
    : null;

  const node = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": canonicalUrl + "#software",
    name: repo.name || repo.repo,
    description,
    url: canonicalUrl,
    codeRepository: repo.url,
    applicationCategory: appCategory,
    operatingSystem: "Cross-platform",
    ...(meta.language ? { programmingLanguage: meta.language } : {}),
    ...(license ? { license } : {}),
    author: {
      "@type": "Organization",
      name: repo.owner,
      url: `https://github.com/${repo.owner}`,
    },
    ...(meta.pushedAt ? { dateModified: new Date(meta.pushedAt).toISOString() } : {}),
    ...(stars > 0 ? {
      interactionStatistic: {
        "@type": "InteractionCounter",
        interactionType: { "@type": "LikeAction" },
        userInteractionCount: stars,
      },
    } : {}),
    isPartOf: { "@id": "https://hermesatlas.com/#website" },
  };

  return ldJson(node);
}

// ── GEO: CollectionPage + ItemList JSON-LD for a list page ──
function renderCollectionPageLD(list, matchedRepos) {
  const canonicalUrl = `${SITE_URL}/lists/${list.slug}`;
  const sorted = matchedRepos.slice().sort((a, b) => (b.meta?.stars || b.stars) - (a.meta?.stars || a.stars));

  const node = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": canonicalUrl,
    name: list.title,
    description: list.description,
    url: canonicalUrl,
    isPartOf: { "@id": "https://hermesatlas.com/#website" },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: sorted.length,
      itemListOrder: "https://schema.org/ItemListOrderDescending",
      itemListElement: sorted.map((r, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${SITE_URL}/projects/${r.owner}/${r.repo}`,
        name: `${r.owner}/${r.repo}`,
      })),
    },
  };

  return ldJson(node);
}

// ── GEO: FAQPage JSON-LD (consumed by reports/other hand-authored pages) ──
function renderFAQPageLD(faqs) {
  const node = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
  return ldJson(node);
}

// ── GEO: explicit multi-bot robots.txt with wildcard default closer ──
function buildRobotsTxt() {
  const aiBots = [
    "GPTBot", "ChatGPT-User", "OAI-SearchBot",
    "ClaudeBot", "anthropic-ai", "Claude-User", "Claude-SearchBot", "Claude-Web",
    "Google-Extended", "Googlebot", "Googlebot-News", "Googlebot-Image",
    "PerplexityBot", "Perplexity-User",
    "Applebot", "Applebot-Extended",
    "Bingbot",
    "Meta-ExternalAgent", "Meta-ExternalFetcher", "FacebookBot",
    "Amazonbot",
    "cohere-ai", "cohere-training-data-crawler",
    "MistralAI-User",
    "Bytespider",
    "DuckAssistBot", "DuckDuckBot",
    "YouBot",
  ];
  const stanzas = aiBots.map((bot) => `User-agent: ${bot}\nAllow: /`).join("\n\n");
  return `# Hermes Atlas — robots.txt
# Explicit welcome to AI crawlers and search-engine bots.
# The wildcard default below covers every other agent.

${stanzas}

User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`;
}

// ── GEO: strip HTML to readable plain-text for llms-full.txt ingestion ──
function stripHtmlToText(html) {
  return html
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]+(?=\r?\n)/g, "")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

// ── GEO: derive addedAt (first-seen commit date) for each repo via git log ──
// Walks history of data/repos.json (small — ~20 commits), records the earliest
// commit that contained each {owner, repo} pair.
function computeAddedDates() {
  const dates = {};
  try {
    const log = execSync('git log --reverse --format="%H %cI" -- data/repos.json', {
      cwd: ROOT,
      encoding: "utf-8",
    }).trim();
    if (!log) return dates;

    for (const line of log.split("\n")) {
      const spaceIdx = line.indexOf(" ");
      if (spaceIdx === -1) continue;
      const hash = line.slice(0, spaceIdx);
      const date = line.slice(spaceIdx + 1);
      let snapshot;
      try {
        const raw = execSync(`git show ${hash}:data/repos.json`, { cwd: ROOT, encoding: "utf-8" });
        snapshot = JSON.parse(raw);
      } catch {
        continue;
      }
      if (!Array.isArray(snapshot)) continue;
      for (const r of snapshot) {
        const key = `${r.owner}/${r.repo}`;
        if (!dates[key]) dates[key] = date;
      }
    }
  } catch (e) {
    console.warn("  computeAddedDates failed (non-fatal):", e.message);
  }
  return dates;
}

// ── GEO: RSS 2.0 feed of the 30 most recently added repos ──
function generateRssFeed(repos, addedDates, summaries) {
  const now = new Date().toUTCString();
  const withDates = repos
    .map((r) => {
      const key = `${r.owner}/${r.repo}`;
      return {
        ...r,
        key,
        addedAt: addedDates[key] || null,
      };
    })
    .filter((r) => r.addedAt)
    .sort((a, b) => (a.addedAt < b.addedAt ? 1 : -1))
    .slice(0, 30);

  const xmlEscape = (s) =>
    String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const items = withDates
    .map((r) => {
      const summary = summaries[r.key]?.summary;
      const blurb = summary || r.description || "";
      const url = `${SITE_URL}/projects/${r.owner}/${r.repo}`;
      const pubDate = new Date(r.addedAt).toUTCString();
      return `    <item>
      <title>${xmlEscape(r.name || r.repo)} (${xmlEscape(r.category)})</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <category>${xmlEscape(r.category)}</category>
      <description>${xmlEscape(blurb.slice(0, 500))}</description>
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Hermes Atlas — new projects</title>
    <link>${SITE_URL}/</link>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
    <description>Newly added community-built tools, skills, plugins, and integrations for Nous Research's Hermes Agent. Updated daily.</description>
    <language>en</language>
    <lastBuildDate>${now}</lastBuildDate>
    <generator>hermesatlas.com/scripts/build-pages.js</generator>
${items}
  </channel>
</rss>
`;
}

// ── GEO: write llms.txt (concise index) + llms-full.txt (full bundle) ──
function writeLlmsFiles(repos, lists, summaries, reports = []) {
  const today = new Date().toISOString().slice(0, 10);
  const sorted = repos.slice().sort((a, b) => (b.stars || 0) - (a.stars || 0));
  const topProjects = sorted.slice(0, 15);
  const categoryCount = new Set(repos.map((r) => r.category)).size;

  // ── llms.txt ──
  const llmsTxt = `# Hermes Atlas

> The community-curated ecosystem map for Hermes Agent by Nous Research — ${repos.length}+ tools, skills, plugins, and integrations with live GitHub data and AI-generated summaries. Updated daily. As of ${today}.

Hermes Atlas tracks every open-source project in the Hermes Agent ecosystem across ${categoryCount} categories. Each project has a dedicated page with a prose summary, live star count, README, and category metadata. The full catalog is also available as JSON at ${SITE_URL}/data/repos.json for programmatic access.

## Guide
- [Beginner's Guide to Hermes Agent](${SITE_URL}/guide/): Install, pick a model, ship your first workflow, with the best community tool for every step.
- [Install Hermes Agent](${SITE_URL}/guide/install/): Step-by-step install for macOS, Linux, Windows, and WSL, with troubleshooting.
- [The Hermes Agent Memory Guidebook](${SITE_URL}/guide/memory/): Kevin Simback's guide to native memory, MemoryProviders, and community memory plug-ins.
- [Hermes Agent vs. Claude Code](${SITE_URL}/guide/vs-claude-code/): Feature-by-feature comparison for choosing between the two.

## Masterclass
- [Tonbi's Hermes Agent Masterclass](${SITE_URL}/masterclass/): Ten video modules covering setup, deployment, memory, skills, models, tools, automation, subagents, profiles, Kanban, and security, with transcript-derived field notes and timestamp links.

## Dev Tutorial
A hands-on developer tutorial for building on the Hermes Agent codebase, written for agentic developers (no CS degree assumed). Seven modules plus reference sheets.
- [Build on Hermes Agent (index)](${SITE_URL}/dev/): The tutorial hub — 7 modules from mental model to shipping your own extension.
- [What Hermes Agent actually is](${SITE_URL}/dev/what-is-hermes-agent): The mental model — an agent is a loop, not a chatbot.
- [The agent loop](${SITE_URL}/dev/agent-loop): Tracing one message through think → call tool → see result → repeat.
- [Tools & toolsets](${SITE_URL}/dev/tools-and-toolsets): What a tool is, the self-registering registry, and the approval safety model.
- [Skills — the self-improvement loop](${SITE_URL}/dev/skills): Author a Markdown skill by hand; how the agent improves its own.
- [Memory & cross-session recall](${SITE_URL}/dev/memory): MEMORY.md, the user profile, FTS5 session search, pluggable backends.
- [MCP, the gateway & cron](${SITE_URL}/dev/mcp-gateway-cron): More tools (MCP), more places (gateway), more time (cron).
- [Building on Hermes](${SITE_URL}/dev/building-on-hermes): The Footprint Ladder, embedding the agent as a Python library, subagents.
- [Glossary](${SITE_URL}/dev/glossary): Plain-English definitions of every Hermes term.
- [Codebase map & cheat sheet](${SITE_URL}/dev/codebase-map): Where to edit X — key files, the ~/.hermes data dir, and commands.
- [Skill authoring template](${SITE_URL}/dev/skill-template): A copy-paste SKILL.md with annotated frontmatter.

## Top Projects
${topProjects.map((r) => `- [${r.owner}/${r.repo}](${SITE_URL}/projects/${r.owner}/${r.repo}): ${r.description} (${(r.stars || 0).toLocaleString()} stars${r.official ? ", official" : ""})`).join("\n")}

## Curated Lists
${lists.map((l) => `- [${l.title}](${SITE_URL}/lists/${l.slug}): ${l.description.slice(0, 180)}`).join("\n")}

## Data
- [Full catalog JSON](${SITE_URL}/data/repos.json): Machine-readable catalog of every tracked project.
- [AI-generated summaries](${SITE_URL}/data/summaries.json): Prose summary + highlights for each project.
- [Per-list summaries](${SITE_URL}/data/list-summaries.json): Curated prose for each list-page project.
- [Full context bundle](${SITE_URL}/llms-full.txt): Concatenated content of every guide, report, and summary for direct LLM ingestion.
- [Sitemap](${SITE_URL}/sitemap.xml): All URLs with last-modified dates.

## Reports
- [Reports index](${SITE_URL}/reports/): Quarterly community reports on the Hermes Agent ecosystem.
${reports.map((r) => `- [${r.title}](${SITE_URL}/reports/${r.slug}): ${r.summary}`).join("\n")}

## Optional
- [Privacy policy](${SITE_URL}/privacy): How the site handles visitor data.
- [GitHub source](https://github.com/ksimback/hermes-ecosystem): The repo backing this site.
`;

  fs.writeFileSync(path.join(ROOT, "llms.txt"), llmsTxt, "utf-8");
  console.log(`  llms.txt (${Buffer.byteLength(llmsTxt, "utf-8")} bytes)`);

  // ── llms-full.txt ──
  const sections = [];

  sections.push(`# Hermes Atlas — Full Context Bundle

> Complete content of hermesatlas.com as of ${today}. Concatenated from guide pages, ecosystem overview, the quarterly report, and project summaries. Canonical URLs preserved throughout.

This file is the companion to ${SITE_URL}/llms.txt (the concise index).`);

  try {
    const ecosystem = fs.readFileSync(path.join(ROOT, "ECOSYSTEM.md"), "utf-8");
    sections.push(`# ECOSYSTEM\n\n${ecosystem}`);
  } catch {}

  try {
    const hubDraft = fs.readFileSync(path.join(ROOT, "drafts", "handbook-hub.md"), "utf-8");
    sections.push(`# The Hermes Handbook (/guide/)\n\nCanonical URL: ${SITE_URL}/guide/\n\n${hubDraft}`);
  } catch {}

  try {
    const vsDraft = fs.readFileSync(path.join(ROOT, "drafts", "handbook-vs-claude-code.md"), "utf-8");
    sections.push(`# Hermes vs Claude Code (/guide/vs-claude-code/)\n\nCanonical URL: ${SITE_URL}/guide/vs-claude-code/\n\n${vsDraft}`);
  } catch {}

  try {
    const installHtml = fs.readFileSync(path.join(ROOT, "guide", "install", "index.html"), "utf-8");
    const stripped = stripHtmlToText(installHtml);
    if (stripped) sections.push(`# Install Hermes Agent (/guide/install/)\n\nCanonical URL: ${SITE_URL}/guide/install/\n\n${stripped}`);
  } catch {}

  try {
    const memoryDraft = fs.readFileSync(path.join(ROOT, "drafts", "guide-memory.md"), "utf-8");
    sections.push(`# The Hermes Agent Memory Guidebook (/guide/memory/)\n\nCanonical URL: ${SITE_URL}/guide/memory/\n\n${memoryDraft}`);
  } catch {}

  try {
    const masterclassHtml = fs.readFileSync(path.join(ROOT, "masterclass", "index.html"), "utf-8");
    const stripped = stripHtmlToText(masterclassHtml);
    if (stripped) sections.push(`# Tonbi's Hermes Agent Masterclass (/masterclass/)\n\nCanonical URL: ${SITE_URL}/masterclass/\n\n${stripped}`);
  } catch {}

  try {
    const reportHtml = fs.readFileSync(path.join(ROOT, "reports", "state-of-hermes-april-2026.html"), "utf-8");
    const stripped = stripHtmlToText(reportHtml);
    if (stripped) sections.push(`# State of Hermes — April 2026\n\nCanonical URL: ${SITE_URL}/reports/state-of-hermes-april-2026\n\n${stripped}`);
  } catch {}

  sections.push(`# Project Catalog (${repos.length} projects)`);
  for (const repo of sorted) {
    const key = `${repo.owner}/${repo.repo}`;
    const sum = summaries[key];
    const body = [
      `URL: ${SITE_URL}/projects/${repo.owner}/${repo.repo}`,
      `GitHub: ${repo.url}`,
      `Category: ${repo.category}`,
      `Stars: ${(repo.stars || 0).toLocaleString()}`,
      repo.official ? `Official: Yes (maintained by Nous Research)` : null,
      "",
      repo.description,
    ].filter(Boolean).join("\n");

    let summarySection = "";
    if (sum?.summary) {
      summarySection = `\n\n${sum.summary}`;
      if (sum.highlights?.length) {
        summarySection += `\n\nHighlights:\n${sum.highlights.map((h) => `- ${h}`).join("\n")}`;
      }
    }

    sections.push(`## ${key}\n\n${body}${summarySection}`);
  }

  const llmsFull = sections.join("\n\n---\n\n") + "\n";
  const fullBytes = Buffer.byteLength(llmsFull, "utf-8");

  if (fullBytes > 1_000_000) {
    throw new Error(`llms-full.txt exceeded 1 MB limit (${fullBytes} bytes). Prune content or raise the cap after auditing impact.`);
  }

  fs.writeFileSync(path.join(ROOT, "llms-full.txt"), llmsFull, "utf-8");
  console.log(`  llms-full.txt (${fullBytes} bytes)`);
}

// ── Project page template ──
function renderProjectPage(repo, meta, readmeHtml, relatedRepos, summary, handbookMention) {
  // Owner-qualified title: several catalog entries share a bare repo name
  // (hermes-desktop, hermes-webui, ...) — without the owner the pairs emit
  // byte-identical <title> tags on different URLs, a duplicate-content signal.
  const titleName = repo.name.includes("/") ? repo.name : `${repo.owner}/${repo.name}`;
  const title = `${titleName} — Hermes Agent ${repo.category} | Hermes Atlas`;
  // Prefer the AI summary for the meta description: it's always English prose
  // (GitHub descriptions can be non-English) and richer than one-line taglines.
  const desc = escapeHtml(truncate(summary?.summary || meta.description || repo.description, 160));
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
<meta property="og:title" content="${escapeHtml(titleName)} — Hermes Atlas">
<meta property="og:description" content="${desc}">
<meta property="og:type" content="article">
<meta property="og:url" content="${canonicalUrl}">
<meta property="og:site_name" content="Hermes Atlas">
<meta property="og:image" content="${escapeHtml(ogImageUrl({ title: repo.name, subtitle: meta.description || repo.description, kind: "project · " + repo.category.toLowerCase().split("&")[0].trim() }))}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(titleName)} — Hermes Atlas">
<meta name="twitter:description" content="${desc}">
<meta name="twitter:image" content="${escapeHtml(ogImageUrl({ title: repo.name, subtitle: meta.description || repo.description, kind: "project · " + repo.category.toLowerCase().split("&")[0].trim() }))}">
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "map", "item": "https://hermesatlas.com/" },
    { "@type": "ListItem", "position": 2, "name": "${escapeHtml(repo.category.toLowerCase())}", "item": "https://hermesatlas.com${listSlug ? `/lists/${listSlug}` : "/"}" },
    { "@type": "ListItem", "position": 3, "name": "${escapeHtml(repo.repo.toLowerCase())}" }
  ]
}
</script>
${renderSoftwareApplicationLD(repo, meta, summary)}
<link rel="alternate" type="application/rss+xml" title="Hermes Atlas — new projects" href="/rss.xml">
${FAVICON}
<script src="/assets/js/theme-init.js"></script>
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

<main id="main">

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

${handbookMention ? `
<aside class="handbook-mention" aria-label="Mentioned in the Hermes Handbook">
  <div class="hm-label">mentioned in</div>
  <a class="hm-link" href="/guide/${handbookMention.chapter || ""}"><strong>The Hermes Handbook</strong> — beginner's guide →</a>
  <p class="hm-context">${escapeHtml(handbookMention.context)}</p>
</aside>` : ""}

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

</main>

${PAGE_FOOTER}

<script src="/assets/js/theme-toggle.js" defer></script>
<script src="/assets/js/masthead-fetch.js" defer></script>
<!-- Cloudflare Web Analytics -->
<script defer src="https://static.cloudflareinsights.com/beacon.min.js"
        data-cf-beacon='{"token": "fe0d4d79280b4386b6b0cd99b2d94dbc"}'></script>
<!-- End Cloudflare Web Analytics -->
</body>
</html>`;
}

// ── List page template ──
function renderListPage(list, matchedRepos, listSummaryEntries) {
  const title = `${list.title} | Hermes Atlas`;
  const desc = escapeHtml(truncate(list.description, 160));
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
<meta property="og:image" content="${escapeHtml(ogImageUrl({ title: list.title, subtitle: list.description, kind: "list" }))}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(list.title)}">
<meta name="twitter:image" content="${escapeHtml(ogImageUrl({ title: list.title, subtitle: list.description, kind: "list" }))}">
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "map", "item": "https://hermesatlas.com/" },
    { "@type": "ListItem", "position": 2, "name": "lists", "item": "https://hermesatlas.com/lists/" },
    { "@type": "ListItem", "position": 3, "name": "${escapeHtml(list.slug)}" }
  ]
}
</script>
${renderCollectionPageLD(list, matchedRepos)}
<link rel="alternate" type="application/rss+xml" title="Hermes Atlas — new projects" href="/rss.xml">
${FAVICON}
<script src="/assets/js/theme-init.js"></script>
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
  <a href="/">map</a><span class="sep">/</span><a href="/lists/">lists</a><span class="sep">/</span>${escapeHtml(list.slug)}
</div>

<main id="main">

<section class="list-page">
  <h1 class="list-title">${escapeHtml(list.title)}</h1>
  <p class="list-intro">${escapeHtml(list.description)}</p>
  ${list.slug === "best-memory-providers" ? '<p class="list-intro">For the architecture behind these tools, read <a href="/guide/memory/">The Hermes Agent Memory Guidebook</a>.</p>' : ""}
</section>

<div class="list-table" aria-label="Ranked list">
  <div class="list-table-head">
    <div>#</div>
    <div>project</div>
    <div class="text-right">stars</div>
  </div>
  ${repoRows}
</div>
${listicleHtml}

<div class="back-link"><a href="/">← back to the map</a></div>

</main>

${PAGE_FOOTER}

<script src="/assets/js/theme-toggle.js" defer></script>
<script src="/assets/js/masthead-fetch.js" defer></script>
<!-- Cloudflare Web Analytics -->
<script defer src="https://static.cloudflareinsights.com/beacon.min.js"
        data-cf-beacon='{"token": "fe0d4d79280b4386b6b0cd99b2d94dbc"}'></script>
<!-- End Cloudflare Web Analytics -->
</body>
</html>`;
}

// ── Lists index (/lists/) ──
// Replaces the old hand-authored, off-template orphan page: this one carries
// the shared masthead/footer, JSON-LD, and is linked from every page's nav —
// it's the hub for the directory-intent queries the list pages target.
function renderListsIndex(lists, repos) {
  const title = "Curated Lists — the best Hermes Agent tools by use case | Hermes Atlas";
  const desc = "Curated lists of the best Hermes Agent skills, memory providers, workspaces & GUIs, deployment options, developer tools, and multi-agent frameworks.";
  const canonicalUrl = `${SITE_URL}/lists/`;
  const ogTitle = "Curated Lists — Hermes Atlas";
  const ogSubtitle = "The best Hermes Agent tools by use case, ranked by GitHub stars.";

  const countFor = (list) =>
    list.filter?.category ? repos.filter((r) => r.category === list.filter.category).length : 0;

  const collectionLD = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": canonicalUrl,
    name: "Curated Lists — Hermes Agent tools by use case",
    description: desc,
    url: canonicalUrl,
    isPartOf: { "@id": "https://hermesatlas.com/#website" },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: lists.length,
      itemListElement: lists.map((l, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${SITE_URL}/lists/${l.slug}`,
        name: l.title,
      })),
    },
  };

  const breadcrumbLD = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "map", item: "https://hermesatlas.com/" },
      { "@type": "ListItem", position: 2, name: "lists" },
    ],
  };

  const listRows = lists.map((l, i) => {
    const rank = String(i + 1).padStart(2, "0");
    const count = countFor(l);
    return `<a class="list-row" href="/lists/${escapeHtml(l.slug)}">
    <div class="list-rank">${rank}</div>
    <div class="list-cell-body">
      <div class="list-cell-name">${escapeHtml(l.title)}</div>
      <div class="list-cell-desc">${escapeHtml(truncate(l.description, 140))}</div>
    </div>
    <div class="list-cell-stars">${count} projects</div>
  </a>`;
  }).join("\n  ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}">
<link rel="canonical" href="${canonicalUrl}">
<meta property="og:title" content="${escapeHtml(ogTitle)}">
<meta property="og:description" content="${escapeHtml(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${canonicalUrl}">
<meta property="og:site_name" content="Hermes Atlas">
<meta property="og:image" content="${escapeHtml(ogImageUrl({ title: ogTitle, subtitle: ogSubtitle, kind: "lists" }))}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(ogTitle)}">
<meta name="twitter:image" content="${escapeHtml(ogImageUrl({ title: ogTitle, subtitle: ogSubtitle, kind: "lists" }))}">
${ldJson(breadcrumbLD)}
${ldJson(collectionLD)}
<link rel="alternate" type="application/rss+xml" title="Hermes Atlas — new projects" href="/rss.xml">
${FAVICON}
<script src="/assets/js/theme-init.js"></script>
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
  <a href="/">map</a><span class="sep">/</span>lists
</div>

<main id="main">

<section class="list-page">
  <h1 class="list-title">Curated Lists</h1>
  <p class="list-intro">The best Hermes Agent tools by use case — skills, memory providers, workspaces &amp; GUIs, deployment options, developer tools, and multi-agent frameworks. Every list is ranked by GitHub stars and refreshed with live data.</p>
</section>

<div class="list-table" aria-label="Curated lists">
  <div class="list-table-head">
    <div>#</div>
    <div>list</div>
    <div class="text-right">size</div>
  </div>
  ${listRows}
</div>

<div class="back-link"><a href="/">← back to the map</a></div>

</main>

${PAGE_FOOTER}

<script src="/assets/js/theme-toggle.js" defer></script>
<script src="/assets/js/masthead-fetch.js" defer></script>
<!-- Cloudflare Web Analytics -->
<script defer src="https://static.cloudflareinsights.com/beacon.min.js"
        data-cf-beacon='{"token": "fe0d4d79280b4386b6b0cd99b2d94dbc"}'></script>
<!-- End Cloudflare Web Analytics -->
</body>
</html>`;
}

// ── Reports index (/reports/) ──
function formatReportDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return iso;
  const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

function renderReportsIndex(reports) {
  const title = "Reports | Hermes Atlas";
  const desc = "Quarterly community reports on the Hermes Agent ecosystem — growth, releases, what's been built, and what to watch for next.";
  const canonicalUrl = `${SITE_URL}/reports/`;
  const ogTitle = "Reports — Hermes Atlas";
  const ogSubtitle = "Quarterly community reports on the Hermes Agent ecosystem.";

  const itemListLD = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": canonicalUrl,
    name: "Hermes Atlas Reports",
    description: desc,
    url: canonicalUrl,
    isPartOf: { "@id": "https://hermesatlas.com/#website" },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: reports.length,
      itemListOrder: "https://schema.org/ItemListOrderDescending",
      itemListElement: reports.map((r, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${SITE_URL}/reports/${r.slug}`,
        name: r.title,
      })),
    },
  };

  const breadcrumbLD = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "map", item: "https://hermesatlas.com/" },
      { "@type": "ListItem", position: 2, name: "reports" },
    ],
  };

  const reportRows = reports.map((r, i) => {
    const rank = String(i + 1).padStart(2, "0");
    const dateStr = escapeHtml(formatReportDate(r.date));
    const readTime = r.readTime ? ` · ${escapeHtml(r.readTime)} read` : "";
    const kicker = r.kicker ? `<div class="list-cell-kicker">${escapeHtml(r.kicker)}</div>` : "";
    return `<a class="list-row" href="/reports/${escapeHtml(r.slug)}">
    <div class="list-rank">${rank}</div>
    <div class="list-cell-body">
      ${kicker}
      <div class="list-cell-name">${escapeHtml(r.title)}</div>
      <div class="list-cell-desc">${escapeHtml(r.summary || "")}</div>
    </div>
    <div class="list-cell-stars">${dateStr}${readTime}</div>
  </a>`;
  }).join("\n  ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}">
<link rel="canonical" href="${canonicalUrl}">
<meta property="og:title" content="${escapeHtml(ogTitle)}">
<meta property="og:description" content="${escapeHtml(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${canonicalUrl}">
<meta property="og:site_name" content="Hermes Atlas">
<meta property="og:image" content="${escapeHtml(ogImageUrl({ title: ogTitle, subtitle: ogSubtitle, kind: "reports" }))}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(ogTitle)}">
<meta name="twitter:image" content="${escapeHtml(ogImageUrl({ title: ogTitle, subtitle: ogSubtitle, kind: "reports" }))}">
<script type="application/ld+json">
${JSON.stringify(breadcrumbLD, null, 2).replace(/</g, "\u003c")}
</script>
<script type="application/ld+json">
${JSON.stringify(itemListLD, null, 2).replace(/</g, "\u003c")}
</script>
<link rel="alternate" type="application/rss+xml" title="Hermes Atlas — new projects" href="/rss.xml">
${FAVICON}
<script src="/assets/js/theme-init.js"></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="/assets/css/tokens.css">
<link rel="stylesheet" href="/assets/css/base.css">
<link rel="stylesheet" href="/assets/css/page.css">
</head>
<body>

<a class="skip-link" href="#main">Skip to content</a>

${renderMasthead("reports")}

<div class="breadcrumb" aria-label="Breadcrumb">
  <a href="/">map</a><span class="sep">/</span>reports
</div>

<main id="main">

<section class="list-page">
  <h1 class="list-title">Reports</h1>
  <p class="list-intro">Quarterly community reports on the Hermes Agent ecosystem — growth, releases, what's been built, and what to watch for next.</p>
</section>

<div class="list-table" aria-label="Report list">
  <div class="list-table-head">
    <div>#</div>
    <div>report</div>
    <div class="text-right">published</div>
  </div>
  ${reportRows}
</div>

<div class="back-link"><a href="/">← back to the map</a></div>

</main>

${PAGE_FOOTER}

<script src="/assets/js/theme-toggle.js" defer></script>
<script src="/assets/js/masthead-fetch.js" defer></script>
<!-- Cloudflare Web Analytics -->
<script defer src="https://static.cloudflareinsights.com/beacon.min.js"
        data-cf-beacon='{"token": "fe0d4d79280b4386b6b0cd99b2d94dbc"}'></script>
<!-- End Cloudflare Web Analytics -->
</body>
</html>`;
}

// ── Generate sitemap.xml ──
// Guide/dev entries are discovered from disk (a new page reaches the sitemap
// without touching this function), and <lastmod> is the file's real last
// change: today if this build rewrote it, otherwise its last git commit date.
// Stamping everything "today" trains crawlers to ignore the signal entirely.
function generateSitemap(projectPages, listPages, reportPages = []) {
  const entry = (urlPath, relFile, changefreq, priority) =>
    `  <url><loc>${SITE_URL}${urlPath}</loc><changefreq>${changefreq}</changefreq><priority>${priority}</priority><lastmod>${lastmodFor(relFile)}</lastmod></url>\n`;

  let urls = entry("/", "index.html", "daily", "1.0");

  urls += entry("/guide/", "guide/index.html", "monthly", "0.9");
  const guideSlugs = fs.readdirSync(path.join(ROOT, "guide"), { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(ROOT, "guide", d.name, "index.html")))
    .map((d) => d.name)
    .sort();
  for (const slug of guideSlugs) {
    urls += entry(`/guide/${slug}/`, `guide/${slug}/index.html`, "monthly", "0.8");
  }

  urls += entry("/masterclass/", "masterclass/index.html", "monthly", "0.9");

  urls += entry("/dev/", "dev/index.html", "monthly", "0.9");
  const devSlugs = fs.readdirSync(path.join(ROOT, "dev"))
    .filter((f) => f.endsWith(".html") && f !== "index.html")
    .map((f) => f.replace(/\.html$/, ""))
    .sort();
  for (const slug of devSlugs) {
    urls += entry(`/dev/${slug}`, `dev/${slug}.html`, "monthly", "0.7");
  }

  urls += entry("/reports/", "reports/index.html", "monthly", "0.8");
  for (const r of reportPages) {
    urls += entry(`/reports/${r.slug}`, `reports/${r.slug}.html`, "monthly", "0.7");
  }
  urls += entry("/privacy", "privacy/index.html", "yearly", "0.3");

  for (const page of projectPages) {
    urls += entry(`/projects/${page.owner}/${page.repo}`, `projects/${page.owner}/${page.repo}.html`, "weekly", "0.8");
  }

  urls += entry("/lists/", "lists/index.html", "weekly", "0.7");
  for (const list of listPages) {
    urls += entry(`/lists/${list.slug}`, `lists/${list.slug}.html`, "weekly", "0.6");
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}</urlset>\n`;
}

// ── Render a single homepage repo-row block ──
function renderHomepageRepoRow(r) {
  const stars = (r.stars || 0).toLocaleString("en-US");
  const flag = r.official ? ' <span class="repo-flag">official</span>' : "";
  const desc = (r.description || "").trim();
  const descPunctuated = desc.endsWith(".") ? desc : desc + ".";
  return `    <a class="repo-row" href="/projects/${r.owner}/${r.repo}" data-github="https://github.com/${r.owner}/${r.repo}" data-desc="${escapeHtml(desc)}">
      <div class="repo-stars">★ ${stars}</div>
      <div class="repo-body">
        <div class="repo-name"><span class="org">${escapeHtml(r.owner)} /</span> ${escapeHtml(r.repo)}${flag}</div>
        <div class="repo-desc">${escapeHtml(descPunctuated)}</div>
      </div>
      <div class="repo-delta">— / wk</div>
    </a>
`;
}

// ── Sync homepage repo-rows from data/repos.json (append-only) ──
//
// The homepage (index.html) is statically rendered HTML. Auto-discovered
// repos that get merged via validate-repo-suggestion.yml only update
// data/repos.json — they don't touch index.html, so the homepage drifts
// behind the data file. This function detects every repo in repos.json
// missing from index.html and appends a new <a class="repo-row"> block
// into the matching <section class="cat" data-category="...">. Existing
// rows are never modified, preserving hand-curated descriptions and
// ordering. Each section's <span class="cat-count-n"> is also rewritten
// from the live count.
function syncHomepageRepos(repos) {
  console.log("\nSyncing homepage repo-rows from repos.json...");
  const indexPath = path.join(ROOT, "index.html");
  let html = fs.readFileSync(indexPath, "utf-8");
  const NL = html.includes("\r\n") ? "\r\n" : "\n";

  // Prune stale repo-rows before syncing. The append-only add logic below never
  // removes rows, so entries pruned from data/repos.json (dead/renamed repos)
  // and any duplicate rows left behind by double-submission linger as broken
  // links. Drop any repo-row whose owner/repo is not in repos.json, and collapse
  // duplicate rows to the first occurrence. Only touches <a class="repo-row">
  // anchors — the hand-curated featured hero uses different markup.
  const validKeys = new Set(repos.map((r) => `${r.owner}/${r.repo}`));
  const seenRows = new Set();
  let removedInvalid = 0;
  let removedDup = 0;
  html = html.replace(
    /\n[ \t]*<a class="repo-row" href="\/projects\/([^"]+)"[\s\S]*?<\/a>/g,
    (block, key) => {
      if (!validKeys.has(key)) {
        removedInvalid++;
        return "";
      }
      if (seenRows.has(key)) {
        removedDup++;
        return "";
      }
      seenRows.add(key);
      return block;
    }
  );
  if (removedInvalid || removedDup) {
    console.log(`  Pruned ${removedInvalid} dead + ${removedDup} duplicate repo-rows`);
  }

  const onPage = new Set(
    [...html.matchAll(/href="\/projects\/([^"]+)"/g)].map((m) => m[1])
  );

  // Refresh stale star counts on existing rendered rows. The append-only
  // policy preserves hand-curated descriptions, but star counts are pure
  // live data — without this pass they stay frozen at the value the row
  // had when first added, even after data/repos.json gets refreshed by
  // the GraphQL pass in main(). Touches only the ★ NNNN text inside each
  // <div class="repo-stars">; everything else is left as-is.
  const repoByKey = new Map(repos.map((r) => [`${r.owner}/${r.repo}`, r]));
  let rowsRefreshed = 0;
  html = html.replace(
    /(data-github="https:\/\/github\.com\/([^"]+)"[^>]*>\s*<div class="repo-stars">★ )([0-9,]+)(<\/div>)/g,
    (full, prefix, key, oldStars, suffix) => {
      const r = repoByKey.get(key);
      if (!r || typeof r.stars !== "number") return full;
      const newStars = r.stars.toLocaleString("en-US");
      if (newStars === oldStars) return full;
      rowsRefreshed++;
      return prefix + newStars + suffix;
    }
  );
  if (rowsRefreshed > 0) {
    console.log(`  Refreshed star counts on ${rowsRefreshed} existing rows`);
  }

  const missingByCategory = {};
  const queuedMissing = new Set();
  for (const r of repos) {
    const key = `${r.owner}/${r.repo}`;
    if (!onPage.has(key) && !queuedMissing.has(key)) {
      queuedMissing.add(key);
      (missingByCategory[r.category] = missingByCategory[r.category] || []).push(r);
    }
  }
  const missingCount = Object.values(missingByCategory).reduce((a, b) => a + b.length, 0);

  if (missingCount === 0) {
    console.log("  Already in sync (0 entries to add)");
  } else {
    const closeNeedle = `${NL}  </div>${NL}`;
    for (const [category, missing] of Object.entries(missingByCategory)) {
      missing.sort((a, b) => (b.stars || 0) - (a.stars || 0));
      let newRowsHtml = missing.map(renderHomepageRepoRow).join("");
      if (NL === "\r\n") newRowsHtml = newRowsHtml.replace(/\n/g, "\r\n");

      const sectionStartTag = `<section class="cat" data-category="${category}">`;
      const sectionStart = html.indexOf(sectionStartTag);
      if (sectionStart === -1) {
        console.warn(`  ⚠ Section not found: ${category} — skipping ${missing.length} repos`);
        continue;
      }
      const sectionEnd = html.indexOf("</section>", sectionStart);
      const insertBefore = html.lastIndexOf(closeNeedle, sectionEnd);
      if (insertBefore === -1 || insertBefore < sectionStart) {
        console.warn(`  ⚠ Could not locate cat-list end in section: ${category}`);
        continue;
      }

      html =
        html.slice(0, insertBefore) +
        NL +
        newRowsHtml.trimEnd() +
        html.slice(insertBefore);
      console.log(`  ${category}: +${missing.length}`);
    }
  }

  // Refresh per-category counts from repos.json, which is the public source
  // of truth used by smoke-test-prod.js and external consumers. Some homepage
  // sections intentionally omit or retain hand-curated rows (for example the
  // featured Hermes Agent hero), so rendered row counts are not reliable
  // catalog counts.
  const categoryTotals = repos.reduce((acc, r) => {
    acc.set(r.category, (acc.get(r.category) || 0) + 1);
    return acc;
  }, new Map());
  const sectionRe = /<section class="cat" data-category="([^"]+)">([\s\S]*?)<\/section>/g;
  let sm;
  while ((sm = sectionRe.exec(html)) !== null) {
    const category = sm[1];
    const sectionContent = sm[2];
    const expectedCount = categoryTotals.get(category) || 0;
    const countMatch = sectionContent.match(/<span class="cat-count-n">(\d+)<\/span>/);
    if (countMatch && parseInt(countMatch[1], 10) !== expectedCount) {
      const absoluteIdx = sm.index + sm[0].indexOf(countMatch[0]);
      html =
        html.slice(0, absoluteIdx) +
        `<span class="cat-count-n">${expectedCount}</span>` +
        html.slice(absoluteIdx + countMatch[0].length);
      // Re-prime the regex to re-scan from current position since string length changed
      sectionRe.lastIndex = absoluteIdx;
    }
  }

  // Bake the current Hermes version into the static homepage spans from the
  // authoritative release notes (data/latest-release.json). Keeps the pre-JS
  // fallback fresh — the /api/stars fetch still live-updates it in the browser,
  // but without this the baked value drifts stale (it was stuck at v0.10.0 while
  // the API's live release field was returning null). No-op when unchanged.
  try {
    const lr = JSON.parse(
      fs.readFileSync(path.join(ROOT, "data", "latest-release.json"), "utf-8")
    );
    if (lr && lr.version) {
      html = html
        .replace(/(<span id="meta-version">)hermes·[^<]*(<\/span>)/, `$1hermes·${lr.version}$2`)
        .replace(/(<span[^>]*id="hero-version">)[^<]*(<\/span>)/, `$1${lr.version}$2`);
      if (lr.tag) {
        html = html.replace(
          /(<span[^>]*id="hero-version-tag">)[^<]*(<\/span>)/,
          `$1${lr.tag}$2`
        );
      }
    }
  } catch (e) {
    console.warn(`  Could not bake Hermes version into index.html: ${e.message}`);
  }

  // Bake catalog-derived counters into the static homepage. masthead-fetch.js /
  // homepage.js live-update these spans in the browser, but non-JS crawlers
  // (GPTBot, ClaudeBot, PerplexityBot) index the baked values — which otherwise
  // sit frozen at whatever count the page had when the span was hand-authored.
  const roundedCount = Math.floor(repos.length / 10) * 10;
  html = html
    .replace(/(<span id="meta-count">)[^<]*(<\/span>)/, `$1${repos.length}·repos$2`)
    .replace(/(<span class="n" id="stat-total-repos">)[^<]*(<\/span>)/, `$1${repos.length}$2`)
    .replace(/(<span id="hero-sub-count">)[^<]*(<\/span>)/, `$1${roundedCount}$2`)
    .replace(/\b\d{2,3}\+ open-source tools/g, `${roundedCount}+ open-source tools`)
    .replace(/\(\d{2,3}\+ tools\)/g, `(${roundedCount}+ tools)`)
    .replace(/\b\d{2,3}\+ projects across/g, `${roundedCount}+ projects across`);

  const flagship = repos.find((r) => r.owner === "NousResearch" && r.repo === "hermes-agent");
  if (flagship && typeof flagship.stars === "number") {
    html = html.replace(
      /(<span class="big star" id="hero-stars">)[^<]*(<\/span>)/,
      `$1${formatStars(flagship.stars)}$2`
    );
  }

  if (writePage(indexPath, html)) {
    console.log(`  ✓ Wrote index.html${missingCount > 0 ? ` (+${missingCount} new rows)` : ""}`);
  }
}

// ── Freshness pass over hand-authored guide pages + their markdown drafts ──
//
// The guide pages are written by hand, so "current release is vX" / star-count
// facts baked into their titles, meta descriptions, JSON-LD, and body copy
// drift stale between manual rewrites (the flagship guide sat 3 months and 8
// minor versions behind — exactly the fields search snippets are built from).
// Every build, anchored patterns re-stamp those facts from the same data the
// generated pages use (data/latest-release.json, data/repos.json). Date-stamp
// fields (dateModified, "Updated ...") bump only when a fact actually changed,
// so untouched builds don't fake freshness.
function refreshHandAuthoredPages(repos) {
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const monthShort = `${MONTHS[now.getUTCMonth()].slice(0, 3)} ${now.getUTCFullYear()}`;
  const monthLong = `${MONTHS[now.getUTCMonth()]} ${now.getUTCFullYear()}`;

  const version = latestHermesVersion;
  let releaseDate = today;
  try {
    const lr = JSON.parse(fs.readFileSync(latestReleasePath, "utf-8"));
    if (lr.publishedAt) releaseDate = lr.publishedAt.slice(0, 10);
  } catch {}
  const flagship = repos.find((r) => r.owner === "NousResearch" && r.repo === "hermes-agent");
  const stars = flagship && typeof flagship.stars === "number"
    ? flagship.stars.toLocaleString("en-US")
    : null;

  const factRules = [
    [/hermes·v[\d.]+/g, `hermes·${version}`],
    [/<span id="meta-version">hermes<\/span>/g, `<span id="meta-version">hermes·${version}</span>`],
    [/Hermes Agent v[\d.]+: The Complete Beginner's Guide \([A-Za-z]{3,9} \d{4}\)/g,
      `Hermes Agent ${version}: The Complete Beginner's Guide (${monthShort})`],
    [/Hermes Agent: The Complete Beginner's Guide \([A-Za-z]{3,9} \d{4}\)/g,
      `Hermes Agent: The Complete Beginner's Guide (${monthShort})`],
    [/Hermes Agent v[\d.]+ \(latest release, [A-Za-z]+ \d{4}\)/g,
      `Hermes Agent ${version} (latest release, ${monthLong})`],
    [/Hermes Agent v[\d.]+ \(latest release\)/g, `Hermes Agent ${version} (latest release)`],
    [/Current release is v[\d.]+ \(as of \d{4}-\d{2}-\d{2}\)/g,
      `Current release is ${version} (as of ${releaseDate})`],
    [/self-improving AI agent, v[\d.]+\)/g, `self-improving AI agent, ${version})`],
    [/Install Hermes Agent v[\d.]+ /g, `Install Hermes Agent ${version} `],
    [/This guide covers Hermes Agent <strong>v[\d.]+<\/strong>/g,
      `This guide covers Hermes Agent <strong>${version}</strong>`],
    [/This guide covers Hermes Agent \*\*v[\d.]+\*\*/g,
      `This guide covers Hermes Agent **${version}**`],
    [/prints v[\d.]+ \(or newer\)/g, `prints ${version} (or newer)`],
    [/Supported OSes<\/strong> \(as of v[\d.]+\)/g, `Supported OSes</strong> (as of ${version})`],
    [/Supported OSes\*\* \(as of v[\d.]+\)/g, `Supported OSes** (as of ${version})`],
    [/\d+\+ projects in the Hermes Atlas \(as of \d{4}-\d{2}-\d{2}\)/g,
      `${repos.length}+ projects in the Hermes Atlas (as of ${today})`],
    [/real community usage as of [A-Za-z]+ \d{4}\./g, `real community usage as of ${monthLong}.`],
    [/Updated [A-Za-z]+ \d{4}\./g, `Updated ${monthLong}.`],
    [/As of [A-Za-z]+ \d{4}\. Based on/g, `As of ${monthLong}. Based on`],
    [/all \d+\+ projects in the Atlas/g, `all ${repos.length}+ projects in the Atlas`],
    [/Browse all \d+\+ projects/g, `Browse all ${repos.length}+ projects`],
    [/current release<\/a> as of [A-Za-z]+ \d{4};/g, `current release</a> as of ${monthLong};`],
    [/current release\]\(([^)]+)\) as of [A-Za-z]+ \d{4};/g, `current release]($1) as of ${monthLong};`],
    [/Hermes Agent v[\d.]+ — <a href="https:\/\/github\.com\/NousResearch\/hermes-agent\/releases"/g,
      `Hermes Agent ${version} — <a href="https://github.com/NousResearch/hermes-agent/releases"`],
  ];
  if (stars) {
    factRules.push(
      [/[\d,]+ GitHub stars \(as of \d{4}-\d{2}-\d{2}\)/g, `${stars} GitHub stars (as of ${today})`],
      [/[\d,]+ GitHub stars as of \d{4}-\d{2}-\d{2}/g, `${stars} GitHub stars as of ${today}`],
      [/[\d,]+ stars \(as of \d{4}-\d{2}-\d{2}\)/g, `${stars} stars (as of ${today})`],
      [/[\d,]+ stars as of \d{4}-\d{2}-\d{2}/g, `${stars} stars as of ${today}`],
      [/As of \d{4}-\d{2}-\d{2}, yes, with caveats\. [\d,]+ GitHub stars/g,
        `As of ${today}, yes, with caveats. ${stars} GitHub stars`]
    );
  }

  const dateRules = [
    [/"dateModified": "\d{4}-\d{2}-\d{2}T[0-9:]+Z"/g, `"dateModified": "${today}T00:00:00Z"`],
    [/(property="article:modified_time" content=")\d{4}-\d{2}-\d{2}T[0-9:]+Z(")/g, `$1${today}T00:00:00Z$2`],
    [/Updated \d{4}-\d{2}-\d{2} ·/g, `Updated ${today} ·`],
    [/Last updated:<\/strong> \d{4}-\d{2}-\d{2}/g, `Last updated:</strong> ${today}`],
    [/\*\*Last updated:\*\* \d{4}-\d{2}-\d{2}/g, `**Last updated:** ${today}`],
  ];

  console.log("\nRefreshing hand-authored guide pages...");
  for (const rel of REFRESHED_CONTENT_PATHS) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    const original = fs.readFileSync(abs, "utf-8");
    let content = original;
    for (const [re, replacement] of factRules) {
      content = content.replace(re, replacement);
    }
    if (content !== original) {
      for (const [re, replacement] of dateRules) {
        content = content.replace(re, replacement);
      }
      writePage(abs, content);
      console.log(`  refreshed ${rel}`);
    }
  }
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

    // Persist refreshed stars back into repos.json. Project HTML pages render
    // from `meta.stars`, but the homepage repo-rows and any external consumer
    // of /data/repos.json (e.g. the MCP server) read `r.stars` — so without
    // this writeback the public dataset silently drifts (entries added months
    // ago kept their submitter-time star count). Scope is stars-only; every
    // other field on the repo entry is curator-managed.
    let starsRefreshed = 0;
    for (const r of repos) {
      const liveStars = metadata[`${r.owner}/${r.repo}`]?.stars;
      if (typeof liveStars === "number" && liveStars !== r.stars) {
        r.stars = liveStars;
        starsRefreshed++;
      }
    }
    if (starsRefreshed > 0) {
      const reposPath = path.join(ROOT, "data", "repos.json");
      const existingReposText = fs.readFileSync(reposPath, "utf-8");
      const eol = existingReposText.includes("\r\n") ? "\r\n" : "\n";
      // Preserve the repo file's existing line endings + trailing newline so
      // star refreshes do not churn the entire generated-data diff.
      const body = JSON.stringify(repos, null, 2).replace(/\n/g, eol) + eol;
      fs.writeFileSync(reposPath, body);
      console.log(`  Refreshed stars on ${starsRefreshed} repos in data/repos.json\n`);
    }
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

  // Load handbook mentions (which projects are cited in The Hermes Handbook)
  let handbookMentions = {};
  try {
    const hm = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "handbook-mentions.json"), "utf-8"));
    for (const entry of hm.mentions || []) {
      handbookMentions[entry.slug] = entry;
    }
    console.log(`  Loaded ${Object.keys(handbookMentions).length} handbook mentions`);
  } catch { console.log("  No handbook-mentions.json found"); }
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
          readmeHtml = sanitizeReadmeHtml(marked.parse(readmeFixed));
        } catch (e) {
          console.warn(`  Markdown parse error for ${key}: ${e.message}`);
        }
      }
    } else {
      // Offline: reuse the README HTML already baked into the committed page.
      // The online renderer has already demoted its headings exactly once; doing
      // that again on every local build progressively collapses h2→h3→...→h6.
      // Prefer HEAD so an in-progress generated-page diff cannot become the next
      // build's input. Fall back to disk for a brand-new, not-yet-committed page.
      const existingPath = path.join(projectsDir, repo.owner, `${repo.repo}.html`);
      if (fs.existsSync(existingPath)) {
        try {
          const rel = path.relative(ROOT, existingPath).split(path.sep).join("/");
          let existing;
          try {
            existing = execFileSync("git", ["show", `HEAD:${rel}`], {
              cwd: ROOT,
              encoding: "utf-8",
              stdio: ["ignore", "pipe", "ignore"],
            });
          } catch {
            existing = fs.readFileSync(existingPath, "utf-8");
          }
          const match = existing.match(/<section class="readme"[^>]*>([\s\S]*?)<\/section>/);
          if (match && !match[1].includes("no-readme")) {
            readmeHtml = sanitizeReadmeHtml(match[1].trim());
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
      summaries[key] || null,
      handbookMentions[key] || null
    );

    // Write file
    const ownerDir = path.join(projectsDir, repo.owner);
    fs.mkdirSync(ownerDir, { recursive: true });
    writePage(path.join(ownerDir, `${repo.repo}.html`), html);

    generated++;
    process.stdout.write(`  ${generated}/${repos.length} ${key}\r`);

    // Small delay to be polite to GitHub API (only if fetching)
    if (GITHUB_HEADERS) await new Promise((r) => setTimeout(r, 100));
  }

  console.log(`\n  Generated ${generated} project pages (${errors} errors)\n`);

  // ── Orphan cleanup ──
  // Delete any project HTML whose owner/repo no longer appears in repos.json.
  // Without this, removing a repo (e.g. account deleted, project archived,
  // intentional curation drop) leaves a stale HTML on the live site rendering
  // pre-removal data — see PR #148 / Web3CZ/Web3Hermes incident.
  const canonical = new Set(repos.map((r) => `${r.owner}/${r.repo}.html`));
  let orphansRemoved = 0;
  const ownerDirents = fs.readdirSync(projectsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory());
  for (const od of ownerDirents) {
    const ownerPath = path.join(projectsDir, od.name);
    for (const file of fs.readdirSync(ownerPath)) {
      if (!file.endsWith(".html")) continue;
      const key = `${od.name}/${file}`;
      if (!canonical.has(key)) {
        fs.unlinkSync(path.join(ownerPath, file));
        orphansRemoved++;
        console.log(`  Removed orphan: projects/${key}`);
      }
    }
    if (fs.readdirSync(ownerPath).length === 0) {
      fs.rmdirSync(ownerPath);
      console.log(`  Removed empty owner dir: projects/${od.name}`);
    }
  }
  if (orphansRemoved > 0) {
    console.log(`  Cleaned up ${orphansRemoved} orphan project page(s)\n`);
  }

  // Sync homepage repo-rows from repos.json (auto-discovered repos only update
  // data/repos.json; index.html drifts unless this catches missing entries)
  syncHomepageRepos(repos);

  // Re-stamp version/star/date facts in hand-authored guide pages + drafts.
  // Must run before writeLlmsFiles (which bundles the drafts and guide HTML)
  // and before generateSitemap (so refreshed pages get today's lastmod).
  refreshHandAuthoredPages(repos);

  // Apply the canonical navigation + compact icon theme control to every
  // hand-authored surface after its content freshness pass.
  refreshSiteChrome();

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
    writePage(path.join(listsDir, `${list.slug}.html`), html);
    console.log(`  ${list.slug} (${matchedRepos.length} repos)`);
  }

  // Generate the lists index page (/lists/)
  writePage(path.join(listsDir, "index.html"), renderListsIndex(lists, repos));
  console.log(`  index (${lists.length} lists)`);

  // Generate reports index page
  if (reports.length > 0) {
    console.log("\nGenerating reports index...");
    const reportsDir = path.join(ROOT, "reports");
    fs.mkdirSync(reportsDir, { recursive: true });
    writePage(path.join(reportsDir, "index.html"), renderReportsIndex(reports));
    console.log(`  reports/index.html (${reports.length} reports)`);
  }

  // Generate sitemap
  console.log("\nGenerating sitemap.xml...");
  const sitemap = generateSitemap(repos, lists, reports);
  fs.writeFileSync(path.join(ROOT, "sitemap.xml"), sitemap, "utf-8");
  console.log(`  ${(sitemap.match(/<url>/g) || []).length} URLs (${changedPages.size} pages changed this build)`);

  // Generate robots.txt (explicit multi-bot allowlist + wildcard default)
  fs.writeFileSync(path.join(ROOT, "robots.txt"), buildRobotsTxt(), "utf-8");

  // Generate llms.txt + llms-full.txt for LLM / agent ingestion (llmstxt.org)
  console.log("\nGenerating llms.txt + llms-full.txt...");
  writeLlmsFiles(repos, lists, summaries, reports);

  // Generate rss.xml — last-30 new repo additions (addedAt derived from git log)
  console.log("\nGenerating rss.xml...");
  const addedDates = computeAddedDates();
  const rss = generateRssFeed(repos, addedDates, summaries);
  fs.writeFileSync(path.join(ROOT, "rss.xml"), rss, "utf-8");
  const rssItemCount = (rss.match(/<item>/g) || []).length;
  console.log(`  rss.xml (${rssItemCount} items, ${Buffer.byteLength(rss, "utf-8")} bytes)`);

  console.log("\nDone!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
