import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { JSDOM } from "jsdom";

// The homepage is a decision router since the redesign: hero + three journey
// doors (New to Hermes / Power user / Explore), with the catalog moved to the
// generated /ecosystem/ page. These tests pin the router contract: doors
// render, every door destination exists on disk, the catalog is really gone
// from the homepage, and the old "community map" framing does not creep back.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const appJs = fs.readFileSync(
  path.join(ROOT, "assets", "js", "homepage.js"),
  "utf8",
);

function loadHomepage({ runScripts = true } = {}) {
  const window = new JSDOM(html, {
    url: "https://hermesatlas.com/",
    runScripts: "dangerously",
    beforeParse(window) {
      window.fetch = () => Promise.reject(new Error("network disabled in test"));
    },
  }).window;
  if (runScripts) {
    window.eval(appJs);
  }
  return window;
}

test("three journey doors render with links", () => {
  const { document } = loadHomepage({ runScripts: false });
  const doors = document.querySelectorAll(".doors .door");
  assert.equal(doors.length, 3, "exactly three doors");
  for (const door of doors) {
    assert.ok(door.querySelector(".door-title"), "door has a title");
    const links = door.querySelectorAll(".door-links a[href]");
    assert.ok(links.length >= 3, "door has at least three links");
  }
});

test("every internal homepage link resolves to a file on disk", () => {
  const { document } = loadHomepage({ runScripts: false });
  const hrefs = new Set();
  for (const a of document.querySelectorAll("a[href]")) {
    const href = a.getAttribute("href") || "";
    if (href.startsWith("/") && !href.startsWith("//")) {
      hrefs.add(href.split("#")[0].split("?")[0]);
    }
  }
  for (const href of hrefs) {
    if (!href || href === "/") continue;
    const rel = href.replace(/^\//, "").replace(/\/$/, "");
    const candidates = [
      path.join(ROOT, rel, "index.html"),
      path.join(ROOT, `${rel}.html`),
      path.join(ROOT, rel),
    ];
    assert.ok(
      candidates.some((p) => fs.existsSync(p)),
      `homepage links ${href} but no file exists for it`,
    );
  }
});

test("the catalog is gone from the homepage (rows, sections, controls)", () => {
  const { document } = loadHomepage({ runScripts: false });
  assert.equal(document.querySelectorAll(".repo-row").length, 0, "no repo rows");
  assert.equal(document.querySelectorAll("section.cat").length, 0, "no category sections");
  assert.equal(document.getElementById("catalog-controls"), null, "no catalog controls");
  assert.equal(document.getElementById("tooltip"), null, "no repo tooltip");
});

test("the 'community map' framing is fully retired", () => {
  assert.ok(!/community map/i.test(html), "index.html still says 'community map'");
});

test("nav marks home active and links the ecosystem catalog", () => {
  const { document } = loadHomepage({ runScripts: false });
  const active = document.querySelector(".mast-nav a.active");
  assert.ok(active, "an active nav item exists");
  assert.equal(active.getAttribute("href"), "/");
  assert.equal(active.textContent, "home");
  assert.ok(
    document.querySelector('.mast-nav a[href="/ecosystem/"]'),
    "nav links /ecosystem/",
  );
});

test("featured-week rotation markers survive the redesign", () => {
  assert.ok(html.includes("<!-- BEGIN featured-week"), "BEGIN marker present");
  assert.ok(html.includes("<!-- END featured-week -->"), "END marker present");
});

test("homepage.js runs against the new page without throwing", () => {
  const window = loadHomepage();
  // Chat widget still initializes (it stayed on the homepage).
  assert.ok(window.document.querySelector("#chat-messages .chat-msg"), "chat welcome message rendered");
});
