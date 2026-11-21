import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  GENERATED_ARTIFACT_PATHS,
  REFRESHED_CONTENT_PATHS,
  SITE_CHROME_ROOTS,
  assertNoUnstagedChanges,
  git,
  parsePorcelainStatus,
  stageGeneratedArtifacts,
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
    "guide/plugins/index.html",
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
    "drafts/guide-plugins.md",
  ]);
});

test("generated artifact manifest covers current build outputs", () => {
  assert.deepEqual(GENERATED_ARTIFACT_PATHS, [
    "index.html",
    "404.html",
    ...REFRESHED_CONTENT_PATHS.filter((file) => file.startsWith("drafts/")),
    "guide/",
    "dev/",
    "reports/",
    "privacy/",
    "about/",
    "masterclass/",
    "projects/",
    "lists/",
    "ecosystem/",
    "use-cases/",
    "skills/",
    "plugins/",
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
      GENERATED_ARTIFACT_PATHS.some((entry) => entry === outputPath || (entry.endsWith("/") && outputPath.startsWith(entry))),
      `${outputPath} is missing from the generated artifact manifest`
    );
  }
});

test("every root refreshSiteChrome rewrites is staged", () => {
  const src = fs.readFileSync("scripts/build-pages.js", "utf-8");
  assert.match(src, /for \(const relDir of SITE_CHROME_ROOTS\) collect\(relDir\)/);
  for (const root of SITE_CHROME_ROOTS) {
    assert.ok(
      GENERATED_ARTIFACT_PATHS.includes(`${root}/`),
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

test("stages a refreshed mobile guide without weakening the unstaged-file guard", (t) => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "atlas-artifacts-"));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  git(["init", "-q"], { cwd });

  for (const entry of [...GENERATED_ARTIFACT_PATHS, "guide/mobile/index.html"]) {
    const file = path.join(cwd, entry.endsWith("/") ? `${entry}index.html` : entry);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "old masthead\n");
  }
  git(["add", "."], { cwd });
  git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "fixture"], { cwd });

  fs.writeFileSync(path.join(cwd, "guide/mobile/index.html"), "refreshed masthead\n");
  stageGeneratedArtifacts({ cwd });
  assert.equal(git(["diff", "--cached", "--name-only"], { cwd }).trim(), "guide/mobile/index.html");

  fs.writeFileSync(path.join(cwd, "unexpected-output.json"), "{}\n");
  assert.throws(() => stageGeneratedArtifacts({ cwd }), /unexpected-output\.json/);
});
