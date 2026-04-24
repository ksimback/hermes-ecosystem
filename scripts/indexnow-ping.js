#!/usr/bin/env node
/**
 * indexnow-ping.js
 *
 * Pings IndexNow (https://www.indexnow.org) with the URLs that changed in
 * sitemap.xml since the previous commit. Bing, Yandex, and their downstream
 * consumers (including ChatGPT search via Bing) pick these up.
 *
 * Invoked from .github/workflows/build-pages.yml AFTER the commit+push so
 * the URLs we ping are actually live.
 *
 * Exits 0 on success or no-op. Fails on 4xx from the IndexNow endpoint.
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const HOST = "hermesatlas.com";
const KEY = "7d81d1334bd44930a24e355dd829f14b";
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const ENDPOINT = "https://api.indexnow.org/IndexNow";
const MAX_URLS_PER_PING = 10000; // IndexNow spec cap

function extractUrls(sitemapXml) {
  const urls = [];
  const re = /<loc>([^<]+)<\/loc>/g;
  let m;
  while ((m = re.exec(sitemapXml)) !== null) urls.push(m[1].trim());
  return urls;
}

function readCurrentSitemap() {
  const p = path.join(ROOT, "sitemap.xml");
  if (!fs.existsSync(p)) {
    console.error("sitemap.xml not found at", p);
    process.exit(1);
  }
  return fs.readFileSync(p, "utf-8");
}

function readPreviousSitemap() {
  try {
    return execSync("git show HEAD~1:sitemap.xml", { cwd: ROOT, encoding: "utf-8" });
  } catch {
    // No previous commit (first build) — treat everything as new.
    return null;
  }
}

async function ping(urls) {
  const body = JSON.stringify({
    host: HOST,
    key: KEY,
    keyLocation: KEY_LOCATION,
    urlList: urls.slice(0, MAX_URLS_PER_PING),
  });

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body,
  });

  const text = await res.text().catch(() => "");
  return { status: res.status, ok: res.ok, body: text };
}

async function main() {
  const current = readCurrentSitemap();
  const previous = readPreviousSitemap();

  const currentUrls = new Set(extractUrls(current));
  const previousUrls = previous ? new Set(extractUrls(previous)) : new Set();

  // URLs in current but not in previous = new or re-added
  const newUrls = [...currentUrls].filter((u) => !previousUrls.has(u));

  if (newUrls.length === 0) {
    console.log("IndexNow: no sitemap URL changes since last commit — nothing to ping.");
    return;
  }

  console.log(`IndexNow: pinging ${newUrls.length} URL(s)...`);
  for (const u of newUrls.slice(0, 10)) console.log(`  + ${u}`);
  if (newUrls.length > 10) console.log(`  ... and ${newUrls.length - 10} more`);

  const { status, ok, body } = await ping(newUrls);
  console.log(`IndexNow response: HTTP ${status}${body ? ` — ${body.slice(0, 200)}` : ""}`);

  // 200 = accepted; 202 = accepted but with warnings; 422 = validation errors on some URLs.
  // We tolerate 5xx (transient) but fail loudly on client errors.
  if (status >= 400 && status < 500 && status !== 422) {
    console.error(`IndexNow: client error (${status}) — failing the workflow.`);
    process.exit(1);
  }

  if (!ok && status !== 202 && status !== 422) {
    console.warn(`IndexNow: non-OK response (${status}) — continuing anyway.`);
  }
}

main().catch((err) => {
  console.error("IndexNow ping failed:", err);
  process.exit(1);
});
