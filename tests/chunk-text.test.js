import test from "node:test";
import assert from "node:assert/strict";

import {
  chunkText,
  chunkOptionsFor,
  CHUNK_CHARS,
  REFERENCE_CHUNK_CHARS,
} from "../lib/chunk-text.js";

const REF_SOURCE = "research/docs/reference/cli-commands.md";
const NON_REF_SOURCE = "research/docs/user-guide/configuration.md";

function para(seed, chars) {
  return `${seed} ${"lorem ipsum dolor sit amet ".repeat(Math.ceil(chars / 27))}`.slice(0, chars);
}

test("chunkOptionsFor scopes finer chunking to reference docs only (#400)", () => {
  assert.deepEqual(chunkOptionsFor(REF_SOURCE), {
    chunkChars: REFERENCE_CHUNK_CHARS,
    splitSubsections: true,
  });
  assert.deepEqual(chunkOptionsFor(NON_REF_SOURCE), {
    chunkChars: CHUNK_CHARS,
    splitSubsections: false,
  });
  assert.deepEqual(chunkOptionsFor("repos/all-star-counts.md"), {
    chunkChars: CHUNK_CHARS,
    splitSubsections: false,
  });
});

test("non-reference docs keep historical behavior: small section is one chunk, big section splits by paragraph", () => {
  const small = `## Small section\n\n${para("intro", 300)}\n`;
  assert.equal(chunkText(small, NON_REF_SOURCE).length, 1);

  const big = `## Big section\n\n${para("a", 900)}\n\n${para("b", 900)}\n\n${para("c", 900)}\n`;
  const chunks = chunkText(big, NON_REF_SOURCE);
  assert.ok(chunks.length > 1, "oversized section should paragraph-split");
  for (const c of chunks) assert.equal(c.section, "Big section");
});

test("a mid-size non-reference section stays whole even above the reference target", () => {
  // 1500 chars: above REFERENCE_CHUNK_CHARS (1200), below CHUNK_CHARS (2000).
  // Non-reference sources must NOT pick up the finer target.
  const doc = `## Mid section\n\n${para("a", 700)}\n\n${para("b", 700)}\n`;
  assert.equal(chunkText(doc, NON_REF_SOURCE).length, 1);
  assert.ok(chunkText(doc, REF_SOURCE).length > 1, "same doc as reference source should split");
});

test("reference docs split oversized sections at ### subheadings with combined labels (#400)", () => {
  const doc = [
    "## `hermes webhook`",
    "",
    para("webhook intro", 600),
    "",
    "### `hermes webhook subscribe`",
    "",
    para("subscribe details", 600),
    "",
    "### `hermes webhook list`",
    "",
    para("list details", 600),
    "",
  ].join("\n");

  const chunks = chunkText(doc, REF_SOURCE);
  const sections = chunks.map((c) => c.section);
  assert.ok(sections.includes("`hermes webhook`"), `preamble keeps H2 label, got ${sections}`);
  assert.ok(sections.includes("`hermes webhook` › `hermes webhook subscribe`"), `H3 gets combined label, got ${sections}`);
  assert.ok(sections.includes("`hermes webhook` › `hermes webhook list`"), `H3 gets combined label, got ${sections}`);
});

test("non-reference docs do NOT split at ### even when oversized (scoping guard)", () => {
  const doc = [
    "## Guide section",
    "",
    para("intro", 900),
    "",
    "### Subtopic",
    "",
    para("subtopic body", 900),
    "",
  ].join("\n");

  const chunks = chunkText(doc, NON_REF_SOURCE);
  for (const c of chunks) {
    assert.equal(c.section, "Guide section", "### must not become a section label for non-reference sources");
  }
});

test("reference section without ### splits at the finer target so trailing topics lead their own chunk (#400)", () => {
  // Mirrors the #400 chronos case: a ~1300-char `hermes cron` section whose
  // answer paragraph sits at the end. At the 2000-char target it was one chunk
  // with the answer buried ~750 chars deep; at 1200 the answer paragraph
  // starts near the top of its own chunk.
  const doc = `## \`hermes cron\`\n\n${para("usage table", 700)}\n\n${"The cron trigger is pluggable via the cron.provider config key. " + para("chronos details", 500)}\n`;

  const chunks = chunkText(doc, REF_SOURCE);
  assert.ok(chunks.length > 1, "section above the reference target should split");
  const answer = chunks.find((c) => c.text.includes("cron.provider"));
  assert.ok(answer, "answer paragraph must survive chunking");
  const pos = answer.text.indexOf("cron.provider");
  assert.ok(pos < 300, `answer should sit near the top of its chunk, found at char ${pos}`);
});

test("CRLF input chunks identically to LF input", () => {
  const lf = `## Section\n\n${para("a", 900)}\n\n${para("b", 900)}\n\n${para("c", 900)}\n`;
  const crlf = lf.replace(/\n/g, "\r\n");

  const a = chunkText(lf, NON_REF_SOURCE);
  const b = chunkText(crlf, NON_REF_SOURCE);
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i++) assert.equal(a[i].text, b[i].text);
});
