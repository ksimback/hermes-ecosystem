import test from "node:test";
import assert from "node:assert/strict";
import { classifyRebuildDiff, normalizeLine } from "../lib/rebuild-diff.js";

function patchFor(file, pairs) {
  const body = pairs
    .map(([minus, plus], i) => `@@ -${i + 1} +${i + 1} @@\n${minus.map((l) => `-${l}`).join("\n")}\n${plus.map((l) => `+${l}`).join("\n")}`)
    .join("\n");
  return `diff --git a/${file} b/${file}\nindex 1111111..2222222 100644\n--- a/${file}\n+++ b/${file}\n${body}\n`;
}

test("normalizeLine collapses star counts and date stamps but keeps versions", () => {
  assert.equal(normalizeLine('    "stars": 253047,'), normalizeLine('    "stars": 253112,'));
  assert.equal(
    normalizeLine('<div class="repo-stars">★ 3.9k</div>'),
    normalizeLine('<div class="repo-stars">★ 4.0k</div>'),
  );
  assert.equal(
    normalizeLine("<li>253,047 GitHub stars (as of 2026-10-11)</li>"),
    normalizeLine("<li>253,112 GitHub stars (as of 2026-10-12)</li>"),
  );
  assert.equal(
    normalizeLine("<lastBuildDate>Mon, 12 Oct 2026 17:18:00 GMT</lastBuildDate>"),
    normalizeLine("<lastBuildDate>Tue, 13 Oct 2026 06:31:09 GMT</lastBuildDate>"),
  );
  assert.equal(normalizeLine("Updated September 30, 2026"), normalizeLine("Updated October 1, 2026"));
  // A release bump is content, not noise.
  assert.notEqual(normalizeLine("Latest release: v0.21.5"), normalizeLine("Latest release: v0.21.6"));
  assert.notEqual(normalizeLine("Hermes v2026.9.24 ships"), normalizeLine("Hermes v2026.10.8 ships"));
});

test("a diff of only star and date restamps is noise", () => {
  const nameStatus = "M\tprojects/a/b.html\nM\trss.xml\nM\tdata/repos.json\n";
  const patch =
    patchFor("projects/a/b.html", [
      [['    "userInteractionCount": 1204'], ['    "userInteractionCount": 1210']],
      [['  "dateModified": "2026-10-11",', '    <span class="stars">★ 1,204</span>'], ['  "dateModified": "2026-10-12",', '    <span class="stars">★ 1,210</span>']],
    ]) +
    patchFor("rss.xml", [[["    <lastBuildDate>Sun, 11 Oct 2026 06:31:00 GMT</lastBuildDate>"], ["    <lastBuildDate>Mon, 12 Oct 2026 17:18:00 GMT</lastBuildDate>"]]]) +
    patchFor("data/repos.json", [[['    "stars": 1204,'], ['    "stars": 1210,']]]);
  const result = classifyRebuildDiff(nameStatus, patch);
  assert.equal(result.noiseOnly, true, result.reason);
});

test("changed prose is structural even alongside noise", () => {
  const nameStatus = "M\tlists/top-skills.html\n";
  const patch = patchFor("lists/top-skills.html", [
    [["★ 120"], ["★ 125"]],
    [["<p>A skills collection for coding.</p>"], ["<p>A skills collection for coding and research.</p>"]],
  ]);
  const result = classifyRebuildDiff(nameStatus, patch);
  assert.equal(result.noiseOnly, false);
  assert.match(result.reason, /content changed/);
});

test("added, deleted or renamed files are structural", () => {
  for (const nameStatus of ["A\tprojects/new/repo.html\n", "D\tprojects/old/repo.html\n", "R100\tprojects/a/x.html\tprojects/b/x.html\n"]) {
    assert.equal(classifyRebuildDiff(nameStatus, "").noiseOnly, false, nameStatus);
  }
});

test("a release version bump is structural", () => {
  const nameStatus = "M\tguide/install/index.html\n";
  const patch = patchFor("guide/install/index.html", [[["<p>Current release: v0.21.5 (2026-09-24)</p>"], ["<p>Current release: v0.21.6 (2026-10-08)</p>"]]]);
  assert.equal(classifyRebuildDiff(nameStatus, patch).noiseOnly, false);
});

test("hunks that add or remove lines are structural", () => {
  const nameStatus = "M\tsitemap.xml\n";
  const patch = `diff --git a/sitemap.xml b/sitemap.xml\n--- a/sitemap.xml\n+++ b/sitemap.xml\n@@ -10,0 +11 @@\n+  <url><loc>https://hermesatlas.com/projects/new/repo</loc></url>\n`;
  const result = classifyRebuildDiff(nameStatus, patch);
  assert.equal(result.noiseOnly, false);
  assert.match(result.reason, /adds or removes lines/);
});

test("fails open on anything it cannot account for", () => {
  assert.equal(classifyRebuildDiff("", "").noiseOnly, false);
  // name-status lists a file the patch never mentions
  assert.equal(classifyRebuildDiff("M\ta.html\nM\tb.html\n", patchFor("a.html", [[["★ 1"], ["★ 2"]]])).noiseOnly, false);
  assert.equal(
    classifyRebuildDiff("M\tog.png\n", "diff --git a/og.png b/og.png\nBinary files a/og.png and b/og.png differ\n").noiseOnly,
    false,
  );
});
