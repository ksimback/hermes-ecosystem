export async function fetchGitHubStars({ repoList, token, fetchImpl = fetch }) {
  if (!token) throw new Error("GitHub token unavailable");
  if (!Array.isArray(repoList) || repoList.length === 0) {
    throw new Error("Repo list unavailable");
  }

  const varDecls = [];
  const variables = {};
  const repoQueries = repoList.map((repo, index) => {
    varDecls.push(`$owner${index}: String!`, `$name${index}: String!`);
    variables[`owner${index}`] = repo.owner;
    variables[`name${index}`] = repo.repo;
    const releaseField = repo.owner === "NousResearch" && repo.repo === "hermes-agent"
      ? "latestRelease { tagName name publishedAt }"
      : "";
    return `repo${index}: repository(owner: $owner${index}, name: $name${index}) {
      stargazerCount
      updatedAt
      pushedAt
      ${releaseField}
    }`;
  }).join("\n");

  const query = `query (${varDecls.join(", ")}) { ${repoQueries}
    atlas: repository(owner: "ksimback", name: "hermes-ecosystem") {
      stargazerCount
    }
  }`;
  const response = await fetchImpl("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "hermes-atlas-stars",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) throw new Error(`GitHub GraphQL HTTP ${response.status}`);
  const payload = await response.json();
  let hermesRelease = null;
  const errors = payload.errors || [];
  const unavailableRepos = [];
  const starData = repoList.map((repo, index) => {
    const node = payload.data?.[`repo${index}`];
    if (!node) {
      if (!Number.isInteger(repo.stars) || repo.stars < 0) {
        throw new Error(`GitHub GraphQL returned no node for ${repo.owner}/${repo.repo}`);
      }
      const matchingError = errors.find((error) => error.path?.includes(`repo${index}`));
      unavailableRepos.push({
        owner: repo.owner,
        repo: repo.repo,
        reason: matchingError?.message || "GitHub returned no repository node",
      });
      return {
        owner: repo.owner,
        repo: repo.repo,
        stars: repo.stars,
        updatedAt: null,
      };
    }
    if (repo.owner === "NousResearch" && repo.repo === "hermes-agent" && node.latestRelease) {
      const name = node.latestRelease.name || "";
      const numericVersion = name.match(/v\d+\.\d+\.\d+/)?.[0];
      hermesRelease = {
        version: numericVersion || node.latestRelease.tagName,
        tag: node.latestRelease.tagName,
        name: node.latestRelease.name,
        publishedAt: node.latestRelease.publishedAt,
      };
    }
    return {
      owner: repo.owner,
      repo: repo.repo,
      stars: node.stargazerCount,
      updatedAt: node.pushedAt || node.updatedAt,
    };
  });

  const explainedAliases = new Set(
    unavailableRepos.map((item) => {
      const index = repoList.findIndex(
        (repo) => repo.owner === item.owner && repo.repo === item.repo,
      );
      return `repo${index}`;
    }),
  );
  const unexplainedErrors = errors.filter(
    (error) => !error.path?.some((part) => explainedAliases.has(part)),
  );
  if (unexplainedErrors.length > 0) {
    throw new Error(
      `GitHub GraphQL errors: ${unexplainedErrors.map((error) => error.message).join("; ")}`,
    );
  }

  const atlasStars = payload.data?.atlas?.stargazerCount
    ?? starData.find((repo) => repo.owner === "ksimback" && repo.repo === "hermes-ecosystem")?.stars
    ?? null;
  if (!Number.isInteger(atlasStars) || atlasStars < 0) {
    throw new Error("GitHub GraphQL returned no Atlas star count");
  }

  const snapshot = {
    starData,
    hermesRelease,
    atlasStars,
    complete: unavailableRepos.length === 0,
    unavailableRepos,
  };
  validateStarSnapshot(snapshot, repoList);
  return snapshot;
}

export function validateStarSnapshot(snapshot, repoList) {
  const unavailableRepos = snapshot?.unavailableRepos || [];
  const unavailableKeys = new Set(
    unavailableRepos.map((item) => `${item.owner}/${item.repo}`.toLowerCase()),
  );
  validateStarData(snapshot?.starData, repoList, { unavailableKeys });
  const complete = snapshot?.complete ?? unavailableRepos.length === 0;
  if (complete !== (unavailableRepos.length === 0)) {
    throw new Error("Star snapshot completeness metadata is inconsistent");
  }
  if (!Number.isInteger(snapshot?.atlasStars) || snapshot.atlasStars < 0) {
    throw new Error("Invalid Atlas star count");
  }
  return true;
}

export function validateStarData(starData, repoList, { unavailableKeys = new Set() } = {}) {
  if (!Array.isArray(starData) || starData.length !== repoList.length) {
    throw new Error(`Star snapshot repo count mismatch: expected ${repoList.length}, got ${starData?.length}`);
  }
  const expected = new Set(repoList.map((repo) => `${repo.owner}/${repo.repo}`.toLowerCase()));
  const seen = new Set();
  for (const item of starData) {
    const key = `${item?.owner || ""}/${item?.repo || ""}`.toLowerCase();
    if (!expected.has(key)) throw new Error(`Unexpected repo in star snapshot: ${key}`);
    if (seen.has(key)) throw new Error(`Duplicate repo in star snapshot: ${key}`);
    if (!Number.isInteger(item.stars) || item.stars < 0) {
      throw new Error(`Invalid star count for ${key}`);
    }
    if (
      (!item.updatedAt || Number.isNaN(Date.parse(item.updatedAt))) &&
      !unavailableKeys.has(key)
    ) {
      throw new Error(`Invalid updatedAt for ${key}`);
    }
    seen.add(key);
  }
  return true;
}
