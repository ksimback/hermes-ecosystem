// Markdown → RAG chunk splitting, extracted from scripts/build-chunks.js so it
// can be unit-tested (build-chunks.js exits at import time without an API key).
//
// Default behavior must stay byte-identical to the historical splitter: the
// embedding cache in build-chunks.js is keyed on chunk text, so any change to
// how non-reference sources chunk forces a full re-embed of the corpus.

import { enrichChunkMetadata } from "./rag-scoring.js";

export const CHUNK_SIZE = 500; // target tokens (~4 chars per token)
export const CHUNK_CHARS = CHUNK_SIZE * 4;
export const OVERLAP_CHARS = 200;
// Hard ceiling per chunk — text-embedding-3-small caps input at 8192 tokens
// (~32k chars). The paragraph splitter doesn't break inside a single paragraph,
// so a wall-of-links page (e.g. user-stories) can otherwise produce a 30k+
// char chunk that crashes the embedding call.
export const MAX_CHUNK_CHARS = 6000;

// Large reference docs (issue #400): cli-commands.md and friends pack many
// narrow topics into big ## sections, so retrieval finds the right doc but the
// specific answer sits deep inside a ~2000-char chunk. Reference sources get a
// finer target size and ### subsection splitting so narrow topics surface as
// their own chunks. Scoped to reference/ (294 of ~6.8k chunks, ~3 MB of
// chunks.json) so the rest of the corpus keeps its cached embeddings and
// chunks.json stays far from GitHub's 100 MB limit.
const REFERENCE_PREFIX = "research/docs/reference/";
export const REFERENCE_CHUNK_CHARS = 1200;

export function chunkOptionsFor(source) {
  if (String(source || "").startsWith(REFERENCE_PREFIX)) {
    return { chunkChars: REFERENCE_CHUNK_CHARS, splitSubsections: true };
  }
  return { chunkChars: CHUNK_CHARS, splitSubsections: false };
}

export function chunkText(text, source) {
  const { chunkChars, splitSubsections } = chunkOptionsFor(source);
  const chunks = [];

  // Normalize CRLF: the paragraph splitter below matches /\n\n+/, which never
  // fires on \r\n\r\n — on a Windows checkout that silently disables paragraph
  // splitting and produces completely different chunks than CI. No-op on the
  // LF checkouts CI uses, so cached embeddings are unaffected.
  text = text.replace(/\r\n/g, "\n");

  // Split by sections (## headings)
  const sections = text.split(/(?=^## )/m);

  for (const section of sections) {
    const headingMatch = section.match(/^## (.+)/);
    const heading = headingMatch ? headingMatch[1].trim() : "";

    // Reference docs: split oversized sections at ### subheadings first, so
    // each narrow topic ("hermes webhook subscribe", "Global options") becomes
    // its own chunk with a precise section label.
    if (splitSubsections && section.length > chunkChars && /^### /m.test(section)) {
      for (const sub of section.split(/(?=^### )/m)) {
        const subMatch = sub.match(/^### (.+)/);
        const subHeading = subMatch
          ? (heading ? `${heading} › ${subMatch[1].trim()}` : subMatch[1].trim())
          : heading;
        chunkPiece(chunks, source, subHeading, sub, chunkChars);
      }
      continue;
    }

    chunkPiece(chunks, source, heading, section, chunkChars);
  }

  return chunks;
}

// Mirrors the historical splitter exactly: a piece within the target size is
// one chunk; an oversized piece is accumulated paragraph-by-paragraph with an
// OVERLAP_CHARS tail carried between chunks.
function chunkPiece(chunks, source, heading, piece, chunkChars) {
  if (piece.length <= chunkChars) {
    pushChunk(chunks, source, heading, piece);
    return;
  }

  const paragraphs = piece.split(/\n\n+/);
  let current = "";

  for (const para of paragraphs) {
    if ((current + "\n\n" + para).length > chunkChars && current.length > 50) {
      pushChunk(chunks, source, heading, current);
      // Overlap: keep last portion
      current = current.slice(-OVERLAP_CHARS) + "\n\n" + para;
    } else {
      current = current ? current + "\n\n" + para : para;
    }
  }

  pushChunk(chunks, source, heading, current);
}

function pushChunk(chunks, source, heading, text) {
  const trimmed = text.trim();
  if (trimmed.length <= 50) return;
  // Hard-split anything still oversized after paragraph splitting (mega
  // paragraphs with no blank lines, e.g. wall-of-links pages).
  for (const piece of hardSplitByLines(trimmed, MAX_CHUNK_CHARS)) {
    chunks.push(enrichChunkMetadata({
      id: `${source}:${chunks.length}`,
      text: piece.trim(),
      source,
      section: heading,
    }));
  }
}

export function hardSplitByLines(text, maxChars) {
  if (text.length <= maxChars) return [text];
  const pieces = [];
  let i = 0;
  while (i < text.length) {
    let end = Math.min(i + maxChars, text.length);
    if (end < text.length) {
      // Prefer a line-break boundary in the back half of the window
      const nl = text.lastIndexOf("\n", end);
      if (nl > i + maxChars / 2) end = nl;
    }
    pieces.push(text.slice(i, end));
    i = end;
  }
  return pieces;
}
