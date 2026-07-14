import test from "node:test";
import assert from "node:assert/strict";
import { mapWithConcurrency } from "../lib/bounded-concurrency.js";

test("mapWithConcurrency processes every item without exceeding its cap", async () => {
  let active = 0;
  let peak = 0;
  const completed = [];
  await mapWithConcurrency([0, 1, 2, 3, 4, 5, 6], 3, async (item) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    completed.push(item);
    active -= 1;
  });
  assert.equal(peak, 3);
  assert.deepEqual(completed.sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6]);
});

test("mapWithConcurrency rejects invalid limits", async () => {
  await assert.rejects(mapWithConcurrency([1], 0, async () => {}), /positive integer/);
});
