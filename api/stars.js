import { kvGet, kvSet } from "../lib/redis.js";
import { readFileSync } from "fs";
import { join } from "path";

const CACHE_KEY = "stars:current";
const CACHE_TTL = 3600; // 1 hour

// Load repos at module level (cached across invocations in same lambda)
let repos = null;
function loadRepos() {
  if (repos) return repos;
  try {
    const raw = readFileSync(join(process.cwd(), "data", "repos.json"), "utf-8");
    repos = JSON.parse(raw);
    return repos;
  } catch (e) {
    console.error("Failed to load repos.json:", e.message);
    return [];
  }
}

export default async function handler(req, res) {
  try {
    const repoList = loadRepos();
    if (repoList.length === 0) {
      return res.status(500).json({ error: "Repo list unavailable" });
    }

    // Cache-bypass is reserved for Vercel Cron. Vercel attaches
    // Authorization: Bearer ${CRON_SECRET} automatically when CRON_SECRET
    // is set as an env var. Without this check, anyone could call
    // /api/stars?cron=true to bypass the cache and burn GitHub API quota.
    const wantsBypass = req.query.cron === "true" || req.query.cron === "1";
    if (wantsBypass) {
      const expected = process.env.CRON_SECRET
        ? `Bearer ${process.env.CRON_SECRET}`
        : null;
      if (!expected || req.headers.authorization !== expected) {
        return res.status(401).json({ error: "Unauthorized" });
      }
    }

    // Check cache first
    const cached = await kvGet(CACHE_KEY);
    if (cached && !wantsBypass) {
      return res.status(200).json(cached);
    }

    // Build GitHub GraphQL query batching all repos
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      // No token — return static data from repos.json
      const fallback = buildResponse(repoList.map(r => ({
        owner: r.owner,
        repo: r.repo,
        stars: r.stars,
        updatedAt: null
      })));
      return res.status(200).json(fallback);
    }

    // Batch all repos into one GraphQL query.
    // For NousResearch/hermes-agent, also pull latestRelease so the site can
    // render live Hermes version without staleness. We pull both the tagName
    // (dated, e.g. "v2026.4.16") and the release name (which contains the
    // numeric version, e.g. "Hermes Agent v0.10.0 (v2026.4.16)").
    // Use GraphQL variables (not string interpolation) for owner/repo so values
    // from data/repos.json can never alter query structure. owner/repo are
    // declared as typed variables and passed in the `variables` map.
    const varDecls = [];
    const variables = {};
    const repoQueries = repoList.map((r, i) => {
      varDecls.push(`$owner${i}: String!`, `$name${i}: String!`);
      variables[`owner${i}`] = r.owner;
      variables[`name${i}`] = r.repo;
      const releaseField = (r.owner === "NousResearch" && r.repo === "hermes-agent")
        ? "latestRelease { tagName name publishedAt }"
        : "";
      return `repo${i}: repository(owner: $owner${i}, name: $name${i}) {
        stargazerCount
        updatedAt
        pushedAt
        ${releaseField}
      }`;
    }).join("\n");

    // Also fetch the Hermes Atlas repo's own star count for the masthead CTA.
    // (Constant, repo-owned identifiers — safe as literals.)
    const query = `query (${varDecls.join(", ")}) { ${repoQueries}
      atlas: repository(owner: "ksimback", name: "hermes-ecosystem") {
        stargazerCount
      }
    }`;

    const ghRes = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "hermes-ecosystem"
      },
      body: JSON.stringify({ query, variables })
    });

    if (!ghRes.ok) {
      throw new Error(`GitHub API error: ${ghRes.status}`);
    }

    const ghData = await ghRes.json();

    if (ghData.errors) {
      console.error("GraphQL errors:", ghData.errors);
    }

    // Map results back to repos
    let hermesRelease = null;
    const starData = repoList.map((r, i) => {
      const node = ghData.data?.[`repo${i}`];
      if (r.owner === "NousResearch" && r.repo === "hermes-agent" && node?.latestRelease) {
        // Parse numeric version (e.g. "v0.10.0") from the release name,
        // falling back to the tagName if the name doesn't match the pattern.
        const name = node.latestRelease.name || "";
        const numericMatch = name.match(/v\d+\.\d+\.\d+/);
        hermesRelease = {
          version: numericMatch ? numericMatch[0] : node.latestRelease.tagName,
          tag: node.latestRelease.tagName,
          name: node.latestRelease.name,
          publishedAt: node.latestRelease.publishedAt
        };
      }
      return {
        owner: r.owner,
        repo: r.repo,
        stars: node?.stargazerCount ?? r.stars,
        updatedAt: node?.pushedAt ?? node?.updatedAt ?? null
      };
    });

    const atlasStars = ghData.data?.atlas?.stargazerCount ?? null;
    const response = buildResponse(starData, hermesRelease, atlasStars);

    // Cache the result
    await kvSet(CACHE_KEY, response, { ex: CACHE_TTL });

    // Save daily snapshot for history
    const today = new Date().toISOString().slice(0, 10);
    const historyKey = `stars:history:${today}`;
    const snapshot = Object.fromEntries(
      starData.map(r => [`${r.owner}/${r.repo}`, r.stars])
    );
    // 366-day TTL: stars-history only ever reads back 365 days, so without an
    // expiry these daily keys accumulate in Redis forever.
    await kvSet(historyKey, snapshot, { ex: 366 * 86400 });

    return res.status(200).json(response);
  } catch (err) {
    console.error("Stars API error:", err);
    // Fallback to static data
    const repoList = loadRepos();
    const fallback = buildResponse(repoList.map(r => ({
      owner: r.owner,
      repo: r.repo,
      stars: r.stars,
      updatedAt: null
    })));
    // Serve the static fallback but never let this error response get cached
    // by the CDN (the /api/(.*) rule in vercel.json sets s-maxage=3600, which
    // would pin a transient GitHub/Redis failure as the "good" answer for an
    // hour). Do not leak err.message to the client — it's logged above.
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(fallback);
  }
}

function buildResponse(starData, hermesRelease = null, atlasStars = null) {
  const totalStars = starData.reduce((sum, r) => sum + r.stars, 0);

  // Build a lookup map
  const repoMap = {};
  starData.forEach(r => {
    repoMap[`${r.owner}/${r.repo}`] = {
      stars: r.stars,
      updatedAt: r.updatedAt
    };
  });

  return {
    repos: repoMap,
    totals: {
      stars: totalStars,
      count: starData.length,
      updated: new Date().toISOString()
    },
    hermes: hermesRelease,
    atlas: { stars: atlasStars }
  };
}
