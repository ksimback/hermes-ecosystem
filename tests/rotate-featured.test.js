import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const MARKERS = "<!-- BEGIN featured-week -->\n<!-- END featured-week -->";
const ATLAS = { owner: "ksimback", repo: "hermes-ecosystem", stars: 1300, official: false, category: "Guides & Docs" };
const OTHER = { owner: "someone", repo: "hermes-thing", stars: 200, official: false, category: "Workspaces & GUIs" };

// rotate-featured.js resolves data/ and index.html relative to its own
// location, so each test runs a copy of it inside a throwaway repo layout.
function sandbox(repos, featured = []) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rotate-featured-"));
  fs.mkdirSync(path.join(dir, "scripts"));
  fs.mkdirSync(path.join(dir, "data"));
  fs.copyFileSync(path.join(ROOT, "scripts/rotate-featured.js"), path.join(dir, "scripts/rotate-featured.js"));
  fs.writeFileSync(path.join(dir, "data/repos.json"), JSON.stringify(repos));
  fs.writeFileSync(path.join(dir, "data/summaries.json"), "{}");
  fs.writeFileSync(path.join(dir, "data/featured.json"), JSON.stringify(featured));
  fs.writeFileSync(path.join(dir, "index.html"), MARKERS);
  return dir;
}

function run(dir, arg) {
  return spawnSync(process.execPath, [path.join(dir, "scripts/rotate-featured.js"), arg], { encoding: "utf8" });
}

function thisMonday() {
  const d = new Date();
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
}

test("--auto never picks the Hermes Atlas repo itself", () => {
  const dir = sandbox([ATLAS, OTHER]);
  const res = run(dir, "--auto");
  assert.equal(res.status, 0, res.stderr);
  const featured = JSON.parse(fs.readFileSync(path.join(dir, "data/featured.json"), "utf8"));
  assert.equal(featured[0].slug, "someone/hermes-thing");
});

test("an explicit pick of the Hermes Atlas repo is refused", () => {
  const dir = sandbox([ATLAS, OTHER]);
  const res = run(dir, "ksimback/hermes-ecosystem");
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /never-feature list/);
  assert.equal(fs.readFileSync(path.join(dir, "index.html"), "utf8"), MARKERS);
});

test("--auto keeps a pick already made for the current week", () => {
  const existing = [{ slug: "someone/manual-pick", weekStart: thisMonday(), addedAt: "x" }];
  const dir = sandbox([OTHER], existing);
  const res = run(dir, "--auto");
  assert.equal(res.status, 0, res.stderr);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, "data/featured.json"), "utf8")), existing);
  assert.equal(fs.readFileSync(path.join(dir, "index.html"), "utf8"), MARKERS);
});
