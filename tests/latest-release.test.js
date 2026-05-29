import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildLatestReleaseBlock,
  detectLatestReleaseQuery,
  findLatestReleaseFromMarkdownFiles,
  parseReleaseMarkdown,
} from "../lib/latest-release.js";

test("parseReleaseMarkdown extracts public version, release tag, and publish date", () => {
  const release = parseReleaseMarkdown({
    source: "research/46-release-2026-5-29.md",
    content: [
      "# Hermes Agent v2026.5.29 Release Notes",
      "",
      "**Version:** v2026.5.29",
      "**Published:** 2026-05-29T01:12:15Z",
      "**Source:** https://github.com/NousResearch/hermes-agent/releases/tag/v2026.5.29",
      "",
      "# Hermes Agent v0.15.1 (v2026.5.29)",
      "",
      "> **The Patch Release.** A same-day hotfix for v0.15.0.",
    ].join("\n"),
  });

  assert.equal(release.version, "v0.15.1");
  assert.equal(release.tag, "v2026.5.29");
  assert.equal(release.publishedAt, "2026-05-29T01:12:15Z");
  assert.equal(release.source, "research/46-release-2026-5-29.md");
  assert.match(release.summary, /same-day hotfix/);
});

test("findLatestReleaseFromMarkdownFiles chooses newest Published date", () => {
  const latest = findLatestReleaseFromMarkdownFiles([
    {
      source: "research/34-release-2026-4-23.md",
      content: "**Version:** v2026.4.23\n**Published:** 2026-04-23T22:32:13Z\n# Hermes Agent v0.11.0 (v2026.4.23)",
    },
    {
      source: "research/46-release-2026-5-29.md",
      content: "**Version:** v2026.5.29\n**Published:** 2026-05-29T01:12:15Z\n# Hermes Agent v0.15.1 (v2026.5.29)",
    },
  ]);

  assert.equal(latest.version, "v0.15.1");
  assert.equal(latest.tag, "v2026.5.29");
});

test("detectLatestReleaseQuery catches newest/latest what's-new questions", () => {
  assert.equal(detectLatestReleaseQuery("what's new in the latest hermes release?"), true);
  assert.equal(detectLatestReleaseQuery("what changed in the newest release"), true);
  assert.equal(detectLatestReleaseQuery("how do I install Hermes?"), false);
});

test("buildLatestReleaseBlock tells the model to use v0.15.1 as latest", () => {
  const block = buildLatestReleaseBlock({
    version: "v0.15.1",
    tag: "v2026.5.29",
    name: "Hermes Agent v0.15.1 (2026.5.29) — The Patch Release",
    publishedAt: "2026-05-29T01:12:15Z",
    source: "research/46-release-2026-5-29.md",
    summary: "A same-day hotfix for v0.15.0.",
  });

  assert.match(block, /Hermes Agent v0\.15\.1/);
  assert.match(block, /v2026\.5\.29/);
  assert.match(block, /latest known Hermes Agent release/i);
  assert.doesNotMatch(block, /v0\.11\.0/);
});
