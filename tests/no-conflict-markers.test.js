import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";

// PR #950 committed an unresolved merge into drafts/handbook-hub.md. Both
// sides were identical and the freshness pass kept restamping them, so the
// markers shipped in /llms-full.txt and the RAG chunks for weeks unnoticed.
test("no tracked file contains merge conflict markers", () => {
  let hits = "";
  try {
    hits = execFileSync(
      "git",
      ["grep", "-nIE", "^(<<<<<<<|>>>>>>>)( |$)", "--", ".", ":!tests/no-conflict-markers.test.js"],
      { encoding: "utf8" },
    );
  } catch (err) {
    if (err.status !== 1) throw err; // 1 = no matches
  }
  assert.equal(hits, "", `conflict markers found:\n${hits}`);
});
