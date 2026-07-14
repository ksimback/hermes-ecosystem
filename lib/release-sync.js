import path from "node:path";

const CALENDAR_TAG_RE = /^v20\d{2}(?:\.\d+){2,}$/i;

export function extractTrackedReleaseTags(researchFiles) {
  const tags = new Set();

  for (const file of researchFiles) {
    const content = String(file.content || "");
    for (const match of content.matchAll(/^\*\*Version:\*\*\s*(v20\d{2}(?:\.\d+){2,})\s*$/gmi)) {
      tags.add(match[1]);
    }
    for (const match of content.matchAll(/releases\/tag\/(v20\d{2}(?:\.\d+){2,})/gi)) {
      tags.add(match[1]);
    }
  }

  return tags;
}

export function renderReleaseMarkdown(release) {
  const tag = String(release?.tag_name || "").trim();
  const publishedAt = String(release?.published_at || "").trim();
  const body = String(release?.body || "").trim();

  if (!CALENDAR_TAG_RE.test(tag)) {
    throw new Error(`Invalid Hermes release tag: ${tag || "(missing)"}`);
  }
  if (!publishedAt || Number.isNaN(Date.parse(publishedAt))) {
    throw new Error(`Release ${tag} has an invalid published_at value`);
  }
  if (body.length < 100) {
    throw new Error(`Release ${tag} has no usable release notes (${body.length} chars)`);
  }

  return [
    `# Hermes Agent ${tag} Release Notes`,
    "",
    `**Version:** ${tag}`,
    `**Published:** ${publishedAt}`,
    `**Source:** https://github.com/NousResearch/hermes-agent/releases/tag/${tag}`,
    "",
    body,
    "",
  ].join("\n");
}

export function planReleaseBatch({ upstreamReleases, researchFiles }) {
  const trackedTags = extractTrackedReleaseTags(researchFiles);
  const trackedPublishedTimes = researchFiles
    .map((file) => String(file.content || "").match(/^\*\*Published:\*\*\s*([^\n]+)$/mi)?.[1])
    .map((value) => Date.parse(value))
    .filter(Number.isFinite);
  const latestTrackedPublishedTime = trackedPublishedTimes.length
    ? Math.max(...trackedPublishedTimes)
    : Number.NEGATIVE_INFINITY;
  const existingNumbers = researchFiles
    .map((file) => path.basename(file.path || "").match(/^(\d+)-/)?.[1])
    .filter(Boolean)
    .map(Number);
  let nextNumber = Math.max(29, ...existingNumbers) + 1;

  const missing = upstreamReleases
    .filter((release) => !release.draft && !release.prerelease)
    .filter((release) => CALENDAR_TAG_RE.test(String(release.tag_name || "")))
    .filter((release) => !trackedTags.has(release.tag_name))
    // The Atlas intentionally does not carry every historical release. Treat
    // the newest tracked publication as the ingestion watermark and capture
    // every upstream release after it, including multiple same-day releases.
    .filter((release) => Date.parse(release.published_at) > latestTrackedPublishedTime)
    .sort((a, b) => Date.parse(a.published_at) - Date.parse(b.published_at));

  const documents = missing.map((release) => {
    const tagSlug = release.tag_name.replace(/^v/, "").replace(/\./g, "-");
    return {
      release,
      path: `research/${nextNumber++}-release-${tagSlug}.md`,
      content: renderReleaseMarkdown(release),
    };
  });

  return { trackedTags, missing, documents };
}

export function releaseTagFromPrTitle(title) {
  return String(title || "").match(/Hermes Agent\s+(v20\d{2}(?:\.\d+){2,})/i)?.[1] || null;
}

export function releaseBranchName(tag) {
  const slug = String(tag || "")
    .replace(/^v/i, "")
    .replace(/[^0-9.]+/g, "")
    .replace(/\./g, "-");
  if (!slug) throw new Error("Cannot create a release branch without a tag");
  return `release-notes-batch-${slug}`;
}
