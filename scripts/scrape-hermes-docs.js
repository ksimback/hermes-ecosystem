#!/usr/bin/env node
/**
 * scrape-hermes-docs.js
 *
 * Mirrors every page under https://hermes-agent.nousresearch.com/docs into
 * research/docs/, preserving the URL hierarchy as a directory tree.
 *
 * Idempotent: rewrites a file only when the upstream content body changes.
 * Skips /docs/zh-Hans/* (Chinese mirror).
 *
 * Usage: node scripts/scrape-hermes-docs.js
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "node-html-parser";
import TurndownService from "turndown";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "research", "docs");

const BASE = "https://hermes-agent.nousresearch.com";
const START_PATHS = ["/docs"];
const SKIP_PREFIXES = [
  "/docs/zh-Hans", // Chinese mirror — same content, redundant for KB
  "/docs/ko",      // Korean mirror — same reason; left unfiltered until 2026-05-25 when it pushed chunks.json past GitHub's 100MB limit
  "/docs/assets/", // Docusaurus static assets (images, generated llms.txt, etc.)
];
const USER_AGENT = "HermesAtlasBot/1.0 (+https://hermesatlas.com)";

const STRIP_SELECTORS = [
  "nav",
  "footer",
  ".theme-doc-breadcrumbs",
  ".theme-edit-this-page",
  ".theme-edit-meta",
  ".theme-doc-toc-mobile",
  ".theme-doc-toc-desktop",
  ".theme-doc-footer",
  ".theme-doc-footer-edit-meta-row",
  ".theme-doc-footer-tags-row",
  ".theme-last-updated",
  ".theme-doc-version-badge",
  ".pagination-nav",
  "[class*='tableOfContents']",
  "[class*='breadcrumb']",
  "a.hash-link",
  "[class*='hash-link']",
];

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
  emDelimiter: "_",
});

// Docusaurus wraps each code line in <span class="token-line"> with no newline
// between them; .textContent collapses to a single line. Walk those wrappers
// and join with \n so the rendered code block keeps its original lines.
function extractCodeText(codeEl) {
  const lineWrappers = codeEl.querySelectorAll(".token-line");
  if (lineWrappers.length > 1) {
    return lineWrappers.map((l) => l.textContent || "").join("\n");
  }
  // Fallback: split on <br> if present
  const html = codeEl.innerHTML || "";
  if (/<br\s*\/?>/i.test(html)) {
    const parts = html.split(/<br\s*\/?>/i).map((p) => parse(p).textContent);
    return parts.join("\n");
  }
  return codeEl.textContent || "";
}

turndown.addRule("fencedCodeBlock", {
  filter: (node) =>
    node.nodeName === "PRE" &&
    node.firstChild &&
    node.firstChild.nodeName === "CODE",
  replacement: (_content, node) => {
    const code = node.firstChild;
    const cls = (code.getAttribute && code.getAttribute("class")) || "";
    const langMatch = cls.match(/language-(\S+)/);
    const lang = langMatch ? langMatch[1] : "";
    const text = extractCodeText(code).replace(/\n+$/, "");
    return `\n\n\`\`\`${lang}\n${text}\n\`\`\`\n\n`;
  },
});

// Upstream returns sporadic 503s that outlast a few seconds; one unrecovered
// page fails the whole mirror run. Exponential backoff (2s..16s, ~30s worst
// case per page) rides those out, and a Retry-After header wins when sent.
const MAX_ATTEMPTS = 5;

async function fetchHtml(urlPath) {
  const url = BASE + urlPath;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let retryAfterMs = 0;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
        redirect: "follow",
      });
      if (res.status === 404) return null;
      if (!res.ok) {
        retryAfterMs = Math.min(Number(res.headers.get("retry-after")) * 1000 || 0, 60000);
        throw new Error(`HTTP ${res.status}`);
      }
      return await res.text();
    } catch (e) {
      if (attempt === MAX_ATTEMPTS) throw new Error(`fetch ${url}: ${e.message}`);
      const delay = retryAfterMs || 1000 * 2 ** attempt;
      console.warn(`  retry ${attempt}/${MAX_ATTEMPTS - 1} ${urlPath} after ${e.message} (${delay}ms)`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

function shouldSkip(p) {
  if (!p.startsWith("/docs")) return true;
  for (const s of SKIP_PREFIXES) if (p.startsWith(s)) return true;
  return false;
}

function normalizePath(href) {
  if (!href) return null;
  const clean = href.split("#")[0].split("?")[0];
  if (!clean) return null;
  if (clean.startsWith("http")) {
    if (!clean.startsWith(BASE)) return null;
    return clean.slice(BASE.length) || "/";
  }
  if (!clean.startsWith("/")) return null;
  return clean;
}

function pathToFile(p) {
  let rel = p.replace(/^\/docs\/?/, "");
  if (!rel || rel.endsWith("/")) rel = (rel || "") + "index";
  if (!rel.endsWith(".md")) rel += ".md";
  return path.join(OUT_DIR, rel);
}

function discoverLinks(html) {
  const root = parse(html);
  const found = new Set();
  for (const a of root.querySelectorAll("a[href]")) {
    const p = normalizePath(a.getAttribute("href"));
    if (p && !shouldSkip(p)) found.add(p);
  }
  return found;
}

function extractContent(html, urlPath) {
  const root = parse(html);
  const main =
    root.querySelector("article") ||
    root.querySelector("main") ||
    root.querySelector("#__docusaurus_skipToContent_fallback") ||
    root;

  for (const sel of STRIP_SELECTORS) {
    for (const el of main.querySelectorAll(sel)) el.remove();
  }

  const h1 = main.querySelector("h1");
  const title = h1 ? h1.text.trim() : urlPath;
  // Drop the article's own H1 — we add one synthetically with the source URL,
  // and keeping both produces a duplicate heading.
  if (h1) h1.remove();
  const body = turndown.turndown(main.innerHTML).trim();
  return { title, body };
}

function readExistingBody(file) {
  if (!fs.existsSync(file)) return null;
  const txt = fs.readFileSync(file, "utf-8");
  const m = txt.match(/^# [^\n]+\n\n\*\*Source:\*\* [^\n]+\n\n([\s\S]*?)\n*$/);
  return m ? m[1].trim() : null;
}

function writePage(file, title, sourceUrl, body) {
  const existing = readExistingBody(file);
  if (existing === body) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    `# ${title}\n\n**Source:** ${sourceUrl}\n\n${body}\n`,
  );
  return true;
}

async function main() {
  console.log(`Scraping ${BASE}/docs ...`);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const seen = new Set();
  const queue = [...START_PATHS];
  const pages = new Map();

  while (queue.length) {
    const p = queue.shift();
    if (seen.has(p) || shouldSkip(p)) continue;
    seen.add(p);

    const html = await fetchHtml(p);
    if (!html) {
      console.log(`  skip ${p} (404)`);
      continue;
    }
    pages.set(p, html);

    for (const link of discoverLinks(html)) {
      if (!seen.has(link)) queue.push(link);
    }
  }

  console.log(`Discovered ${pages.size} doc pages`);

  let written = 0;
  let unchanged = 0;
  let skipped = 0;
  for (const [p, html] of pages) {
    try {
      const { title, body } = extractContent(html, p);
      if (!body || body.length < 50) {
        skipped++;
        continue;
      }
      const file = pathToFile(p);
      const changed = writePage(file, title, BASE + p, body);
      if (changed) {
        written++;
        console.log(`  wrote  ${path.relative(ROOT, file).replace(/\\/g, "/")}`);
      } else {
        unchanged++;
      }
    } catch (e) {
      console.error(`  ERROR  ${p}: ${e.message}`);
    }
  }

  console.log(
    `\nDone. ${written} updated, ${unchanged} unchanged, ${skipped} skipped.`,
  );
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
