import path from "node:path";

// Upstream tagged releases by calendar date (v2026.9.24, v2026.7.7.2) until
// 2026-09-24, then switched to the plain public version (v0.21.6 onward). Both
// are "v" plus three or more dot-separated numbers. Anything else is reported
// as unrecognized rather than silently filtered: a calendar-only filter here
// is what left the Atlas stuck on v0.21.5 for seven weeks with a green monitor.
const RELEASE_TAG = String.raw`v\d+(?:\.\d+){2,}`;
const RELEASE_TAG_RE = new RegExp(`^${RELEASE_TAG}$`, "i");
const TRACKED_VERSION_RE = new RegExp(String.raw`^\*\*Version:\*\*\s*(${RELEASE_TAG})\s*$`, "gmi");
const TRACKED_SOURCE_RE = new RegExp(String.raw`releases\/tag\/(${RELEASE_TAG})(?![\w.])`, "gi");
const PR_TITLE_TAG_RE = new RegExp(String.raw`Hermes Agent\s+(${RELEASE_TAG})`, "i");

export function isReleaseTag(tag) {
  return RELEASE_TAG_RE.test(String(tag || ""));
}

export function extractTrackedReleaseTags(researchFiles) {
  const tags = new Set();

  for (const file of researchFiles) {
    const content = String(file.content || "");
    for (const match of content.matchAll(TRACKED_VERSION_RE)) {
      tags.add(match[1]);
    }
    for (const match of content.matchAll(TRACKED_SOURCE_RE)) {
      tags.add(match[1]);
    }
  }

  return tags;
}

export function renderReleaseMarkdown(release) {
  const tag = String(release?.tag_name || "").trim();
  const publishedAt = String(release?.published_at || "").trim();
  const body = String(release?.body || "").trim();

  if (!isReleaseTag(tag)) {
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
    .map((file) => String(file.content || "").match(/^\*\*Published:\*\*\s*([^\r\n]+)\r?$/mi)?.[1])
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

  // The Atlas intentionally does not carry every historical release. Treat
  // the newest tracked publication as the ingestion watermark and capture
  // every upstream release after it, including multiple same-day releases.
  const pending = upstreamReleases
    .filter((release) => !release.draft && !release.prerelease)
    .filter((release) => !trackedTags.has(release.tag_name))
    .filter((release) => Date.parse(release.published_at) > latestTrackedPublishedTime)
    .sort((a, b) => Date.parse(a.published_at) - Date.parse(b.published_at));
  const missing = pending.filter((release) => isReleaseTag(release.tag_name));
  // Stable releases past the watermark that cannot be ingested. The caller
  // must fail on these: skipping them quietly is how a tag-scheme change goes
  // unnoticed.
  const unrecognized = pending.filter((release) => !isReleaseTag(release.tag_name));

  const documents = missing.map((release) => {
    const tagSlug = release.tag_name.replace(/^v/, "").replace(/\./g, "-");
    return {
      release,
      path: `research/${nextNumber++}-release-${tagSlug}.md`,
      content: renderReleaseMarkdown(release),
    };
  });

  return { trackedTags, missing, documents, unrecognized };
}

export function latestStableRelease(upstreamReleases) {
  return upstreamReleases
    .filter((release) => !release.draft && !release.prerelease)
    .filter((release) => isReleaseTag(release.tag_name))
    .filter((release) => Number.isFinite(Date.parse(release.published_at)))
    .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at))[0] || null;
}

export function releaseTagFromPrTitle(title) {
  return String(title || "").match(PR_TITLE_TAG_RE)?.[1] || null;
}

export function releaseBranchName(tag) {
  const slug = String(tag || "")
    .replace(/^v/i, "")
    .replace(/[^0-9.]+/g, "")
    .replace(/\./g, "-");
  if (!slug) throw new Error("Cannot create a release branch without a tag");
  return `release-notes-batch-${slug}`;
}
