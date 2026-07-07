import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  loadChunkStore,
  writeChunkStore,
  META_FILENAME,
  EMBEDDINGS_FILENAME,
} from "../lib/chunk-store.js";

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "chunk-store-"));
}

const MODEL = "openai/text-embedding-3-small";

function sampleChunks(dims) {
  return [
    {
      id: "a-0",
      text: "alpha chunk",
      source: "research/a.md",
      section: "Intro",
      metadata: { authority: "official_docs" },
      embedding: Array.from({ length: dims }, (_, i) => Math.sin(i + 1)),
    },
    {
      id: "b-0",
      text: "beta chunk",
      source: "repos/b.md",
      section: null,
      metadata: {},
      embedding: Array.from({ length: dims }, (_, i) => Math.cos(i + 1)),
    },
  ];
}

test("write → load round-trips chunks, model, dims, and embeddings", () => {
  const dir = tmpDir();
  const dims = 8;
  const chunks = sampleChunks(dims);

  writeChunkStore(dir, chunks, { model: MODEL, dimensions: dims });
  const store = loadChunkStore(dir);

  assert.equal(store.model, MODEL);
  assert.equal(store.dimensions, dims);
  assert.equal(store.count, 2);
  assert.equal(store.chunks.length, 2);

  // Non-embedding fields survive untouched
  const { embedding: _e0, ...restIn } = chunks[0];
  const { embedding: loaded0, ...restOut } = store.chunks[0];
  assert.deepEqual(restOut, restIn);

  // Embeddings come back as Float32Array views with float32-rounded values
  assert.ok(loaded0 instanceof Float32Array);
  assert.equal(loaded0.length, dims);
  for (let i = 0; i < dims; i++) {
    assert.equal(loaded0[i], Math.fround(chunks[0].embedding[i]));
  }
});

test("float32 values are byte-stable across a second write (cache round-trip)", () => {
  const dir = tmpDir();
  const dims = 8;
  writeChunkStore(dir, sampleChunks(dims), { model: MODEL, dimensions: dims });
  const first = loadChunkStore(dir);

  // Re-write using loaded Float32Array views as the embeddings, as
  // build-chunks.js does on a full cache hit.
  writeChunkStore(dir, first.chunks, { model: MODEL, dimensions: dims });
  const second = fs.readFileSync(path.join(dir, EMBEDDINGS_FILENAME));

  const expected = Buffer.alloc(second.length);
  for (let i = 0; i < first.count; i++) {
    Buffer.from(first.chunks[i].embedding.buffer, first.chunks[i].embedding.byteOffset, dims * 4)
      .copy(expected, i * dims * 4);
  }
  assert.deepEqual(second, expected);
});

test("loader fails loud when meta and bin disagree on size", () => {
  const dir = tmpDir();
  const dims = 8;
  writeChunkStore(dir, sampleChunks(dims), { model: MODEL, dimensions: dims });

  // Truncate the bin — simulates a torn commit (one file updated, not the other)
  const binPath = path.join(dir, EMBEDDINGS_FILENAME);
  fs.writeFileSync(binPath, fs.readFileSync(binPath).subarray(0, dims * 4));

  assert.throws(() => loadChunkStore(dir), /out of sync/);
});

test("writer rejects a chunk with wrong embedding dims", () => {
  const dir = tmpDir();
  const chunks = sampleChunks(8);
  chunks[1].embedding = chunks[1].embedding.slice(0, 4);
  assert.throws(() => writeChunkStore(dir, chunks, { model: MODEL, dimensions: 8 }), /dims/);
});

test("loader fails loud on malformed meta", () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, META_FILENAME), JSON.stringify({ chunks: "nope" }));
  fs.writeFileSync(path.join(dir, EMBEDDINGS_FILENAME), Buffer.alloc(0));
  assert.throws(() => loadChunkStore(dir), /Malformed/);
});
