import test from "node:test";
import assert from "node:assert/strict";
import {
  buildHistoryStatus,
  createStarsHistoryHandler,
} from "../api/stars-history.js";

function responseRecorder() {
  return {
    statusCode: null,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

test("buildHistoryStatus distinguishes fresh, stale, and missing histories", () => {
  const now = new Date("2026-07-14T12:00:00Z");
  assert.equal(buildHistoryStatus([
    { date: "2026-07-14", fetchedAt: "2026-07-14T06:00:00Z" },
  ], now).stale, false);
  assert.equal(buildHistoryStatus([
    { date: "2026-07-12", fetchedAt: "2026-07-12T00:00:00Z" },
  ], now).stale, true);
  assert.deepEqual(buildHistoryStatus([], now), {
    source: "unavailable",
    stale: true,
    latestSnapshotAt: null,
  });
});

test("history handler normalizes new and legacy snapshots and reports coverage", async () => {
  const records = {
    "stars:history:2026-07-14": {
      fetchedAt: "2026-07-14T06:00:00Z",
      data: { "example/tool": 7 },
    },
    "stars:history:2026-07-13": { "example/tool": 6 },
  };
  const handler = createStarsHistoryHandler({
    now: () => new Date("2026-07-14T12:00:00Z"),
    rateLimitImpl: async () => ({ allowed: true }),
    kvGetImpl: async (key) => records[key] || null,
  });
  const res = responseRecorder();
  await handler({ query: { days: "3" }, headers: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.source, "redis");
  assert.equal(res.body.stale, false);
  assert.equal(res.body.days, 2);
  assert.equal(res.body.requestedDays, 3);
  assert.equal(res.body.coverage, 2 / 3);
  assert.deepEqual(res.body.history.map((item) => item.data), [
    { "example/tool": 6 },
    { "example/tool": 7 },
  ]);
});

test("history backend failure returns HTTP 503 with explicit degraded state", async () => {
  const handler = createStarsHistoryHandler({
    rateLimitImpl: async () => ({ allowed: true }),
    kvGetImpl: async () => { throw new Error("offline"); },
  });
  const res = responseRecorder();
  await handler({ query: { days: "1" }, headers: {} }, res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.source, "unavailable");
  assert.equal(res.body.stale, true);
  assert.equal(res.headers["Cache-Control"], "no-store");
});
