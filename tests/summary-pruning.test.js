import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "fs/promises";
import {
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
  assert.equal(listSummaryNeedsRegeneration({
    listSummary: { version: 1, generatedAt: "2026-07-14T10:00:00Z" },
    memberKeys,
    summaries: { "owner/repo": { generatedAt: "2026-07-14T11:00:00Z" } },
    version: 1,
  }), true);
  assert.equal(listSummaryNeedsRegeneration({
    listSummary: { version: 1, generatedAt: "2026-07-14T12:00:00Z" },
    memberKeys,
    summaries: { "owner/repo": { generatedAt: "2026-07-14T11:00:00Z" } },
    version: 1,
  }), false);
});

test("summary generator prunes both project and list summary records", async () => {
  const source = await readFile(new URL("../scripts/generate-summaries.js", import.meta.url), "utf8");
  assert.match(source, /pruneObjectKeys\(summaries, validKeys\)/);
  assert.match(source, /pruneObjectKeys\(listEntries, memberKeys\)/);
  assert.match(source, /Summary generation failed/);
});
