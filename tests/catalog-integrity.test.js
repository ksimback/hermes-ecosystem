import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "fs/promises";

async function json(path) {
  return JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
}

test("project and list summaries cannot retain repos removed from the catalog", async () => {
  const [repos, lists, summaries, listSummaries] = await Promise.all([
    json("../data/repos.json"),
    json("../data/lists.json"),
    json("../data/summaries.json"),
    json("../data/list-summaries.json"),
  ]);
  const catalogKeys = new Set(repos.map((repo) => `${repo.owner}/${repo.repo}`));
  const orphanedSummaries = Object.keys(summaries).filter((key) => !catalogKeys.has(key));
  assert.deepEqual(orphanedSummaries, []);

  for (const list of lists) {
    if (list.summaries === false) {
      assert.deepEqual(
        Object.keys(listSummaries[list.slug]?.entries || {}),
        [],
        `${list.slug} disables per-project summaries`,
      );
      continue;
    }
    const members = new Set(
      repos
        .filter((repo) => !list.filter?.category || repo.category === list.filter.category)
        .map((repo) => `${repo.owner}/${repo.repo}`),
    );
    const entries = Object.keys(listSummaries[list.slug]?.entries || {});
    assert.deepEqual(
      entries.filter((key) => !members.has(key)),
      [],
      `${list.slug} contains an orphaned list summary`,
    );
  }
});
