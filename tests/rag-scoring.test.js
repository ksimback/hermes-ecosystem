import test from "node:test";
import assert from "node:assert/strict";

import {
  classifyChunkSource,
  querySourceAdjustment,
  combinedRetrievalScore,
} from "../lib/rag-scoring.js";

test("classifies official docs, generated catalog docs, and curated Atlas sources", () => {
  assert.equal(classifyChunkSource({ source: "research/docs/user-guide/skills.md" }).authority, "official_docs");
  assert.equal(classifyChunkSource({ source: "research/docs/skills/index.md" }).contentKind, "catalog");
  assert.equal(classifyChunkSource({ source: "research/atlas-official-docs-updates.md" }).authority, "curated_atlas");
  assert.equal(classifyChunkSource({ source: "repos/all-star-counts.md" }).contentKind, "repo_metadata");
  // Use-case bundles are gated, hand-curated editorial — same tier as research/,
  // not the "community" default they'd otherwise fall through to.
  assert.equal(classifyChunkSource({ source: "use-cases/obsidian-second-brain/" }).authority, "curated_atlas");
});

test("official feature docs outrank equally relevant community chunks", () => {
  const official = { source: "research/docs/user-guide/tui.md", text: "TUI session orchestrator lets you switch sessions" };
  const community = { source: "research/community-note.md", text: "TUI session orchestrator lets you switch sessions" };

  const officialScore = combinedRetrievalScore({ query: "Can Hermes switch TUI sessions?", chunk: official, normCosine: 0.5, normBM25: 0.5 });
  const communityScore = combinedRetrievalScore({ query: "Can Hermes switch TUI sessions?", chunk: community, normCosine: 0.5, normBM25: 0.5 });

  assert.ok(officialScore > communityScore, `${officialScore} should beat ${communityScore}`);
});

test("skills catalog pages are penalized for broad questions but boosted for skills catalog questions", () => {
  const catalog = { source: "research/docs/skills/index.md", text: "Skills Hub source pills include OpenAI, HuggingFace, ClawHub, browse.sh, skills.sh" };

  assert.ok(querySourceAdjustment("What is Hermes Agent?", catalog) < 0);
  assert.ok(querySourceAdjustment("Which sources are in the Skills Hub catalog?", catalog) > 0);
});

test("official docs beat a near-exact curated title match on how-to queries (#399)", () => {
  // The concrete #399 case: "How do I connect Hermes to Telegram?" — the
  // curated write-up's title nearly equals the query, giving it the top BM25
  // score (norm 1.0), while the official doc scores lower on keywords.
  // Official docs must still win on operational intent.
  const official = { source: "research/docs/user-guide/messaging/telegram.md", text: "Telegram: pair the bot, then message it" };
  const curated = { source: "research/29-How-to-Set-Up-Hermes-on-Telegram.md", text: "How to Set Up Hermes on Telegram" };
  const query = "How do I connect Hermes to Telegram?";

  const officialScore = combinedRetrievalScore({ query, chunk: official, normCosine: 0.8, normBM25: 0.75 });
  const curatedScore = combinedRetrievalScore({ query, chunk: curated, normCosine: 0.8, normBM25: 1.0 });

  assert.ok(officialScore > curatedScore, `official ${officialScore} should beat curated ${curatedScore}`);
});

test("curated content keeps winning on non-operational queries despite the how-to boost (#399)", () => {
  // Same chunks and retrieval scores, but the query has no operational intent
  // — the curated piece with the stronger keyword match should stay on top.
  const official = { source: "research/docs/user-guide/messaging/telegram.md", text: "Telegram: pair the bot, then message it" };
  const curated = { source: "research/29-How-to-Set-Up-Hermes-on-Telegram.md", text: "How to Set Up Hermes on Telegram" };
  const query = "hermes telegram community guide";

  const officialScore = combinedRetrievalScore({ query, chunk: official, normCosine: 0.8, normBM25: 0.75 });
  const curatedScore = combinedRetrievalScore({ query, chunk: curated, normCosine: 0.8, normBM25: 1.0 });

  assert.ok(curatedScore > officialScore, `curated ${curatedScore} should beat official ${officialScore}`);
});

test("clearly more relevant curated content still beats official docs on how-to queries (#399)", () => {
  // Guard against over-boosting: when the curated chunk is semantically much
  // closer to the query (cosine edge ≥ ~0.15), authority must not override it.
  const official = { source: "research/docs/user-guide/configuration.md", text: "General configuration reference" };
  const curated = { source: "research/31-Hermes-Trading-Bot-Walkthrough.md", text: "Step-by-step trading bot walkthrough with Hermes" };
  const query = "how do I use hermes to build a trading bot?";

  const officialScore = combinedRetrievalScore({ query, chunk: official, normCosine: 0.5, normBM25: 0.5 });
  const curatedScore = combinedRetrievalScore({ query, chunk: curated, normCosine: 0.75, normBM25: 0.7 });

  assert.ok(curatedScore > officialScore, `curated ${curatedScore} should beat official ${officialScore}`);
});

test("TUI session docs get a query-sensitive feature boost", () => {
  const tui = { source: "research/docs/user-guide/tui.md", text: "active-session orchestrator list activate close launch sessions" };
  const unrelated = { source: "research/docs/user-guide/voice.md", text: "voice calls and audio output" };

  const tuiScore = combinedRetrievalScore({ query: "How do I launch and switch TUI sessions?", chunk: tui, normCosine: 0.4, normBM25: 0.4 });
  const unrelatedScore = combinedRetrievalScore({ query: "How do I launch and switch TUI sessions?", chunk: unrelated, normCosine: 0.4, normBM25: 0.4 });

  assert.ok(tuiScore > unrelatedScore, `${tuiScore} should beat ${unrelatedScore}`);
});
