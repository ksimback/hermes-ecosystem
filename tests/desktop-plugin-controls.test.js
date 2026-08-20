import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(ROOT, "lists", "desktop-plugins.html"), "utf8");
const appJs = fs.readFileSync(path.join(ROOT, "assets", "js", "desktop-plugins.js"), "utf8");
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "desktop-plugins.json"), "utf8"));
const repos = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "repos.json"), "utf8"));

function loadPage() {
  const window = new JSDOM(html, {
    url: "https://hermesatlas.com/lists/desktop-plugins",
    runScripts: "dangerously",
  }).window;
  window.eval(appJs);
  return window;
}

function rows(document) {
  return [...document.querySelectorAll(".list-table .list-row")];
}

function visible(document) {
  return rows(document).filter((row) => !row.hidden);
}

test("desktop plugin search filters the generated evidence rows", () => {
  const window = loadPage();
  const { document } = window;
  assert.equal(rows(document).length, catalog.plugins.length);
  assert.equal(visible(document).length, catalog.plugins.length);
  assert.equal(document.querySelector("#desktop-count").textContent, `${catalog.plugins.length} of ${catalog.plugins.length} repositories`);

  const search = document.querySelector("#desktop-search");
  search.value = "token meter";
  search.dispatchEvent(new window.Event("input", { bubbles: true }));

  const matches = visible(document);
  assert.ok(matches.length > 0);
  assert.ok(matches.length < catalog.plugins.length);
  const normalize = (value) => value.toLowerCase().replace(/[-_/]+/g, " ").replace(/\s+/g, " ").trim();
  assert.ok(matches.every((row) => normalize(row.dataset.search).includes("token meter")));
  assert.equal(document.querySelector("#desktop-count").textContent, `${matches.length} of ${catalog.plugins.length} repositories`);
});

test("desktop plugin distribution filter matches catalog metadata", () => {
  const window = loadPage();
  const { document } = window;
  const type = document.querySelector("#desktop-type");
  type.value = "collection";
  type.dispatchEvent(new window.Event("change", { bubbles: true }));

  const matches = visible(document);
  const expected = catalog.plugins.filter((plugin) => plugin.distributionType === "collection").length;
  assert.equal(matches.length, expected);
  assert.ok(matches.every((row) => row.dataset.type === "collection"));
});

test("desktop plugin Atlas-status filter reflects canonical catalog overlap", () => {
  const window = loadPage();
  const { document } = window;
  const canonical = new Set(repos.map((repo) => `${repo.owner}/${repo.repo}`.toLowerCase()));
  const expected = catalog.plugins.filter((plugin) => canonical.has(plugin.repository.toLowerCase())).length;

  const status = document.querySelector("#desktop-status");
  status.value = "Atlas project";
  status.dispatchEvent(new window.Event("change", { bubbles: true }));

  const matches = visible(document);
  assert.equal(matches.length, expected);
  assert.ok(matches.every((row) => row.dataset.status === "Atlas project"));
});
