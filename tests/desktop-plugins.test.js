import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  canonicalizeCatalog,
  mapBounded,
  parseArgs,
  refreshCatalog,
  sourceSignals,
  validateCatalog,
} from "../scripts/refresh-desktop-plugins.js";

const catalog = JSON.parse(await readFile(new URL("../data/desktop-plugins.json", import.meta.url), "utf8"));

test("desktop plugin catalog has immutable, source-verified evidence", () => {
  assert.deepEqual(validateCatalog(catalog), []);
  assert.equal(JSON.stringify(catalog, null, 2) + "\n", canonicalizeCatalog(catalog));
  assert.equal(catalog.cutoffAt, "2026-08-14T17:29:59Z");
  assert.equal(catalog.reviewMode, "cutoff-baseline");
  assert.ok(catalog.plugins.length > 0);
  assert.equal(new Set(catalog.plugins.map((p) => p.repository.toLowerCase())).size, catalog.plugins.length);
  for (const plugin of catalog.plugins) {
    assert.match(plugin.reviewedCommit, /^[0-9a-f]{40}$/);
    assert.match(plugin.reviewedCommitAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.ok(plugin.sources.length > 0);
    assert.ok(plugin.sources.some((source) => source.signals.sdkImport && (source.signals.registrationContract || source.signals.contributionContract)));
    const recordedPaths = [...plugin.sources, ...(plugin.ignoredSources || [])].map((source) => source.path);
    assert.equal(new Set(recordedPaths).size, recordedPaths.length);
    for (const source of plugin.sources) {
      assert.match(source.rawUrl, new RegExp(`/${plugin.reviewedCommit}/`));
      assert.ok(source.signals.sdkImport || source.signals.registrationContract || source.signals.contributionContract);
    }
    for (const source of plugin.ignoredSources || []) {
      assert.match(source.rawUrl, new RegExp(`/${plugin.reviewedCommit}/`));
      assert.equal(Object.values(source.signals).some(Boolean), false);
      assert.equal(source.reason, "no direct Desktop SDK evidence signal");
    }
  }
});

test("catalog validator rejects provenance and authority drift", () => {
  const bad = structuredClone(catalog);
  const plugin = bad.plugins[0];
  plugin.repository = "owner with space/repo";
  plugin.url = "http://example.com/repo";
  plugin.official = !plugin.official;
  plugin.reviewedCommitAt = "2026-08-15T00:00:00Z";
  plugin.reviewedAt = "later";
  plugin.sources[0].signals.sdkImport = "yes";
  plugin.ignoredSources = [{
    path: "../fixture.js",
    rawUrl: "https://raw.githubusercontent.com/owner/repo/sha/fixture.js",
    signals: { sdkImport: false, registrationContract: false, contributionContract: false },
    reason: "no direct Desktop SDK evidence signal",
  }];
  const errors = validateCatalog(bad);
  for (const expected of [
    "repository is invalid",
    "url is not canonical",
    "official disagrees",
    "official repository is not owned by NousResearch",
    "reviewedCommitAt is later than cutoffAt",
    "reviewedAt is invalid",
    "signals must be booleans",
    "ignoredSources[0].path is invalid",
  ]) {
    assert.ok(errors.some((error) => error.includes(expected)), `reports ${expected}`);
  }
});

test("source verification requires the SDK import and a concrete contract", () => {
  assert.deepEqual(sourceSignals(`import { registerPlugin } from "@hermes/plugin-sdk";\nregisterPlugin({});`), {
    sdkImport: true,
    registrationContract: true,
    contributionContract: false,
  });
  assert.deepEqual(sourceSignals(`import { host } from "@hermes/plugin-sdk";\nexport default { id: "meter", register(ctx) { ctx.register({}); } };`), {
    sdkImport: true,
    registrationContract: true,
    contributionContract: false,
  });
  for (const manifest of [
    `const plugin = { id: "meter", register(ctx) {} }; export default plugin;`,
    `var plugin = { id: ID, register: function (ctx) {} }; export { plugin as default };`,
    `function register(ctx) {} export default { id: ID, register };`,
    `const plugin: HermesPlugin = /** reviewed type */ ({ id: ID, register(ctx) {} }); export default plugin;`,
  ]) {
    assert.equal(sourceSignals(`import { host } from "@hermes/plugin-sdk";\n${manifest}`).registrationContract, true);
  }
  const regexAndTemplate = "import { host } from '@hermes/plugin-sdk'; const matcher = /[\"']/g; const tpl = `x ${String('a').replace(/\"/g, '')}`; export default { id: 'real', register(ctx) {} };";
  assert.equal(sourceSignals(regexAndTemplate).registrationContract, true);
  for (const propertyCall of [
    `loader.import("@hermes/plugin-sdk"); export default { id: "fake", register(ctx) {} };`,
    `loader.require("@hermes/plugin-sdk"); export default { id: "fake", register(ctx) {} };`,
  ]) {
    assert.equal(sourceSignals(propertyCall).sdkImport, false);
  }
  for (const inert of [
    `/* import { host } from "@hermes/plugin-sdk"; */ /* export default { id: "fake", register(ctx) {} }; */`,
    `const fixture = 'import { host } from "@hermes/plugin-sdk"'; const other = 'export default { id: "fake", register(ctx) {} }';`,
     "const fixture = `import { host } from \"@hermes/plugin-sdk\"; ${`nested ${value}`} export default { id: \"fake\", register(ctx) {} }`;",
  ]) {
    assert.deepEqual(sourceSignals(inert), {
      sdkImport: false,
      registrationContract: false,
      contributionContract: false,
    });
  }
});

test("refresh uses one supplied review timestamp and marks current-head mode", async () => {
  const previousSha = "b".repeat(40);
  const nextSha = "a".repeat(40);
  const input = {
    schemaVersion: 1,
    cutoff: "2026-08-14",
    cutoffAt: "2026-08-14T17:29:59Z",
    reviewMode: "current-head",
    evidenceTier: "source-verified",
    methodology: "https://example.com/methodology",
    plugins: [{
      repository: "example/plugin",
      url: "https://github.com/example/plugin",
      purpose: "Example",
      distributionType: "standalone",
      official: false,
      observed: {},
      defaultBranch: "main",
      reviewedCommit: previousSha,
      reviewedCommitAt: "2026-08-14T00:00:00Z",
      reviewedAt: "2026-08-14T00:00:00Z",
      sources: [{
        path: "plugin.js",
        rawUrl: `https://raw.githubusercontent.com/example/plugin/${previousSha}/plugin.js`,
        signals: { sdkImport: true, registrationContract: true, contributionContract: false },
      }],
    }],
  };
  const fetchImpl = async (value) => {
    const url = new URL(value);
    if (url.pathname === "/repos/example/plugin") return Response.json({ default_branch: "main", description: "Example current", stargazers_count: 2, forks_count: 1, pushed_at: "2026-08-16T00:00:00Z" });
    if (url.pathname === "/repos/example/plugin/commits/main") return Response.json({ sha: nextSha, commit: { committer: { date: "2026-08-16T00:00:00Z" } } });
    if (url.pathname === "/repos/example/plugin/contents/plugin.js") return new Response('import { host } from "@hermes/plugin-sdk"; export default { id: "example", register(ctx) {} };');
    return new Response("not found", { status: 404 });
  };
  const reviewedAt = "2026-08-16T12:00:00Z";
  const result = await refreshCatalog(input, { token: "test-token", concurrency: 2, fetchImpl, reviewedAt });
  assert.deepEqual(result.failures, []);
  assert.equal(result.catalog.reviewMode, "current-head");
  assert.equal(result.catalog.plugins[0].reviewedAt, reviewedAt);
});

test("bounded mapper never exceeds its limit and preserves order", async () => {
  let active = 0;
  let peak = 0;
  const output = await mapBounded([3, 1, 2, 0], 2, async (value) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, value));
    active -= 1;
    return value * 2;
  });
  assert.equal(peak, 2);
  assert.deepEqual(output, [6, 2, 4, 0]);
});

test("check mode is no-write and CLI rejects unknown options", () => {
  assert.equal(parseArgs(["--check"]).write, false);
  assert.equal(parseArgs(["--validate"]).network, false);
  assert.throws(() => parseArgs(["--at-cutoff"]), /Unknown option/);
  assert.throws(() => parseArgs(["--seed"]), /requires a CSV path/);
  assert.throws(() => parseArgs(["--surprise"]), /Unknown option/);
});
