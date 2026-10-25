import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "fs/promises";
import {
  listMembersNeedingEntries,
  listSummaryNeedsRegeneration,
  auditVerdictIsPass,
  pruneObjectKeys,
  validateListEntries,
} from "../lib/summary-pruning.js";

test("pruneObjectKeys removes dead entries without changing live summaries", () => {
  const summaries = {
    "live/repo": { summary: "keep" },
    "dead/repo": { summary: "remove" },
  };
  const removed = pruneObjectKeys(summaries, new Set(["live/repo"]));
  assert.deepEqual(removed, ["dead/repo"]);
  assert.deepEqual(summaries, { "live/repo": { summary: "keep" } });
});

test("auditVerdictIsPass recognizes explicit no-claim verdicts without masking findings", () => {
  assert.equal(auditVerdictIsPass("NONE"), true);
  assert.equal(auditVerdictIsPass("The summary is accurate. Unsupported claims: **NONE**"), true);
  assert.equal(auditVerdictIsPass("Correction/Refinement: all claims in the summary are supported."), true);
  assert.equal(auditVerdictIsPass("Unsupported claims: the summary invents MCP support"), false);
});

test("validateListEntries rejects truncated or mismatched list responses", () => {
  const members = new Set(["owner/one", "owner/two"]);
  assert.equal(validateListEntries({
    "owner/one": "A complete and useful project summary.",
    "owner/two": "Another complete and useful project summary.",
  }, members), true);
  assert.throws(
    () => validateListEntries({ "owner/one": "A complete and useful project summary." }, members),
    /1 missing/,
  );
  assert.throws(
    () => validateListEntries({ "owner/one": "short", "owner/two": "also short" }, members),
    /Invalid list summary/,
  );
});

test("list summary retry survives a prior interrupted generation run", () => {
  const memberKeys = new Set(["owner/repo"]);
  const entries = { "owner/repo": "An existing list description for this repo." };
  assert.equal(listSummaryNeedsRegeneration({
    listSummary: { version: 1, generatedAt: "2026-07-14T10:00:00Z", entries },
    memberKeys,
    summaries: { "owner/repo": { generatedAt: "2026-07-14T11:00:00Z" } },
    version: 1,
  }), true);
  assert.equal(listSummaryNeedsRegeneration({
    listSummary: { version: 1, generatedAt: "2026-07-14T12:00:00Z", entries },
    memberKeys,
    summaries: { "owner/repo": { generatedAt: "2026-07-14T11:00:00Z" } },
    version: 1,
  }), false);
});

test("listMembersNeedingEntries returns only stale members, not the whole list (#958)", () => {
  const memberKeys = new Set(["a/fresh", "b/changed", "c/newer-summary", "d/no-entry"]);
  const text = "An existing list description for this repo.";
  const listSummary = {
    version: 1,
    generatedAt: "2026-10-20T00:00:00Z",
    entries: { "a/fresh": text, "b/changed": text, "c/newer-summary": text },
  };
  const summaries = {
    "a/fresh": { generatedAt: "2026-10-19T00:00:00Z" },
    "b/changed": { generatedAt: "2026-10-19T00:00:00Z" },
    "c/newer-summary": { generatedAt: "2026-10-21T00:00:00Z" },
    "d/no-entry": { generatedAt: "2026-10-19T00:00:00Z" },
  };
  assert.deepEqual(
    listMembersNeedingEntries({
      listSummary, memberKeys, summaries, version: 1, changedKeys: new Set(["b/changed"]),
    }),
    { full: false, keys: ["b/changed", "c/newer-summary", "d/no-entry"] },
  );
  // Nothing stale: nothing to regenerate.
  assert.deepEqual(
    listMembersNeedingEntries({
      listSummary: { ...listSummary, entries: { ...listSummary.entries, "d/no-entry": text } },
      memberKeys, summaries: { ...summaries, "c/newer-summary": summaries["a/fresh"] }, version: 1,
    }).keys,
    [],
  );
});

test("listMembersNeedingEntries does a full pass on a new list or a version bump", () => {
  const memberKeys = new Set(["a/one", "b/two"]);
  assert.deepEqual(
    listMembersNeedingEntries({ listSummary: undefined, memberKeys, summaries: {}, version: 1 }),
    { full: true, keys: ["a/one", "b/two"] },
  );
  assert.deepEqual(
    listMembersNeedingEntries({
      listSummary: { version: 1, generatedAt: "2026-10-20T00:00:00Z", entries: {} },
      memberKeys, summaries: {}, version: 2,
    }),
    { full: true, keys: ["a/one", "b/two"] },
  );
});

test("summary generator prunes both project and list summary records", async () => {
  const source = await readFile(new URL("../scripts/generate-summaries.js", import.meta.url), "utf8");
  assert.match(source, /pruneObjectKeys\(summaries, validKeys\)/);
  assert.match(source, /pruneObjectKeys\(listEntries, memberKeys\)/);
  assert.match(source, /Summary generation failed/);
});
