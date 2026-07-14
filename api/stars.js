import { readFileSync } from "fs";
import { join } from "path";
import { fetchGitHubStars, validateStarSnapshot } from "../lib/github-stars.js";
import { kvGet, kvSet } from "../lib/redis.js";

export const STAR_KEYS = {
  current: "stars:current",
  lastGood: "stars:last-good",
};
export const CACHE_TTL_SECONDS = 8 * 60 * 60;
const HISTORY_TTL_SECONDS = 366 * 24 * 60 * 60;

let reposCache;
function loadRepos() {
  if (reposCache) return reposCache;
  reposCache = JSON.parse(readFileSync(join(process.cwd(), "data", "repos.json"), "utf8"));
  return reposCache;
}

let latestReleaseCache;
function loadLatestRelease() {
  if (latestReleaseCache !== undefined) return latestReleaseCache;
  try {
    const release = JSON.parse(
      readFileSync(join(process.cwd(), "data", "latest-release.json"), "utf8"),
    );
    latestReleaseCache = release?.version
      ? {
          version: release.version,
          tag: release.tag,
          name: release.name,
          publishedAt: release.publishedAt,
        }
      : null;
  } catch (error) {
    console.error("Failed to load latest-release.json:", error.message);
    latestReleaseCache = null;
  }
  return latestReleaseCache;
}

function isAuthorized(req, env) {
  const expected = env.CRON_SECRET ? `Bearer ${env.CRON_SECRET}` : null;
  return Boolean(expected && req.headers.authorization === expected);
}

function wantsRefresh(req) {
  return req.query?.cron === "true" || req.query?.cron === "1";
}

function staticSnapshot(repoList) {
  return repoList.map((repo) => ({
    owner: repo.owner,
    repo: repo.repo,
    stars: repo.stars,
    updatedAt: null,
  }));
}

export function buildStarsResponse({
  starData,
  hermesRelease = null,
  atlasStars = null,
  fetchedAt = null,
  source,
  stale,
  degradedReason = null,
  complete = true,
  unavailableRepos = [],
}) {
  const repos = Object.fromEntries(
    starData.map((item) => [
      `${item.owner}/${item.repo}`,
      { stars: item.stars, updatedAt: item.updatedAt },
    ]),
  );
  return {
    source,
    stale,
    complete,
    unavailableRepos,
    fetchedAt,
    degradedReason:
      degradedReason ||
      (complete ? null : `${unavailableRepos.length} catalog repositories were unavailable`),
    repos,
    totals: {
      stars: starData.reduce((total, item) => total + item.stars, 0),
      count: starData.length,
      updated: fetchedAt,
    },
    hermes: hermesRelease,
    atlas: { stars: atlasStars },
  };
}

function storedResponseIsValid(value, repoList) {
  if (!value || typeof value !== "object" || !value.repos) return false;
  const starData = Object.entries(value.repos).map(([key, item]) => {
    const separator = key.indexOf("/");
    return {
      owner: key.slice(0, separator),
      repo: key.slice(separator + 1),
      stars: item?.stars,
      updatedAt: item?.updatedAt,
    };
  });
  try {
    validateStarSnapshot({
      starData,
      atlasStars: value.atlas?.stars,
      complete: value.complete,
      unavailableRepos: value.unavailableRepos,
    }, repoList);
    return Boolean(value.fetchedAt && !Number.isNaN(Date.parse(value.fetchedAt)));
  } catch {
    return false;
  }
}

function markFallback(value, reason) {
  return {
    ...value,
    source: "last-good",
    stale: true,
    degradedReason: reason,
  };
}

export function createStarsHandler({
  kvGetImpl = kvGet,
  kvSetImpl = kvSet,
  fetchImpl = fetch,
  loadReposImpl = loadRepos,
  loadLatestReleaseImpl = loadLatestRelease,
  env = process.env,
  now = () => new Date(),
} = {}) {
  async function persistSnapshot(repoList, snapshot, source) {
    const normalizedSnapshot = {
      ...snapshot,
      complete: snapshot.complete ?? (snapshot.unavailableRepos || []).length === 0,
      unavailableRepos: snapshot.unavailableRepos || [],
    };
    validateStarSnapshot(normalizedSnapshot, repoList);
    const fetchedAt = now().toISOString();
    const response = buildStarsResponse({
      ...normalizedSnapshot,
      hermesRelease: normalizedSnapshot.hermesRelease || loadLatestReleaseImpl(),
      fetchedAt,
      source,
      stale: false,
    });
    const history = {
      fetchedAt,
      data: Object.fromEntries(
        normalizedSnapshot.starData.map((item) => [`${item.owner}/${item.repo}`, item.stars]),
      ),
    };
    const historyKey = `stars:history:${fetchedAt.slice(0, 10)}`;
    const writes = await Promise.all([
      kvSetImpl(STAR_KEYS.current, response, { ex: CACHE_TTL_SECONDS }),
      kvSetImpl(STAR_KEYS.lastGood, response),
      kvSetImpl(historyKey, history, { ex: HISTORY_TTL_SECONDS }),
    ]);
    if (writes.some((written) => written !== true)) {
      throw new Error("Star snapshot persistence failed");
    }
    return response;
  }

  return async function starsHandler(req, res) {
    let repoList;
    try {
      repoList = loadReposImpl();
      if (!Array.isArray(repoList) || repoList.length === 0) {
        throw new Error("Repo list unavailable");
      }

      const refresh = wantsRefresh(req);
      if ((refresh || req.method === "POST") && !isAuthorized(req, env)) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (req.method === "POST") {
        if (!refresh) return res.status(400).json({ error: "Missing cron refresh flag" });
        const snapshot = req.body;
        if (!snapshot || typeof snapshot !== "object") {
          return res.status(400).json({ error: "Invalid star snapshot" });
        }
        const response = await persistSnapshot(repoList, snapshot, "github-actions");
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).json(response);
      }

      if (req.method && req.method !== "GET") {
        res.setHeader("Allow", "GET, POST");
        return res.status(405).json({ error: "Method not allowed" });
      }

      const cached = await kvGetImpl(STAR_KEYS.current);
      if (!refresh && storedResponseIsValid(cached, repoList)) {
        return res.status(200).json(cached);
      }

      if (env.GITHUB_TOKEN) {
        try {
          const snapshot = await fetchGitHubStars({
            repoList,
            token: env.GITHUB_TOKEN,
            fetchImpl,
          });
          const response = await persistSnapshot(repoList, snapshot, "github-api");
          return res.status(200).json(response);
        } catch (error) {
          console.error("Live star refresh failed:", error.message);
          if (refresh) {
            res.setHeader("Cache-Control", "no-store");
            return res.status(503).json({ error: "Star refresh failed", stale: true });
          }
        }
      } else if (refresh) {
        res.setHeader("Cache-Control", "no-store");
        return res.status(503).json({ error: "GitHub token unavailable", stale: true });
      }

      const lastGood = await kvGetImpl(STAR_KEYS.lastGood);
      if (storedResponseIsValid(lastGood, repoList)) {
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).json(markFallback(lastGood, "Live refresh unavailable"));
      }

      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json(
        buildStarsResponse({
          starData: staticSnapshot(repoList),
          hermesRelease: loadLatestReleaseImpl(),
          atlasStars:
            repoList.find(
              (repo) => repo.owner === "ksimback" && repo.repo === "hermes-ecosystem",
            )?.stars ?? null,
          source: "static",
          stale: true,
          complete: false,
          unavailableRepos: repoList.map((repo) => ({
            owner: repo.owner,
            repo: repo.repo,
            reason: "No live star snapshot is available",
          })),
          degradedReason: "No live star snapshot is available",
        }),
      );
    } catch (error) {
      console.error("Stars API error:", error);
      res.setHeader("Cache-Control", "no-store");
      return res.status(503).json({ error: "Stars service unavailable", stale: true });
    }
  };
}

export default createStarsHandler();
