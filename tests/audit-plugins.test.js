import test from "node:test";
import assert from "node:assert/strict";
import { parseCatalogYaml, repoKey, diffPick, formatReport, STALE_DAYS } from "../scripts/audit-plugins.js";

const YAML = `name: hermes_otel
repo: https://github.com/briancaffey/hermes-otel
sha: 0123456789abcdef0123456789abcdef01234567
tier: community        # official | verified | community
category: general
requires_hermes: ">=0.21"
known_issues:
  - First issue.
  - "Second issue."
capabilities:
  provides_tools: []
`;

const pick = {
  name: "hermes_otel",
  repo: "briancaffey/hermes-otel",
  tier: "community",
  requiresHermes: ">=0.21",
};
const now = new Date("2026-11-16T00:00:00Z");
const fresh = { archived: false, pushedAt: "2026-11-10T00:00:00Z" };

test("parseCatalogYaml reads scalars, strips quotes and comments, counts known issues", () => {
  const e = parseCatalogYaml(YAML);
  assert.equal(e.name, "hermes_otel");
  assert.equal(e.tier, "community");
  assert.equal(e.requiresHermes, ">=0.21");
  assert.equal(e.knownIssues, 2);
});

test("parseCatalogYaml defaults a missing tier to community and a missing floor to null", () => {
  const e = parseCatalogYaml("name: x\nrepo: https://github.com/a/b\n");
  assert.equal(e.tier, "community");
  assert.equal(e.requiresHermes, null);
  assert.equal(e.knownIssues, 0);
});

test("repoKey normalizes GitHub URLs", () => {
  assert.equal(repoKey("https://github.com/Owner/Repo.git"), "owner/repo");
  assert.equal(repoKey("https://github.com/Owner/Repo"), "owner/repo");
});

test("diffPick: an in-sync pick has no findings", () => {
  assert.deepEqual(diffPick(pick, parseCatalogYaml(YAML), fresh, now), []);
});

test("diffPick flags a pick that left the catalog", () => {
  assert.deepEqual(diffPick(pick, null, fresh, now), ["no longer in the official catalog"]);
});

test("diffPick flags tier, version-floor and repo changes", () => {
  const entry = { ...parseCatalogYaml(YAML), tier: "verified", requiresHermes: ">=0.23", repo: "https://github.com/x/y" };
  const f = diffPick(pick, entry, fresh, now);
  assert.equal(f.length, 3);
  assert.match(f[0], /tier is now "verified"/);
  assert.match(f[1], /requires_hermes is now >=0.23/);
  assert.match(f[2], /catalog repo is now x\/y/);
});

test("diffPick treats null and unset version floors as equal", () => {
  const p = { ...pick, requiresHermes: null };
  const entry = { ...parseCatalogYaml(YAML), requiresHermes: null };
  assert.deepEqual(diffPick(p, entry, fresh, now), []);
});

test("diffPick flags archived and stale repos", () => {
  const stale = { archived: true, pushedAt: new Date(now - (STALE_DAYS + 5) * 86400000).toISOString() };
  const f = diffPick(pick, parseCatalogYaml(YAML), stale, now);
  assert.ok(f.includes("repo is archived"));
  assert.ok(f.some((s) => /no push in \d+ days/.test(s)));
});

test("formatReport lists only picks needing attention and reports an unchecked catalog count", () => {
  const md = formatReport(
    {
      checkedAt: "2026-11-16",
      catalogEntries: null,
      catalogError: "500 boom",
      results: [
        { name: "a", status: "ok", findings: [] },
        { name: "b", status: "unchecked", findings: ["503 Service Unavailable"] },
      ],
    },
    { catalogEntries: 2381, catalogCheckedAt: "2026-11-16" },
  );
  assert.match(md, /2 picks, 1 need attention/);
  assert.match(md, /`b` \[unchecked\]/);
  assert.doesNotMatch(md, /`a`/);
  assert.match(md, /count: unchecked \(500 boom\)/);
});
