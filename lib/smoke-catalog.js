/**
 * What a deployment's catalog artifacts (llms.txt count, /ecosystem/ category
 * counts) should say, given this checkout's data/repos.json.
 *
 * In --preview mode the deployment is a PR head whose pages may not be rebuilt
 * yet: data-only catalog PRs are the normal path, and the post-merge build
 * generates their pages (#958). Such a deployment still renders the catalog as
 * of its last build, so:
 *
 *   pending additions — entries whose projects/<owner>/<repo>.html is not on
 *                       disk yet; not rendered, so not counted
 *   pending removals  — project pages still on disk for entries the checkout
 *                       removed; still rendered, so counted, in the category
 *                       whose /ecosystem/ section links to them
 *
 * Outside preview mode both sets are empty and this is a plain count of
 * repos.json, so production checks are unchanged.
 */
export function expectedCatalogCounts({ repos, pendingPaths = new Set(), removals = [] }) {
  const byCat = new Map();
  let total = 0;
  for (const repo of repos) {
    if (pendingPaths.has(`/projects/${repo.owner}/${repo.repo}`)) continue;
    const cat = repo.category || "(uncategorized)";
    byCat.set(cat, (byCat.get(cat) || 0) + 1);
    total++;
  }
  for (const removal of removals) {
    total++;
    if (removal.category) byCat.set(removal.category, (byCat.get(removal.category) || 0) + 1);
  }
  return { total, byCat };
}

/** Project page paths on disk that have no repos.json entry. */
export function findPendingRemovals(pagePaths, repos) {
  const live = new Set(repos.map((r) => `/projects/${r.owner}/${r.repo}`.toLowerCase()));
  return pagePaths.filter((p) => !live.has(p.toLowerCase()));
}
