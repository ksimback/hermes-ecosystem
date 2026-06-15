#!/usr/bin/env node
/**
 * smoke-test-prod.js
 *
 * Post-deploy smoke test for the Hermes Atlas production site (or any preview
 * deploy). Confirms the deploy is functionally healthy before we walk away from
 * it. Designed to be cheap, fast (< 60s typical), and reusable on every push.
 *
 * What it checks (in order, stops on first hard failure unless --continue):
 *
 *   1. Critical pages return 2xx (homepage + guide + lists + reports + privacy
 *      + sitemap.xml + rss.xml).
 *   2. Homepage category counts match the live `data/repos.json` grouping
 *      (catches the "I bumped repos.json but forgot to bump <span class=
 *      'cat-count-n'>" drift that hit PR #231).
 *   3. Statistical sample of project pages return 2xx. Covers the worst
 *      failure mode: build-pages.js skipped an entry and the project page
 *      404s on prod. Defaults to 25 random + 100% of entries added in the
 *      last 14 days (whichever is larger).
 *   4. Sitemap.xml lists every /projects/<owner>/<repo> URL in repos.json.
 *      Catches build-pages.js / generate-sitemap drift.
 *   5. RSS feed parses as valid XML.
 *   6. Sample of internal links on the homepage resolve (no 404 anchors
 *      pointing at renamed/deleted projects).
 *
 * Each check prints a single-line PASS/FAIL with a count. Failures get
 * appended to a report block at the end so the run-log stays scannable.
 *
 * Exit codes:
 *   0  - all checks passed
 *   1  - at least one check failed (CI gate)
 *   2  - script aborted (missing env, can't read repos.json, etc.)
 *
 * Usage:
 *   node scripts/smoke-test-prod.js
 *   node scripts/smoke-test-prod.js --base https://hermes-ecosystem-git-xxx.vercel.app
 *   node scripts/smoke-test-prod.js --sample 50
 *   node scripts/smoke-test-prod.js --continue   # don't stop on first failure
 *   node scripts/smoke-test-prod.js --verbose
 *
 * Acknowledging known-broken checks (downgrade FAIL → WARN, exit stays 0):
 *   SMOKE_ALLOW_FAILURES='/lists/,Core & Official count' node scripts/smoke-test-prod.js
 *   node scripts/smoke-test-prod.js --allow '/lists/,Core & Official count'
 *
 * Windows/Git-Bash note: MSYS path conversion will mangle tokens that start
 * with a slash (e.g. `/lists/` becomes `C:/Program Files/Git/lists/`). Prefix
 * the invocation with `MSYS_NO_PATHCONV=1` or run from cmd.exe / PowerShell.
 * Linux runners (GitHub Actions) are unaffected.
 *
 * No external runtime deps required beyond what's already in package.json
 * (uses node-html-parser for HTML; built-in fetch + DOMParser-less XML check).
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseHtml } from "node-html-parser";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ---------- CLI args ----------

const args = process.argv.slice(2);
function flag(name) {
  return args.includes(`--${name}`);
}
function opt(name, def) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}

const BASE = (opt("base", "https://hermesatlas.com")).replace(/\/$/, "");
const SAMPLE_SIZE = parseInt(opt("sample", "25"), 10);
const RECENT_DAYS = parseInt(opt("recent-days", "14"), 10);
const CONCURRENCY = parseInt(opt("concurrency", "10"), 10);
const TIMEOUT_MS = parseInt(opt("timeout", "15000"), 10);
const CONTINUE_ON_FAIL = flag("continue");
const VERBOSE = flag("verbose");
const USER_AGENT = "HermesAtlas-SmokeTest/1.0";

// Acknowledged failures: substring-matched against the `check` name. Anything
// matched becomes a WARN instead of a FAIL (still printed, doesn't affect exit
// code). Use to acknowledge known-broken-but-deferred issues so the test stays
// green on green while we fix them. Source via env or --allow.
const ALLOW_LIST = (
  process.env.SMOKE_ALLOW_FAILURES ||
  opt("allow", "")
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// ---------- Helpers ----------

const supportsColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = {
  green: (s) => (supportsColor ? `\x1b[32m${s}\x1b[0m` : s),
  red: (s) => (supportsColor ? `\x1b[31m${s}\x1b[0m` : s),
  yellow: (s) => (supportsColor ? `\x1b[33m${s}\x1b[0m` : s),
  dim: (s) => (supportsColor ? `\x1b[2m${s}\x1b[0m` : s),
  bold: (s) => (supportsColor ? `\x1b[1m${s}\x1b[0m` : s),
};

const failures = [];
const warnings = [];
const results = []; // { check, status, message, detail }

function isAllowed(check) {
  return ALLOW_LIST.some((token) => check.includes(token));
}

function pass(check, message) {
  results.push({ check, status: "pass", message });
  console.log(`  ${c.green("PASS")}  ${check} ${c.dim(`- ${message}`)}`);
}
function fail(check, message, detail) {
  if (isAllowed(check)) {
    results.push({ check, status: "warn", message, detail });
    warnings.push({ check, message, detail });
    console.log(`  ${c.yellow("WARN")}  ${check} ${c.dim(`- ${message} [acknowledged]`)}`);
    if (VERBOSE && detail) console.log(c.dim(`        ${detail}`));
    return;
  }
  results.push({ check, status: "fail", message, detail });
  failures.push({ check, message, detail });
  console.log(`  ${c.red("FAIL")}  ${check} ${c.dim(`- ${message}`)}`);
  if (VERBOSE && detail) console.log(c.dim(`        ${detail}`));
}
function info(msg) {
  if (VERBOSE) console.log(c.dim(`  ${msg}`));
}

async function fetchWithTimeout(url, opts = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...opts,
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": USER_AGENT, ...(opts.headers || {}) },
    });
    return res;
  } finally {
    clearTimeout(t);
  }
}

async function head(url) {
  // Many CDNs return 405 to HEAD; fall back to GET if needed.
  try {
    const r = await fetchWithTimeout(url, { method: "HEAD" });
    if (r.status === 405) {
      return await fetchWithTimeout(url, { method: "GET" });
    }
    return r;
  } catch (e) {
    return { ok: false, status: 0, statusText: e.message };
  }
}

// Run N async tasks with bounded concurrency
async function pool(items, n, fn) {
  const out = [];
  let i = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

function sample(arr, n) {
  if (arr.length <= n) return [...arr];
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

// ---------- Load reference data ----------

const repos = JSON.parse(
  await fs.readFile(path.join(ROOT, "data/repos.json"), "utf8")
);

// ---------- Section runners ----------

console.log(c.bold(`\nHermes Atlas smoke test`));
console.log(c.dim(`  base: ${BASE}`));
console.log(c.dim(`  repos.json entries: ${repos.length}`));
console.log(c.dim(`  sample size: ${SAMPLE_SIZE} (plus all entries newer than ${RECENT_DAYS}d in repos.json if dated)`));
console.log("");

let aborted = false;

async function section(title, fn) {
  if (aborted) return;
  console.log(c.bold(title));
  const before = failures.length;
  const t0 = Date.now();
  await fn();
  const dt = Date.now() - t0;
  console.log(c.dim(`  (${dt}ms)\n`));
  if (failures.length > before && !CONTINUE_ON_FAIL) {
    aborted = true;
    console.log(c.yellow(`  aborting remaining checks - rerun with --continue to see everything`));
  }
}

// 1. Critical pages
await section("1. Critical pages return 2xx", async () => {
  const paths = [
    "/",
    "/guide/",
    "/lists/",
    "/reports/",
    "/privacy/",
    "/sitemap.xml",
    "/rss.xml",
    "/robots.txt",
  ];
  const results = await pool(paths, CONCURRENCY, async (p) => {
    const url = `${BASE}${p}`;
    const r = await head(url);
    return { path: p, status: r.status, ok: r.ok };
  });
  for (const r of results) {
    if (r.ok) {
      pass(r.path, `HTTP ${r.status}`);
    } else {
      fail(r.path, `HTTP ${r.status}`, `${BASE}${r.path}`);
    }
  }
});

// 2. Homepage category counts match repos.json
await section("2. Homepage category counts match data/repos.json", async () => {
  const r = await fetchWithTimeout(`${BASE}/`);
  if (!r.ok) {
    fail("homepage fetch", `HTTP ${r.status}`, `${BASE}/`);
    return;
  }
  const html = await r.text();
  const root = parseHtml(html);

  // Group repos.json by category for the reference count.
  const byCat = new Map();
  for (const repo of repos) {
    const cat = repo.category || "(uncategorized)";
    byCat.set(cat, (byCat.get(cat) || 0) + 1);
  }

  const sections = root.querySelectorAll('section.cat[data-category]');
  if (sections.length === 0) {
    fail("homepage sections", "no <section.cat[data-category]> found on homepage", "is the homepage structure unchanged?");
    return;
  }

  const seenCats = new Set();
  for (const sec of sections) {
    const cat = sec.getAttribute("data-category");
    seenCats.add(cat);
    const span = sec.querySelector(".cat-count-n");
    const rendered = span ? parseInt(span.text, 10) : NaN;
    const expected = byCat.get(cat) || 0;
    if (rendered === expected) {
      pass(`${cat} count`, `${rendered}`);
    } else {
      fail(
        `${cat} count`,
        `homepage shows ${rendered}, repos.json has ${expected}`,
        `bump <span class="cat-count-n">${expected}</span> in index.html`
      );
    }
  }

  // Cats in JSON but not on the homepage:
  for (const cat of byCat.keys()) {
    if (!seenCats.has(cat)) {
      fail(
        `${cat} section`,
        `category exists in repos.json (${byCat.get(cat)} entries) but no <section> for it on homepage`,
        `add a <section class="cat" data-category="${cat}"> to index.html`
      );
    }
  }
});

// 3. Project-page coverage
await section("3. Project pages return 2xx (sample + recent)", async () => {
  // Use ingested_at / created_at if present; else fall back to pure random sample.
  const dated = repos.filter((r) => r.added_at || r.first_seen);
  const recentCutoff = Date.now() - RECENT_DAYS * 24 * 3600 * 1000;
  const recent = dated.filter((r) => {
    const d = Date.parse(r.added_at || r.first_seen);
    return Number.isFinite(d) && d >= recentCutoff;
  });

  const randomSlice = sample(
    repos.filter((r) => !recent.includes(r)),
    Math.max(0, SAMPLE_SIZE - recent.length)
  );
  const checkSet = [...recent, ...randomSlice];
  info(`testing ${checkSet.length} project pages (${recent.length} recent + ${randomSlice.length} random)`);

  const checked = await pool(checkSet, CONCURRENCY, async (repo) => {
    const url = `${BASE}/projects/${repo.owner}/${repo.repo}`;
    const r = await head(url);
    return { repo: `${repo.owner}/${repo.repo}`, status: r.status, ok: r.ok };
  });

  const dead = checked.filter((c) => !c.ok);
  if (dead.length === 0) {
    pass(`project pages`, `${checked.length}/${checked.length} returned 2xx`);
  } else {
    for (const d of dead) {
      fail(`/projects/${d.repo}`, `HTTP ${d.status}`, `${BASE}/projects/${d.repo}`);
    }
    pass(
      `project pages (rollup)`,
      `${checked.length - dead.length}/${checked.length} returned 2xx`
    );
  }
});

// 4. Sitemap covers every project
await section("4. Sitemap covers every /projects/<owner>/<repo> in repos.json", async () => {
  const r = await fetchWithTimeout(`${BASE}/sitemap.xml`);
  if (!r.ok) {
    fail("sitemap fetch", `HTTP ${r.status}`, `${BASE}/sitemap.xml`);
    return;
  }
  const xml = await r.text();

  // Cheap XML extraction - we don't need a full parser for <loc> elements.
  const locs = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1]);
  const projectLocs = new Set(
    locs
      .map((u) => {
        try {
          return new URL(u).pathname.replace(/\/$/, "");
        } catch {
          return null;
        }
      })
      .filter((p) => p && p.startsWith("/projects/"))
  );

  const expected = repos.map((r) => `/projects/${r.owner}/${r.repo}`);
  const missing = expected.filter((p) => !projectLocs.has(p));

  if (missing.length === 0) {
    pass("sitemap coverage", `${expected.length}/${expected.length} project URLs present`);
  } else {
    for (const m of missing.slice(0, 5)) {
      fail("sitemap missing", m);
    }
    if (missing.length > 5) {
      fail("sitemap missing (rollup)", `${missing.length} project URLs missing from sitemap (showing first 5)`);
    }
  }
});

// 5. RSS feed parses
await section("5. RSS feed is well-formed", async () => {
  const r = await fetchWithTimeout(`${BASE}/rss.xml`);
  if (!r.ok) {
    fail("rss fetch", `HTTP ${r.status}`, `${BASE}/rss.xml`);
    return;
  }
  const xml = await r.text();
  // Minimal well-formedness check - count opening/closing item tags, ensure <rss> wrapper.
  if (!/<rss\b/.test(xml) || !/<\/rss>/.test(xml)) {
    fail("rss wrapper", "missing <rss>...</rss> wrapper", `${BASE}/rss.xml`);
    return;
  }
  const opens = (xml.match(/<item\b/g) || []).length;
  const closes = (xml.match(/<\/item>/g) || []).length;
  if (opens !== closes) {
    fail("rss items", `mismatched <item> tags (${opens} open vs ${closes} close)`, `${BASE}/rss.xml`);
    return;
  }
  pass("rss.xml", `well-formed, ${opens} items`);
});

// 6. Internal link integrity (homepage anchors)
await section("6. Sample of internal links from homepage resolve", async () => {
  const r = await fetchWithTimeout(`${BASE}/`);
  if (!r.ok) {
    fail("homepage fetch (links check)", `HTTP ${r.status}`);
    return;
  }
  const html = await r.text();
  const root = parseHtml(html);
  const anchors = root.querySelectorAll("a[href]");
  const internal = new Set();
  for (const a of anchors) {
    const href = a.getAttribute("href") || "";
    if (href.startsWith("/") && !href.startsWith("//")) internal.add(href.split("#")[0].split("?")[0]);
  }
  const list = Array.from(internal).filter(Boolean);
  const checked = sample(list, Math.min(SAMPLE_SIZE, list.length));
  info(`sampling ${checked.length}/${list.length} internal links`);

  const results = await pool(checked, CONCURRENCY, async (p) => {
    const url = `${BASE}${p}`;
    const r = await head(url);
    return { path: p, status: r.status, ok: r.ok };
  });
  const broken = results.filter((r) => !r.ok);
  if (broken.length === 0) {
    pass("internal links", `${checked.length}/${checked.length} resolved`);
  } else {
    for (const b of broken.slice(0, 5)) {
      fail(`link ${b.path}`, `HTTP ${b.status}`, `${BASE}${b.path}`);
    }
    if (broken.length > 5) {
      fail("link rollup", `${broken.length} broken links (showing first 5)`);
    }
  }
});

// ---------- Final report ----------

console.log(c.bold("\nSummary"));
const passed = results.filter((r) => r.status === "pass").length;
const warned = results.filter((r) => r.status === "warn").length;
const failed = results.filter((r) => r.status === "fail").length;
const parts = [c.green(`${passed} passed`)];
if (warned > 0) parts.push(c.yellow(`${warned} warned (acknowledged)`));
parts.push(failed > 0 ? c.red(`${failed} failed`) : c.dim("0 failed"));
console.log(`  ${parts.join(", ")}`);

if (warnings.length > 0) {
  console.log(c.bold("\nAcknowledged failures (not blocking)"));
  for (const w of warnings) {
    console.log(`  ${c.yellow("!")} ${w.check}: ${w.message}`);
    if (w.detail) console.log(c.dim(`     ${w.detail}`));
  }
}

if (failures.length > 0) {
  console.log(c.bold("\nFailures"));
  for (const f of failures.slice(0, 20)) {
    console.log(`  ${c.red("X")} ${f.check}: ${f.message}`);
    if (f.detail) console.log(c.dim(`     ${f.detail}`));
  }
  if (failures.length > 20) {
    console.log(c.dim(`  ... and ${failures.length - 20} more`));
  }
  process.exit(1);
}

console.log(c.green("\n  all checks passed\n"));
process.exit(0);
