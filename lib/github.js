/**
 * Shared GitHub API helpers for Hermes Atlas build scripts.
 */

const DEFAULT_HEADERS = {
  Accept: "application/vnd.github+json",
  "User-Agent": "hermes-atlas-build",
};

/**
 * Build GitHub API headers with authentication.
 */
export function githubHeaders(token) {
  return {
    ...DEFAULT_HEADERS,
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Fetch README content for a single repo.
 * Returns raw markdown string, or null on failure.
 */
export async function fetchReadme(owner, repo, headers) {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/readme`,
      {
        headers: {
          ...headers,
          Accept: "application/vnd.github.raw+json",
        },
      }
    );

    if (!res.ok) return null;

    let text = await res.text();

    // Truncate very long READMEs
    if (text.length > 50000) {
      text =
        text.slice(0, 50000) +
        `\n\n---\n\n*README truncated. [Continue reading on GitHub](https://github.com/${owner}/${repo}#readme)*`;
    }

    return text;
  } catch (e) {
    console.warn(`  Failed to fetch README for ${owner}/${repo}: ${e.message}`);
    return null;
  }
}

const GRAPHQL_BATCH_SIZE = 40;
const GRAPHQL_MAX_ATTEMPTS = 3;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch metadata for all repos via GitHub GraphQL API (batched).
 * Returns { "owner/repo": { stars, description, homepage, language, license, pushedAt } }
 */
export async function fetchAllMetadata(repos, headers) {
  const metadata = {};

  for (let start = 0; start < repos.length; start += GRAPHQL_BATCH_SIZE) {
    const batch = repos.slice(start, start + GRAPHQL_BATCH_SIZE);
    const batchMetadata = await fetchMetadataBatch(batch, headers, start);
    Object.assign(metadata, batchMetadata);
  }

  return metadata;
}

async function fetchMetadataBatch(repos, headers, offset) {
  const repoQueries = repos
    .map(
      (r, i) =>
        `repo${i}: repository(owner: "${r.owner}", name: "${r.repo}") {
        stargazerCount
        description
        homepageUrl
        primaryLanguage { name }
        licenseInfo { spdxId }
        pushedAt
      }`
    )
    .join("\n");

  const query = `query { ${repoQueries} }`;
  let lastError;

  for (let attempt = 1; attempt <= GRAPHQL_MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch("https://api.github.com/graphql", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      // Throw on failure so the caller (build-pages.js) fails loudly. Returning {}
      // here would silently regenerate every page with no stars/descriptions and
      // commit the broken output. Production stays on the last good build instead.
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        const err = new Error(`GitHub GraphQL ${res.status}: ${body.slice(0, 200)}`);
        err.retryable = res.status === 502 || res.status === 503 || res.status === 504;
        throw err;
      }

      const data = await res.json();
      const nonNotFoundErrors = (data.errors || []).filter((err) => err.type !== "NOT_FOUND");
      if (nonNotFoundErrors.length > 0) {
        throw new Error(`GitHub GraphQL errors: ${JSON.stringify(nonNotFoundErrors).slice(0, 300)}`);
      }

      const metadata = {};
      repos.forEach((r, i) => {
        const node = data.data?.[`repo${i}`];
        if (node) {
          metadata[`${r.owner}/${r.repo}`] = {
            stars: node.stargazerCount,
            description: node.description || r.description,
            homepage: node.homepageUrl || null,
            language: node.primaryLanguage?.name || null,
            license: node.licenseInfo?.spdxId || null,
            pushedAt: node.pushedAt,
          };
        } else {
          console.warn(`  Missing metadata for ${r.owner}/${r.repo}; repo may be deleted, renamed, or private`);
        }
      });

      return metadata;
    } catch (err) {
      lastError = err;
      const retryable = err.retryable || /GitHub GraphQL 5\d\d/.test(err.message);
      if (!retryable || attempt === GRAPHQL_MAX_ATTEMPTS) break;
      console.warn(
        `  GitHub GraphQL batch ${offset + 1}-${offset + repos.length} failed (${err.message}); retrying attempt ${attempt + 1}/${GRAPHQL_MAX_ATTEMPTS}`
      );
      await sleep(1000 * attempt);
    }
  }

  throw lastError;
}
