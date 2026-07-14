import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { writeJsonCheckpoint } from "../lib/json-checkpoint.js";

test("writeJsonCheckpoint replaces an existing JSON file without leaving temp files", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "atlas-checkpoint-"));
  const target = path.join(directory, "summaries.json");
  try {
    fs.writeFileSync(target, '{"old":true}\n', "utf8");
    writeJsonCheckpoint(target, { current: true });
    assert.deepEqual(JSON.parse(fs.readFileSync(target, "utf8")), { current: true });
    assert.deepEqual(fs.readdirSync(directory), ["summaries.json"]);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("back-to-back checkpoints use collision-free temporary names", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "atlas-checkpoint-race-"));
  const target = path.join(directory, "summaries.json");
  try {
    for (let index = 0; index < 25; index += 1) {
      writeJsonCheckpoint(target, { index });
    }
    assert.deepEqual(JSON.parse(fs.readFileSync(target, "utf8")), { index: 24 });
    assert.deepEqual(fs.readdirSync(directory), ["summaries.json"]);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("checkpoint helper contains a bounded Windows replacement recovery path", () => {
  const source = fs.readFileSync(
    new URL("../lib/json-checkpoint.js", import.meta.url),
    "utf8",
  );
  assert.match(source, /attempt < 6/);
  assert.match(source, /fs\.copyFileSync\(temporary, filePath\)/);
});

test("summary generation and audit checkpoint successful work incrementally", () => {
  const generate = fs.readFileSync(
    new URL("../scripts/generate-summaries.js", import.meta.url),
    "utf8",
  );
  const audit = fs.readFileSync(
    new URL("../scripts/audit-summaries.js", import.meta.url),
    "utf8",
  );
  assert.match(generate, /writeJsonCheckpoint\(summariesPath, summaries\)/);
  assert.match(audit, /entry\.readmeHash === currentReadmeHash/);
  assert.match(audit, /writeJsonCheckpoint\(summariesPath, summaries\)/);
  assert.match(audit, /mapWithConcurrency\(keys, AUDIT_CONCURRENCY/);
});
