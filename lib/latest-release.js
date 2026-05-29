const LATEST_RELEASE_QUERY_RE = /\b(latest|newest|current|recent)\b[\s\S]{0,80}\b(release|version|update|what'?s new|changed|changelog)\b|\bwhat'?s new\b[\s\S]{0,80}\b(release|version|hermes)\b/i;

export function detectLatestReleaseQuery(query) {
  return LATEST_RELEASE_QUERY_RE.test(String(query || ""));
}

export function parseReleaseMarkdown({ source, content }) {
  const text = String(content || "");
  const tag = firstMatch(text, /\*\*Version:\*\*\s*([^\n]+)/i) || firstMatch(source, /release-([0-9-]+)\.md$/i)?.replace(/-/g, ".");
  const publishedAt = firstMatch(text, /\*\*Published:\*\*\s*([^\n]+)/i);
  const sourceUrl = firstMatch(text, /\*\*Source:\*\*\s*([^\n]+)/i);

  const releaseHeading = findPublicVersionHeading(text);
  const version = firstMatch(releaseHeading, /(v\d+\.\d+\.\d+)/i) || normalizeReleaseTag(tag);
  const name = releaseHeading ? `Hermes Agent ${releaseHeading}` : `Hermes Agent ${version || tag}`;

  if (!version || !publishedAt) return null;

  return {
    version,
    tag: tag?.trim(),
    name,
    publishedAt: publishedAt.trim(),
    source,
    sourceUrl: sourceUrl?.trim(),
    summary: extractReleaseSummary(text),
  };
}

export function findLatestReleaseFromMarkdownFiles(files) {
  return files
    .map(parseReleaseMarkdown)
    .filter(Boolean)
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))[0] || null;
}

export function buildLatestReleaseBlock(latestRelease) {
  if (!latestRelease?.version) return "";

  const parts = [
    "## LATEST RELEASE (authoritative)",
    `${latestRelease.name || `Hermes Agent ${latestRelease.version}`} is the latest known Hermes Agent release${latestRelease.tag ? ` (${latestRelease.tag})` : ""}.`,
    latestRelease.publishedAt ? `Published: ${latestRelease.publishedAt}.` : null,
    latestRelease.source ? `Source: ${latestRelease.source}.` : null,
    "When the user asks about the latest/newest/current Hermes release, use this release as the answer anchor even if older release notes also appear in retrieved context.",
    latestRelease.summary ? `Headline: ${latestRelease.summary}` : null,
  ].filter(Boolean);

  return parts.join("\n");
}

function firstMatch(text, regex) {
  return String(text || "").match(regex)?.[1]?.trim() || null;
}

function findPublicVersionHeading(text) {
  const headings = [...String(text || "").matchAll(/^#\s+Hermes Agent\s+(v\d+\.\d+\.\d+[^\n]*)/gmi)]
    .map((m) => m[1].trim());

  return headings.find((heading) => !/^v20\d{2}\.\d{1,2}\.\d{1,2}\b/.test(heading)) || headings[0] || null;
}

function normalizeReleaseTag(tag) {
  const cleaned = String(tag || "").trim();
  return /^v\d+\.\d+\.\d+$/i.test(cleaned) ? cleaned : null;
}

function extractReleaseSummary(text) {
  const blockquote = firstMatch(text, /^>\s+(.+)$/mi);
  if (blockquote) return stripMarkdown(blockquote);

  const firstBullet = firstMatch(text, /^-\s+(.+)$/mi);
  if (firstBullet) return stripMarkdown(firstBullet);

  return "";
}

function stripMarkdown(text) {
  return String(text || "")
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    .replace(/[*_`#>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
