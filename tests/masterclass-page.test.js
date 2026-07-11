import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf-8");
const masterclass = read("masterclass/index.html");
const document = new JSDOM(masterclass).window.document;

const VIDEO_IDS = [
  "R3YOGfTBcQg",
  "dcXmUUZvDLE",
  "ZKZLko9kLm4",
  "L3WdVeMaYZM",
  "1oaaOWy7wSI",
  "U140gP-1bEI",
  "grMNnzCv2gY",
  "_6DtQkDpcEs",
  "KPsMThlFb8Y",
  "KtlY6ETPyKo",
];

test("masterclass presents all ten modules in order with privacy-enhanced embeds", () => {
  const episodes = [...document.querySelectorAll("article.episode")];
  assert.equal(episodes.length, 10);
  assert.deepEqual(episodes.map((el) => el.id), VIDEO_IDS.map((_, i) => `episode-${i + 1}`));

  const embeds = episodes.map((el) => el.querySelector("iframe")?.getAttribute("src"));
  assert.deepEqual(
    embeds,
    VIDEO_IDS.map((id) => `https://www.youtube-nocookie.com/embed/${id}?rel=0`),
  );
  for (const iframe of document.querySelectorAll("iframe")) {
    assert.ok(iframe.hasAttribute("title"), "every iframe has a title");
    assert.ok(iframe.hasAttribute("allowfullscreen"), "every iframe allows fullscreen");
  }
});

test("every episode has useful expandable notes and timestamp links", () => {
  const episodes = [...document.querySelectorAll("article.episode")];
  for (const [index, episode] of episodes.entries()) {
    const details = episode.querySelector("details.episode-notes");
    assert.ok(details, `episode ${index + 1} has expandable notes`);
    assert.ok(details.querySelector(".notes-tldr")?.textContent.trim().length > 80);
    assert.ok(details.querySelectorAll(".takeaways li").length >= 6);
    assert.ok(details.querySelectorAll("a.timecode").length >= 6);
  }
});

test("Tonbi attribution and source links are prominent", () => {
  assert.ok(masterclass.includes("https://www.youtube.com/@TonbisAIGarage"));
  assert.ok(masterclass.includes("PLmpUb_PWAkDx-VWjh00tVCji794xAa_IX"));
  assert.ok(masterclass.includes("https://x.com/tonbistudio"));
  assert.match(masterclass, /distilled each module from Tonbi's YouTube description and auto-generated English transcript/);
});

test("shared navigation exposes Masterclass and uses compact theme icons", () => {
  const repos = JSON.parse(read("data/repos.json"));
  const samples = [
    "index.html",
    "guide/index.html",
    "lists/index.html",
    "reports/index.html",
    `projects/${repos[0].owner}/${repos[0].repo}.html`,
    "masterclass/index.html",
  ];

  for (const rel of samples) {
    const html = read(rel);
    assert.ok(html.includes('href="/masterclass/"'), `${rel} links Masterclass`);
    const doc = new JSDOM(html).window.document;
    const toggle = doc.querySelector("#theme-toggle");
    assert.ok(toggle, `${rel} has a theme toggle`);
    assert.equal(toggle.querySelectorAll("svg").length, 2, `${rel} uses two theme icons`);
    assert.equal(toggle.textContent.trim(), "", `${rel} has no visible Light / Dark text`);
  }
});

test("CSP explicitly allows only the privacy-enhanced YouTube frame origin", () => {
  const vercel = JSON.parse(read("vercel.json"));
  const staticHeaders = vercel.headers.find((entry) => entry.source === "/((?!api/).*)");
  const csp = staticHeaders?.headers.find((header) => header.key === "Content-Security-Policy")?.value;
  assert.ok(csp?.includes("frame-src https://www.youtube-nocookie.com"));
  assert.ok(!csp?.includes("frame-src https://www.youtube.com"));
});
