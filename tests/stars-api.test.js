import test from "node:test";
import assert from "node:assert/strict";
import {
  buildStarsResponse,
  createStarsHandler,
  STAR_KEYS,
} from "../api/stars.js";

const repos = [
  { owner: "NousResearch", repo: "hermes-agent", stars: 90 },
  { owner: "example", repo: "tool", stars: 6 },
];
const starData = [
  {
    owner: "NousResearch",
    repo: "hermes-agent",
    stars: 100,
    updatedAt: "2026-07-14T00:00:00Z",
  },
  { owner: "example", repo: "tool", stars: 7, updatedAt: "2026-07-13T00:00:00Z" },
];
const release = {
  version: "v0.18.2",
  tag: "v2026.7.7.2",
  name: "Hermes Agent v0.18.2",
  publishedAt: "2026-07-07T00:00:00Z",
};

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

function request(overrides = {}) {
  return {
    method: "GET",
    query: {},
    headers: {},
    ...overrides,
  };
}

function handler(overrides = {}) {
  return createStarsHandler({
    kvGetImpl: async () => null,
    kvSetImpl: async () => true,
    loadReposImpl: () => repos,
    loadLatestReleaseImpl: () => release,
    env: {},
    now: () => new Date("2026-07-14T12:00:00Z"),
    ...overrides,
  });
}

test("authenticated POST validates and persists current, last-good, and history", async () => {
  const writes = [];
  const run = handler({
    env: { CRON_SECRET: "secret" },
    kvSetImpl: async (...args) => { writes.push(args); return true; },
  });
  const res = responseRecorder();
  await run(request({
    method: "POST",
    query: { cron: "1" },
    headers: { authorization: "Bearer secret" },
    body: { starData, hermesRelease: release, atlasStars: 42 },
  }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.source, "github-actions");
  assert.equal(res.body.stale, false);
  assert.equal(res.body.fetchedAt, "2026-07-14T12:00:00.000Z");
  assert.equal(res.body.totals.stars, 107);
  assert.deepEqual(writes.map(([key]) => key), [
    STAR_KEYS.current,
    STAR_KEYS.lastGood,
    "stars:history:2026-07-14",
  ]);
});

test("POST ingestion fails closed when any Redis write fails", async () => {
  let write = 0;
  const run = handler({
    env: { CRON_SECRET: "secret" },
    kvSetImpl: async () => { write += 1; return write !== 2; },
  });
  const res = responseRecorder();
  await run(request({
    method: "POST",
    query: { cron: "1" },
    headers: { authorization: "Bearer secret" },
    body: { starData, hermesRelease: release, atlasStars: 42 },
  }), res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.stale, true);
});

test("partial GitHub snapshot is persisted but remains explicitly incomplete", async () => {
  const partialData = [starData[0], { ...starData[1], stars: 6, updatedAt: null }];
  const res = responseRecorder();
  await handler({ env: { CRON_SECRET: "secret" } })(request({
    method: "POST",
    query: { cron: "1" },
    headers: { authorization: "Bearer secret" },
    body: {
      starData: partialData,
      hermesRelease: release,
      atlasStars: 42,
      complete: false,
      unavailableRepos: [{ owner: "example", repo: "tool", reason: "deleted" }],
    },
  }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.stale, false);
  assert.equal(res.body.complete, false);
  assert.deepEqual(res.body.unavailableRepos, [
    { owner: "example", repo: "tool", reason: "deleted" },
  ]);
});

test("missing Vercel GitHub token returns an explicit static stale response", async () => {
  const res = responseRecorder();
  await handler()(request(), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.source, "static");
  assert.equal(res.body.stale, true);
  assert.equal(res.body.fetchedAt, null);
  assert.equal(res.body.totals.updated, null);
  assert.equal(res.headers["Cache-Control"], "no-store");
});

test("last-good fallback is preserved but cannot masquerade as fresh", async () => {
  const lastGood = buildStarsResponse({
    starData,
    hermesRelease: release,
    atlasStars: 42,
    fetchedAt: "2026-07-14T00:00:00Z",
    source: "github-actions",
    stale: false,
  });
  const res = responseRecorder();
  await handler({
    kvGetImpl: async (key) => key === STAR_KEYS.lastGood ? lastGood : null,
  })(request(), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.source, "last-good");
  assert.equal(res.body.stale, true);
  assert.equal(res.body.fetchedAt, "2026-07-14T00:00:00Z");
});

test("authenticated GET refresh reports GitHub failure as HTTP 503", async () => {
  const res = responseRecorder();
  await handler({
    env: { CRON_SECRET: "secret", GITHUB_TOKEN: "token" },
    fetchImpl: async () => ({ ok: false, status: 500 }),
  })(request({
    query: { cron: "1" },
    headers: { authorization: "Bearer secret" },
  }), res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.stale, true);
});

test("refresh and POST routes reject missing authorization", async () => {
  const run = handler({ env: { CRON_SECRET: "secret" } });
  for (const req of [
    request({ query: { cron: "1" } }),
    request({ method: "POST", query: { cron: "1" }, body: {} }),
  ]) {
    const res = responseRecorder();
    await run(req, res);
    assert.equal(res.statusCode, 401);
  }
});
