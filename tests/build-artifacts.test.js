import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

import {
  GENERATED_ARTIFACT_PATHS,
  REFRESHED_CONTENT_PATHS,
  assertNoUnstagedChanges,
  parsePorcelainStatus,
} from "../lib/build-artifacts.js";

test("refreshed content manifest covers the hand-authored pages + drafts", () => {
  assert.deepEqual(REFRESHED_CONTENT_PATHS, [
    "guide/index.html",
    "guide/install/index.html",
    "guide/memory/index.html",
    "guide/vs-claude-code/index.html",
    "guide/modes/index.html",
    "guide/desktop/index.html",
    "guide/install/windows/index.html",
    "guide/install/macos/index.html",
    "guide/install/linux/index.html",
    "guide/install/raspberry-pi/index.html",
    "guide/install/vps/index.html",
    "drafts/handbook-hub.md",
    "drafts/handbook-vs-claude-code.md",
    "drafts/guide-memory.md",
    "drafts/guide-modes.md",
    "drafts/guide-desktop.md",
    "drafts/guide-install-windows.md",
    "drafts/guide-install-macos.md",
    "drafts/guide-install-linux.md",
    "drafts/guide-install-raspberry-pi.md",
    "drafts/guide-install-vps.md",
  ]);
});

test("generated artifact manifest covers current build outputs", () => {
  assert.deepEqual(GENERATED_ARTIFACT_PATHS, [
    "index.html",
    "404.html",
    ...REFRESHED_CONTENT_PATHS,
    "dev/",
    "privacy/",
    "about/",
    "masterclass/",
    "projects/",
    "lists/",
    "ecosystem/",
    "use-cases/",
    "skills/",
    "reports/",
    "sitemap.xml",
    "robots.txt",
    "llms.txt",
    "llms-full.txt",
    "rss.xml",
    "data/repos.json",
    "data/use-cases.json",
    "data/user-stories.json",
    "data/summaries.json",
    "data/list-summaries.json",
    "data/latest-release.json",
  ]);
});

test("every hand-authored page refreshed by the build is staged", () => {
  for (const outputPath of REFRESHED_CONTENT_PATHS) {
    assert.ok(
      GENERATED_ARTIFACT_PATHS.includes(outputPath),
      `${outputPath} is missing from the generated artifact manifest`
    );
  }
});

test("every root refreshSiteChrome rewrites is staged", () => {
  // refreshSiteChrome() restamps nav/footer on these hand-authored trees; a
  // root missing from the manifest leaves an unstaged change and fails the
  // bot commit (the /about launch did exactly this).
  const src = fs.readFileSync("scripts/build-pages.js", "utf-8");
  const m = src.match(/const roots = \[([^\]]*)\];/);
  assert.ok(m, "refreshSiteChrome roots list not found in build-pages.js");
  const roots = [...m[1].matchAll(/"([^"]+)"/g)].map((r) => r[1]);
  assert.ok(roots.length > 0);
  for (const root of roots) {
    assert.ok(
      GENERATED_ARTIFACT_PATHS.some((p) => p === `${root}/` || p.startsWith(`${root}/`)),
      `${root}/ is refreshed by build-pages but missing from the generated artifact manifest`
    );
  }
});

test("porcelain parser identifies unstaged modified and untracked files", () => {
  const entries = parsePorcelainStatus([
    "M  index.html",
    " M scripts/build-pages.js",
    "?? new-artifact.json",
    "D  projects/old.html",
  ].join("\n"));

  assert.equal(entries.length, 4);
  assert.deepEqual(entries.map((e) => e.path), [
    "index.html",
    "scripts/build-pages.js",
    "new-artifact.json",
    "projects/old.html",
  ]);
  assert.deepEqual(entries.map((e) => `${e.index}${e.worktree}`), ["M ", " M", "??", "D "]);
});

test("assertNoUnstagedChanges allows fully staged generated changes", () => {
  assert.doesNotThrow(() => assertNoUnstagedChanges({
    statusOutput: [
      "M  index.html",
      "A  reports/new.html",
      "D  projects/old.html",
    ].join("\n"),
  }));
});

test("assertNoUnstagedChanges fails loudly on silently dropped artifacts", () => {
  assert.throws(
    () => assertNoUnstagedChanges({
      statusOutput: [
        "M  index.html",
        "?? data/new-generated-file.json",
      ].join("\n"),
    }),
    /data\/new-generated-file\.json/
  );
});
