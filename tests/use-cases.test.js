import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  validateUseCases,
  MIN_STACK_CATEGORIES,
  MIN_USE_CASES,
} from "../scripts/validate-use-cases.js";
import { validateStories, diffStoryIds, assertNoSuspiciousShrink } from "../scripts/sync-user-stories.js";
import { GENERATED_ARTIFACT_PATHS } from "../lib/build-artifacts.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));

// ── fixtures ──────────────────────────────────────────────────────────────

const repos = [
  { owner: "a", repo: "one", category: "Memory & Context" },
  { owner: "b", repo: "two", category: "Deployment & Infra" },
  { owner: "c", repo: "three", category: "Workspaces & GUIs" },
  { owner: "d", repo: "four", category: "Memory & Context" },
];
const stories = [{ id: "s1" }, { id: "s2" }, { id: "s3" }, { id: "s4" }];
const catalog = { repos, stories };

const validUseCase = {
  slug: "example-outcome",
  title: "An example outcome",
  intent: "I want to build an example",
  aliases: ["example", "sample outcome"],
  storyCategories: ["dev-workflow"],
  stack: [
    { owner: "a", repo: "one", role: "Memory", why: "Because." },
    { owner: "b", repo: "two", role: "Host", why: "Because." },
    { owner: "c", repo: "three", role: "UI", why: "Because." },
  ],
  rationale: "Why this combination, in this order.",
  caveats: ["A caveat."],
  gaps: [],
  evidence: ["s1", "s2", "s3"],
};

// Most cases only need >= MIN_USE_CASES to be satisfied; pad with slug/alias
// variants so the count check doesn't drown the assertion under test.
function pad(useCase, extra = {}) {
  const filler = Array.from({ length: MIN_USE_CASES }, (_, i) => ({
    ...validUseCase,
    slug: `filler-${i}`,
    aliases: [`filler alias ${i}`],
  }));
  return [{ ...validUseCase, ...extra }, ...filler];
}

// ── validate-use-cases ────────────────────────────────────────────────────

test("accepts a well-formed use case", () => {
  assert.deepEqual(validateUseCases(pad(validUseCase), catalog), []);
});

test("rejects a repo that is not in the Atlas catalog (issue #321 acceptance criterion)", () => {
  const errors = validateUseCases(
    pad(validUseCase, {
      stack: [...validUseCase.stack, { owner: "zzz", repo: "not-in-atlas", role: "R", why: "W." }],
    }),
    catalog
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0], /zzz\/not-in-atlas is not in data\/repos\.json/);
});

test("rejects a stack that does not span enough catalog categories", () => {
  // a/one and d/four are both Memory & Context — one category, so this is a
  // /lists/ page rather than a cross-category bundle.
  const errors = validateUseCases(
    pad(validUseCase, {
      stack: [
        { owner: "a", repo: "one", role: "R", why: "W." },
        { owner: "d", repo: "four", role: "R", why: "W." },
        { owner: "a", repo: "one", role: "R", why: "W." },
      ],
    }),
    catalog
  );
  assert.ok(errors.some((e) => /duplicate repo within stack/.test(e)));
  assert.ok(
    errors.some((e) => new RegExp(`spans only 1 catalog category.*at least ${MIN_STACK_CATEGORIES}`).test(e))
  );
});

test("rejects an evidence id that is not in the story corpus", () => {
  const errors = validateUseCases(
    pad(validUseCase, { evidence: ["s1", "s2", "ghost-story"] }),
    catalog
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0], /evidence id "ghost-story" not found in data\/user-stories\.json/);
});

test("rejects an alias claimed by two different use cases", () => {
  const other = { ...validUseCase, slug: "other-outcome", aliases: ["example"] };
  const errors = validateUseCases([validUseCase, other, ...pad(validUseCase).slice(1)], catalog);
  assert.ok(errors.some((e) => /alias "example" also claimed by \[example-outcome\]/.test(e)));
});

test("rejects duplicate slugs and non-kebab slugs", () => {
  const errors = validateUseCases(
    [validUseCase, { ...validUseCase, aliases: ["unique alias"] }, ...pad(validUseCase).slice(1)],
    catalog
  );
  assert.ok(errors.some((e) => /duplicate slug/.test(e)));

  const bad = validateUseCases(pad(validUseCase, { slug: "Not Kebab" }), catalog);
  assert.ok(bad.some((e) => /kebab-case/.test(e)));
});

test("requires the minimum number of use cases", () => {
  const errors = validateUseCases([validUseCase], catalog);
  assert.ok(errors.some((e) => new RegExp(`at least ${MIN_USE_CASES}`).test(e)));
});

// ── sync-user-stories ─────────────────────────────────────────────────────

test("story corpus validation catches duplicate ids and non-http urls", () => {
  const errors = validateStories([
    { id: "x", source: "x", url: "https://example.com/a", category: "c", headline: "h" },
    { id: "x", source: "x", url: "ftp://example.com/b", category: "c", headline: "h" },
  ]);
  assert.ok(errors.some((e) => /duplicate story id: x/.test(e)));
  assert.ok(errors.some((e) => /url must be http\(s\)/.test(e)));
});

test("diffStoryIds reports added and removed ids", () => {
  const { added, removed } = diffStoryIds([{ id: "a" }, { id: "b" }], [{ id: "b" }, { id: "c" }]);
  assert.deepEqual(added, ["c"]);
  assert.deepEqual(removed, ["a"]);
});

test("refuses to overwrite the corpus on a large upstream shrink", () => {
  const previous = { stories: Array.from({ length: 100 }, (_, i) => ({ id: `s${i}` })) };
  assert.throws(
    () => assertNoSuspiciousShrink(previous, Array.from({ length: 50 }, (_, i) => ({ id: `s${i}` }))),
    /dropped from 100 to 50/
  );
  // A small, plausible edit is allowed through.
  assert.doesNotThrow(() =>
    assertNoSuspiciousShrink(previous, Array.from({ length: 95 }, (_, i) => ({ id: `s${i}` })))
  );
});

// ── committed data ────────────────────────────────────────────────────────

test("committed data/use-cases.json passes validation against committed data", () => {
  const corpus = readJson("data/user-stories.json");
  const errors = validateUseCases(readJson("data/use-cases.json"), {
    repos: readJson("data/repos.json"),
    stories: corpus.stories,
  });
  assert.deepEqual(errors, []);
});

test("committed corpus carries its provenance", () => {
  const corpus = readJson("data/user-stories.json");
  assert.match(corpus.source, /^https:\/\/github\.com\/NousResearch\/hermes-agent/);
  assert.match(corpus.license, /MIT/);
  assert.match(corpus.fetchedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(corpus.count, corpus.stories.length);
});

// build-pages emits use-cases/ and both data files are inputs the build reads;
// stage-build-artifacts fails loudly on anything left unstaged, so a missing
// manifest entry breaks CI rather than silently dropping the pages.
test("use-case artifacts are registered in the staging manifest", () => {
  for (const p of ["use-cases/", "data/use-cases.json", "data/user-stories.json"]) {
    assert.ok(
      GENERATED_ARTIFACT_PATHS.includes(p),
      `${p} must be in GENERATED_ARTIFACT_PATHS`
    );
  }
});
