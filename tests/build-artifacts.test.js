import assert from "node:assert/strict";
import { test } from "node:test";

import {
  GENERATED_ARTIFACT_PATHS,
  assertNoUnstagedChanges,
  parsePorcelainStatus,
} from "../lib/build-artifacts.js";

test("generated artifact manifest covers current build outputs", () => {
  assert.deepEqual(GENERATED_ARTIFACT_PATHS, [
    "index.html",
    "projects/",
    "lists/",
    "reports/",
    "sitemap.xml",
    "robots.txt",
    "llms.txt",
    "llms-full.txt",
    "rss.xml",
    "data/repos.json",
    "data/summaries.json",
    "data/list-summaries.json",
    "data/latest-release.json",
  ]);
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
