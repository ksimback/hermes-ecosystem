import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  matchUseCases,
  inferCategory,
  buildUseCaseBlock,
  matchesTerm,
  wordsOf,
  terms,
} from "../lib/use-case-match.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
const useCases = readJson("data/use-cases.json");
const repos = readJson("data/repos.json");
const repoIndex = new Map(repos.map((r) => [`${r.owner}/${r.repo}`, r]));

// ── tokenization ──

test("stop words are dropped so filler doesn't inflate scores", () => {
  assert.deepEqual(terms("I want to build a telegram bot"), ["telegram", "bot"]);
  // Every word being filler must produce no terms rather than matching everything.
  assert.deepEqual(terms("what should I use"), []);
});

test("short terms match only whole words; long terms may prefix-match", () => {
  const words = wordsOf("local models and deployment options");
  assert.equal(matchesTerm(words, "mod"), false, '"mod" must not match "models"');
  assert.equal(matchesTerm(words, "models"), true);
  assert.equal(matchesTerm(words, "deploy"), true, '"deploy" prefix-matches "deployment"');
  assert.equal(matchesTerm(words, "deployments"), true, "stem match works in reverse too");
});

// ── bundle matching against the real committed data ──

const EXPECTED = [
  ["I want to build a telegram bot I can use from my phone", "hermes-in-your-pocket"],
  ["my agent keeps forgetting things between sessions", "obsidian-second-brain"],
  ["how do I see what my agents are doing", "see-what-your-agent-is-doing"],
  ["I want to run local models with no cloud", "fully-self-hosted-private-stack"],
  ["cut my token spend", "cut-your-token-bill"],
];

for (const [query, slug] of EXPECTED) {
  test(`"${query}" matches ${slug}`, () => {
    const matches = matchUseCases(query, useCases);
    assert.ok(matches.length > 0, "expected at least one match");
    assert.equal(matches[0].useCase.slug, slug);
  });
}

test("an off-topic query matches nothing rather than guessing", () => {
  assert.deepEqual(matchUseCases("minecraft mod for my server", useCases), []);
  assert.deepEqual(matchUseCases("what is hermes agent", useCases), []);
});

test("a single term carries a match only when it is a curated alias", () => {
  const bundles = [
    {
      slug: "alpha",
      title: "Alpha",
      intent: "do alpha things",
      // "server" is rare across the set but buried inside a longer alias;
      // "telegram" is an alias in its own right.
      aliases: ["home server agent", "telegram"],
      stack: [],
    },
    { slug: "beta", title: "Beta", intent: "do beta things", aliases: ["kubernetes"], stack: [] },
  ];

  assert.equal(matchUseCases("minecraft mod for my server", bundles).length, 0);
  assert.equal(matchUseCases("telegram", bundles)[0]?.useCase.slug, "alpha");

  // An alias shared by two bundles is no longer distinctive, so one hit
  // isn't enough for either.
  const shared = bundles.map((b) => ({ ...b, aliases: [...b.aliases, "telegram"] }));
  assert.equal(matchUseCases("telegram", shared).length, 0);
});

test("matches are capped and ordered by score", () => {
  const matches = matchUseCases("I want a self-hosted local memory stack for my team", useCases, {
    limit: 2,
  });
  assert.ok(matches.length <= 2);
  for (let i = 1; i < matches.length; i++) {
    assert.ok(matches[i - 1].score >= matches[i].score, "scores must be descending");
  }
});

// ── category inference ──

test("infers a category only when exactly one signal group matches", () => {
  assert.equal(inferCategory("which memory provider should I use"), "Memory & Context");
  assert.equal(inferCategory("best telegram bridge"), "Integrations & Bridges");
  assert.equal(inferCategory("compare deployment options"), "Deployment & Infra");
});

test("ambiguous or absent signals fall back to null (full catalog)", () => {
  // Two categories in play — narrowing either way would starve the answer.
  assert.equal(inferCategory("compare memory plugins"), null);
  assert.equal(inferCategory("what are the most starred repos"), null);
  assert.equal(inferCategory(""), null);
});

test("inferred categories are real catalog categories", () => {
  const known = new Set(repos.map((r) => r.category));
  for (const q of ["memory", "telegram", "kubernetes", "skills", "plugins", "guides"]) {
    const inferred = inferCategory(q);
    if (inferred) assert.ok(known.has(inferred), `${inferred} must exist in repos.json`);
  }
});

// ── prompt block ──

test("bundle block carries stars, categories and the Atlas URL", () => {
  const matches = matchUseCases("telegram on my phone", useCases);
  const block = buildUseCaseBlock(matches, repoIndex);
  assert.match(block, /## USE-CASE BUNDLES/);
  assert.match(block, /https:\/\/hermesatlas\.com\/use-cases\/hermes-in-your-pocket/);
  assert.match(block, /★ \d+/, "star counts must survive into the prompt");
  assert.match(block, /\[Workspaces & GUIs\]/);
});

test("no matches produces an empty block, not a header", () => {
  assert.equal(buildUseCaseBlock([], repoIndex), "");
  assert.equal(buildUseCaseBlock(null, repoIndex), "");
});

test("a bundle block is dramatically cheaper than the full catalog dump", () => {
  const matches = matchUseCases("I want to build a telegram bot on my phone", useCases);
  const block = buildUseCaseBlock(matches, repoIndex);
  // The full catalog dump is ~31.8k chars; a matched bundle must stay far under
  // it or the whole point of this path is lost.
  assert.ok(block.length < 4000, `bundle block was ${block.length} chars`);
});
