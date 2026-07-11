import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// CSP stage A guardrail: the site is being moved off `'unsafe-inline'` in
// script-src/style-src. These tests fail if anyone reintroduces an inline
// executable <script>, a style="..." attribute, or an on*= event handler into
// a HAND-WRITTEN page, or into the build-pages.js templates.
//
// We deliberately do NOT scan generated output (projects/**, lists/**,
// reports/index.html): those are stale on disk until CI rebuilds them, so the
// source of truth for them is the build-pages.js template, which we assert on
// separately below.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function walk(dir, acc) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (entry.name.endsWith(".html")) acc.push(full);
  }
  return acc;
}

// Hand-written HTML surfaces only.
const HAND_WRITTEN = [
  path.join(root, "index.html"),
  path.join(root, "404.html"),
  path.join(root, "privacy", "index.html"),
  path.join(root, "reports", "state-of-hermes-april-2026.html"),
  path.join(root, "reports", "state-of-hermes-may-2026.html"),
  ...walk(path.join(root, "guide"), []),
  ...walk(path.join(root, "dev"), []).filter((file) =>
    !file.includes(`${path.sep}_repo${path.sep}`) &&
    !file.includes(`${path.sep}lessons${path.sep}`)
  ),
  ...walk(path.join(root, "masterclass"), []),
].sort();

const rel = (f) => path.relative(root, f).replace(/\\/g, "/");

// Match every <script ...> opening tag and expose its attribute string.
const SCRIPT_OPEN = /<script\b([^>]*)>/gi;

for (const file of HAND_WRITTEN) {
  const name = rel(file);
  const src = fs.readFileSync(file, "utf8");

  test(`${name}: no inline executable <script> (must have src, except JSON-LD)`, () => {
    for (const m of src.matchAll(SCRIPT_OPEN)) {
      const attrs = m[1];
      const hasSrc = /\bsrc\s*=/.test(attrs);
      const isJsonLd = /type\s*=\s*["']application\/ld\+json["']/i.test(attrs);
      assert.ok(
        hasSrc || isJsonLd,
        `${name}: inline <script${attrs}> has no src attribute — externalize it (CSP)`,
      );
    }
  });

  test(`${name}: no inline style="..." attribute`, () => {
    assert.ok(
      !/\sstyle\s*=\s*["']/i.test(src),
      `${name}: found a style="..." attribute — move it to a CSS class (CSP)`,
    );
  });

  test(`${name}: no on*= event-handler attribute`, () => {
    const m = src.match(/\son[a-z]+\s*=\s*["']/i);
    assert.equal(
      m,
      null,
      `${name}: found an inline event handler (${m && m[0].trim()}) — wire it in JS (CSP)`,
    );
  });
}

// ── build-pages.js templates ────────────────────────────────────────────────
test("build-pages.js emits no inline <script> (src or JSON-LD only) and no style=", () => {
  const src = fs.readFileSync(
    path.join(root, "scripts", "build-pages.js"),
    "utf8",
  );

  // Only inspect <script ...> that begin a line — that's how the templates emit
  // them. This skips the sanitizer's `/<script...>/` regex literal and the
  // explanatory `// <script>` comment, which are not emissions.
  for (const m of src.matchAll(/^[ \t]*<script\b([^>]*)>/gm)) {
    const attrs = m[1];
    const hasSrc = /\bsrc\s*=/.test(attrs);
    const isJsonLd = /type\s*=\s*["']application\/ld\+json["']/i.test(attrs);
    assert.ok(
      hasSrc || isJsonLd,
      `build-pages.js emits inline <script${attrs}> without src — externalize it (CSP)`,
    );
  }

  assert.ok(
    !/style="/.test(src),
    'build-pages.js emits a style="..." attribute — use a CSS utility class (CSP)',
  );
});
