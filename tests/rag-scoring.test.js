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

test("TUI session docs get a query-sensitive feature boost", () => {
  const tui = { source: "research/docs/user-guide/tui.md", text: "active-session orchestrator list activate close launch sessions" };
  const unrelated = { source: "research/docs/user-guide/voice.md", text: "voice calls and audio output" };

  const tuiScore = combinedRetrievalScore({ query: "How do I launch and switch TUI sessions?", chunk: tui, normCosine: 0.4, normBM25: 0.4 });
  const unrelatedScore = combinedRetrievalScore({ query: "How do I launch and switch TUI sessions?", chunk: unrelated, normCosine: 0.4, normBM25: 0.4 });

  assert.ok(tuiScore > unrelatedScore, `${tuiScore} should beat ${unrelatedScore}`);
});
