import test from "node:test";
import assert from "node:assert/strict";
import {
  LIST_CHUNK_SIZE,
  chunkList,
  mergeEntryMaps,
  findMissingEntries,
} from "../lib/list-summary-batching.js";

test("chunkList splits into chunks of at most the given size", () => {
  const items = Array.from({ length: 34 }, (_, i) => i);
  const chunks = chunkList(items, 12);
  assert.equal(chunks.length, 3);
  assert.deepEqual(chunks.map((c) => c.length), [12, 12, 10]);
  // Order preserved and no items dropped or duplicated.
  assert.deepEqual(chunks.flat(), items);
});

test("chunkList handles exact multiples, remainder, empty, and small inputs", () => {
  assert.deepEqual(chunkList([1, 2, 3, 4], 2).map((c) => c.length), [2, 2]);
  assert.deepEqual(chunkList([1, 2, 3], 12).map((c) => c.length), [3]);
  assert.deepEqual(chunkList([], 12), []);
  assert.equal(LIST_CHUNK_SIZE, 12);
});

test("chunkList does not mutate its input and rejects bad args", () => {
  const input = [1, 2, 3];
  chunkList(input, 2);
  assert.deepEqual(input, [1, 2, 3]);
  assert.throws(() => chunkList("nope", 12), TypeError);
  assert.throws(() => chunkList([1, 2], 0), RangeError);
  assert.throws(() => chunkList([1, 2], 1.5), RangeError);
});

test("mergeEntryMaps merges disjoint chunk objects into one map", () => {
  const merged = mergeEntryMaps([
    { "a/one": "desc one", "a/two": "desc two" },
    { "b/three": "desc three" },
    {},
  ]);
  assert.deepEqual(merged, {
    "a/one": "desc one",
    "a/two": "desc two",
    "b/three": "desc three",
  });
});

test("mergeEntryMaps fails loud on a non-object chunk response", () => {
  assert.throws(() => mergeEntryMaps([{ "a/one": "x" }, null]), /JSON object/);
  assert.throws(() => mergeEntryMaps([["a/one", "x"]]), /JSON object/);
  assert.throws(() => mergeEntryMaps("nope"), TypeError);
});

test("findMissingEntries flags members lacking a usable description", () => {
  const members = new Set(["a/one", "a/two", "a/three"]);
  const entries = {
    "a/one": "A complete description.",
    "a/two": "   ", // whitespace only -> missing
    // a/three absent entirely -> missing
  };
  assert.deepEqual(findMissingEntries(entries, members), ["a/two", "a/three"]);
  // All present -> empty.
  assert.deepEqual(
    findMissingEntries(
      { "a/one": "x", "a/two": "y", "a/three": "z" },
      members,
    ),
    [],
  );
  // Accepts an array of keys too.
  assert.deepEqual(findMissingEntries({}, ["a/one"]), ["a/one"]);
});
