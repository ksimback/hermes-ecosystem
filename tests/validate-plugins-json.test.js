import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validatePlugins, MIN_GROUP_PLUGINS } from "../scripts/validate-plugins-json.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ── fixtures ──────────────────────────────────────────────────────────────

function makePluginsData() {
  return {
    updatedAt: "2026-11-16",
    catalogCheckedAt: "2026-11-16",
    catalogEntries: 2382,
    testedAgainst: null,
    useCases: [
      { slug: "tracing", title: "Tracing", intent: "See what it does.", description: "Tracing plugins." },
      { slug: "voice", title: "Voice", intent: "Talk to it.", description: "Voice plugins." },
    ],
    plugins: [
      {
        name: "langfuse",
        title: "Langfuse",
        repo: "NousResearch/hermes-official-plugins",
        tier: "official",
        shelf: "general",
        requiresHermes: ">=0.21.7",
        install: "hermes plugins install langfuse",
        verdict: "Default tracing pick.",
        useCases: ["tracing"],
        topPick: true,
      },
      {
        name: "otel",
        title: "OTel",
        repo: "acme/hermes-otel",
        tier: "community",
        shelf: "general",
        requiresHermes: null,
        install: "hermes plugins install otel",
        verdict: "For existing OTel stacks.",
        caveat: "Young project.",
        useCases: ["tracing"],
      },
      {
        name: "talk",
        title: "Talk",
        repo: "acme/talk",
        tier: "verified",
        shelf: "voice",
        requiresHermes: null,
        install: "hermes plugins install talk",
        verdict: "Realtime voice.",
        useCases: ["voice"],
        topPick: true,
      },
      {
        name: "fish",
        title: "Fish",
        repo: "acme/fish",
        tier: "community",
        shelf: "voice",
        requiresHermes: null,
        install: "hermes plugins install fish",
        verdict: "Spoken replies.",
        useCases: ["voice"],
      },
    ],
    skipped: ["Branch-tip installs."],
  };
}

function expectError(data, pattern) {
  const errors = validatePlugins(data, []);
  assert.ok(
    errors.some((e) => pattern.test(e)),
    `expected an error matching ${pattern}, got:\n${errors.join("\n")}`
  );
}

// ── tests ─────────────────────────────────────────────────────────────────

test("valid fixture passes", () => {
  assert.deepEqual(validatePlugins(makePluginsData(), []), []);
});

test("the real data/plugins.json passes", () => {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "plugins.json"), "utf8"));
  const repos = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "repos.json"), "utf8"));
  assert.deepEqual(validatePlugins(data, repos), []);
});

test("a plugin does not need to be in data/repos.json", () => {
  const repos = [{ owner: "someone", repo: "else" }];
  assert.deepEqual(validatePlugins(makePluginsData(), repos), []);
});

test("non-object top level fails", () => {
  assert.deepEqual(validatePlugins([], []), ["data/plugins.json must contain a top-level object"]);
});

test("updatedAt and catalogCheckedAt must be ISO dates not in the future", () => {
  const bad = makePluginsData();
  bad.updatedAt = "Nov 16";
  expectError(bad, /^updatedAt must be a YYYY-MM-DD/);

  const future = makePluginsData();
  future.catalogCheckedAt = "2999-01-01";
  expectError(future, /^catalogCheckedAt "2999-01-01" is in the future/);
});

test("catalogEntries must be a positive integer", () => {
  const data = makePluginsData();
  data.catalogEntries = "2382";
  expectError(data, /^catalogEntries must be a positive integer/);
});

test("testedAgainst must be null or a v-prefixed version", () => {
  const data = makePluginsData();
  data.testedAgainst = "0.22.6";
  expectError(data, /^testedAgainst must be null/);

  const tested = makePluginsData();
  tested.testedAgainst = "v0.22.6";
  assert.deepEqual(validatePlugins(tested, []), []);
});

test("skipped must be an array of non-empty strings", () => {
  const data = makePluginsData();
  data.skipped = ["ok", ""];
  expectError(data, /^skipped must be an array of non-empty strings/);
});

test("tier must be official, verified or community", () => {
  const data = makePluginsData();
  data.plugins[1].tier = "trusted";
  expectError(data, /plugins\[otel\] tier must be one of: official, verified, community/);
});

test("group slugs must be kebab-case and unique", () => {
  const bad = makePluginsData();
  bad.useCases[0].slug = "Tracing_Stuff";
  expectError(bad, /useCases\[Tracing_Stuff\] slug must be lowercase kebab-case/);

  const dup = makePluginsData();
  dup.useCases[1].slug = "tracing";
  expectError(dup, /useCases\[tracing\] duplicate slug/);
});

test("plugin useCases must reference existing groups", () => {
  const data = makePluginsData();
  data.plugins[3].useCases = ["voice", "nope"];
  expectError(data, /plugins\[fish\] useCases references undefined group slug "nope"/);
});

test(`every group needs at least ${MIN_GROUP_PLUGINS} plugins`, () => {
  const data = makePluginsData();
  data.plugins[3].useCases = ["tracing"];
  expectError(data, /useCases\[voice\] has only 1 plugin\(s\) referencing it — needs at least 2/);
});

test("at most one topPick per group", () => {
  const data = makePluginsData();
  data.plugins[1].topPick = true;
  expectError(data, /plugins\[otel\] sets topPick alongside langfuse — only one topPick allowed per group \[tracing\]/);
});

test("a group with no topPick is allowed", () => {
  const data = makePluginsData();
  delete data.plugins[2].topPick;
  assert.deepEqual(validatePlugins(data, []), []);
});

test("plugin names must be unique", () => {
  const data = makePluginsData();
  data.plugins[3].name = "talk";
  data.plugins[3].install = "hermes plugins install talk";
  expectError(data, /plugins\[talk\] duplicate plugin name "talk"/);
});

test("install must be exactly the catalog install for the plugin's name", () => {
  const branch = makePluginsData();
  branch.plugins[1].install = "hermes plugins install acme/hermes-otel --enable";
  expectError(branch, /plugins\[otel\] install must be exactly "hermes plugins install otel" — the hub only recommends catalog installs/);

  const wrongName = makePluginsData();
  wrongName.plugins[1].install = "hermes plugins install langfuse";
  expectError(wrongName, /plugins\[otel\] install must be exactly "hermes plugins install otel"/);
});

test("repo must be a GitHub owner/name", () => {
  for (const repo of ["hermes-otel", "https://github.com/acme/hermes-otel", "acme/hermes/otel", ""]) {
    const data = makePluginsData();
    data.plugins[1].repo = repo;
    expectError(data, /plugins\[otel\] repo must be a GitHub "owner\/name" string/);
  }
});

test("required string fields and optional field types are enforced", () => {
  const data = makePluginsData();
  data.plugins[1].verdict = "";
  data.plugins[1].caveat = "";
  data.plugins[1].requiresHermes = 21;
  data.plugins[3].topPick = "yes";
  delete data.plugins[3].shelf;
  expectError(data, /plugins\[otel\] verdict must be a non-empty string/);
  expectError(data, /plugins\[otel\] caveat, when present, must be a non-empty string/);
  expectError(data, /plugins\[otel\] requiresHermes must be a non-empty string or null/);
  expectError(data, /plugins\[fish\] topPick, when present, must be a boolean/);
  expectError(data, /plugins\[fish\] shelf must be a non-empty string/);
});

test("empty useCases / plugins arrays fail", () => {
  const data = makePluginsData();
  data.plugins = [];
  expectError(data, /^plugins must be a non-empty array/);
  data.useCases = [];
  expectError(data, /^useCases must be a non-empty array/);
});
