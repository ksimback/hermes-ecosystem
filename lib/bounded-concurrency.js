export async function mapWithConcurrency(items, limit, mapper) {
  if (!Array.isArray(items)) throw new TypeError("items must be an array");
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError("concurrency limit must be a positive integer");
  }
  let nextIndex = 0;
  const workerCount = Math.min(limit, items.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
}
