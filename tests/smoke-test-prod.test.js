import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repos = JSON.parse(await readFile(path.join(ROOT, "data/repos.json"), "utf8"));
const today = new Date().toISOString().slice(0, 10);

function homepage() {
  const counts = new Map();
  for (const repo of repos) counts.set(repo.category, (counts.get(repo.category) || 0) + 1);
  return `<!doctype html><html><body>${[...counts.entries()]
    .map(([category, count]) => `<section class="cat" data-category="${category}"><span class="cat-count-n">${count}</span></section>`)
    .join("")}</body></html>`;
}

function sitemap(base) {
  return `<?xml version="1.0"?><urlset>${repos
    .map((repo) => `<url><loc>${base}/projects/${repo.owner}/${repo.repo}</loc><lastmod>${today}</lastmod></url>`)
    .join("")}</urlset>`;
}

function runSmoke(base) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      "scripts/smoke-test-prod.js", "--base", base, "--sample", "0", "--recent-days", "-1", "--concurrency", "1", "--timeout", "2000", "--continue",
    ], { cwd: ROOT });
    let output = "";
    child.stdout.on("data", (data) => { output += data; });
    child.stderr.on("data", (data) => { output += data; });
    child.once("error", reject);
    child.once("close", (code) => resolve({ code, output }));
  });
}

async function withAtlasFixture({ stars = {} } = {}) {
  const seenTwitterbot = [];
  const server = createServer((req, res) => {
    const base = `http://${req.headers.host}`;
    const url = new URL(req.url, base);
    const send = (status, type, body) => {
      res.writeHead(status, { "content-type": type });
      res.end(body);
    };

    if (url.pathname === "/") return send(200, "text/html", homepage());
    if (["/guide/", "/lists/", "/reports/", "/privacy/", "/robots.txt"].includes(url.pathname)) return send(200, "text/plain", "ok");
    if (url.pathname === "/sitemap.xml") return send(200, "application/xml", sitemap(base));
    if (url.pathname === "/rss.xml") return send(200, "application/xml", "<rss><channel><item>ok</item></channel></rss>");
    if (url.pathname === "/llms.txt") return send(200, "text/plain", `Hermes Atlas has ${repos.length}+ tools.`);
    if (url.pathname === "/api/chat") return send(200, "text/event-stream", "data: Hermes Agent is ready.\n\n");
    if (url.pathname === "/api/stars") {
      const response = {
        stale: false,
        complete: true,
        fetchedAt: new Date().toISOString(),
        unavailableRepos: [],
        totals: { count: repos.length },
        repos: Object.fromEntries(repos.map((repo) => [`${repo.owner}/${repo.repo}`, { stars: repo.stars }])),
        ...stars,
      };
      return send(200, "application/json", JSON.stringify(response));
    }
    if (url.pathname === "/api/stars-history") {
      return send(200, "application/json", JSON.stringify({
        stale: false,
        days: 1,
        latestSnapshotAt: new Date().toISOString(),
        history: [{ date: today, fetchedAt: new Date().toISOString(), data: {} }],
      }));
    }
    if (url.pathname === "/api/og") {
      seenTwitterbot.push(req.headers["user-agent"] || "");
      return send(200, "image/png", Buffer.from([137, 80, 78, 71]));
    }
    if (url.pathname.startsWith("/projects/")) return send(200, "text/html", "project");
    return send(404, "text/plain", "not found");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  try {
    return { ...(await runSmoke(`http://127.0.0.1:${port}`)), seenTwitterbot };
  } finally {
    server.close();
    await once(server, "close");
  }
}

test("production smoke accepts complete fresh API contracts", async () => {
  const { code, output, seenTwitterbot } = await withAtlasFixture();
  assert.equal(code, 0, output);
  assert.match(output, /Ask the Atlas/);
  assert.match(output, /stars freshness/);
  assert.match(output, /OG image \(Twitterbot\)/);
  assert.match(output, /llms\.txt freshness/);
  assert.match(output, /0 failed/);
  assert.ok(seenTwitterbot.some((userAgent) => userAgent.includes("Twitterbot")));
});

test("production smoke rejects a stale stars response even when HTTP is 200", async () => {
  const { code, output } = await withAtlasFixture({
    stars: { stale: true, complete: false, fetchedAt: "2020-01-01T00:00:00Z" },
  });
  assert.equal(code, 1, output);
  assert.match(output, /FAIL\s+stars freshness/);
});
