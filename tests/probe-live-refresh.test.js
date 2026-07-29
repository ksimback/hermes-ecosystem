import test from "node:test";
import assert from "node:assert/strict";
import { probeLiveRefresh, buildProbeReport } from "../scripts/probe-live-refresh.js";

const ENDPOINT = "https://example.test/api/stars?cron=1";

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

const HEALTHY = {
  source: "github-api",
  stale: false,
  complete: true,
  totals: { count: 216 },
  fetchedAt: "2026-07-29T12:00:00Z",
};

test("probeLiveRefresh requires the cron secret", async () => {
  await assert.rejects(() => probeLiveRefresh({ endpoint: ENDPOINT }), /CRON_SECRET is required/);
});

test("probeLiveRefresh sends the cron secret as a bearer token", async () => {
  let seen = null;
  await probeLiveRefresh({
    cronSecret: "s3cret",
    endpoint: ENDPOINT,
    fetchImpl: async (url, init) => {
      seen = { url, init };
      return jsonResponse(HEALTHY);
    },
  });
  assert.equal(seen.url, ENDPOINT);
  assert.equal(seen.init.method, "GET");
  assert.equal(seen.init.headers.Authorization, "Bearer s3cret");
});

test("probeLiveRefresh accepts a live, complete snapshot", async () => {
  const result = await probeLiveRefresh({
    cronSecret: "s",
    endpoint: ENDPOINT,
    fetchImpl: async () => jsonResponse(HEALTHY),
  });
  assert.equal(result.totals.count, 216);
});

// The whole point of the probe: the cron flag bypasses the cache, so a
// last-good response means the live path failed and the handler degraded
// quietly. That must be an error, not a pass.
test("probeLiveRefresh fails when the handler silently served last-good", async () => {
  await assert.rejects(
    () =>
      probeLiveRefresh({
        cronSecret: "s",
        endpoint: ENDPOINT,
        fetchImpl: async () =>
          jsonResponse({
            source: "last-good",
            stale: true,
            degradedReason: "Live refresh failed: Bad credentials",
          }),
      }),
    /expected a live snapshot.*got "last-good".*Bad credentials/s
  );
});

test("probeLiveRefresh fails on a 503 from the refresh path", async () => {
  await assert.rejects(
    () =>
      probeLiveRefresh({
        cronSecret: "s",
        endpoint: ENDPOINT,
        fetchImpl: async () => ({
          ok: false,
          status: 503,
          text: async () => '{"error":"Star refresh failed","reason":"Bad credentials"}',
        }),
      }),
    /HTTP 503.*Bad credentials/s
  );
});

test("probeLiveRefresh fails a live snapshot flagged stale", async () => {
  await assert.rejects(
    () =>
      probeLiveRefresh({
        cronSecret: "s",
        endpoint: ENDPOINT,
        fetchImpl: async () => jsonResponse({ ...HEALTHY, stale: true }),
      }),
    /reported stale/
  );
});

test("probeLiveRefresh names unavailable repos when the snapshot is incomplete", async () => {
  await assert.rejects(
    () =>
      probeLiveRefresh({
        cronSecret: "s",
        endpoint: ENDPOINT,
        fetchImpl: async () =>
          jsonResponse({
            ...HEALTHY,
            complete: false,
            unavailableRepos: [{ owner: "gone", repo: "x" }],
          }),
      }),
    /incomplete — unavailable: gone\/x/
  );
});

test("buildProbeReport explains the two-token distinction and the no-scope fix", () => {
  const body = buildProbeReport({ reason: "HTTP 503", endpoint: ENDPOINT });
  assert.match(body, /HTTP 503/);
  assert.match(body, /different.*token/i);
  assert.match(body, /Actions token/);
  assert.match(body, /no scopes/);
  // Guard the security guidance: public_repo grants write access and must stay
  // called out as the wrong choice.
  assert.match(body, /Do not grant `public_repo`/);
  assert.match(body, /vercel env/);
});
