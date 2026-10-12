/**
 * rebuild-diff.js
 *
 * Decides whether a staged build-pages diff is "freshness noise": every
 * changed line differs from its counterpart only in star counts and date
 * stamps. Those diffs carry no content change, but committing them moves main
 * and flips every open PR that carries regenerated artifacts to CONFLICTING —
 * and a conflicted PR silently gets no CI at all (#958).
 *
 * Fail-open by construction: anything this cannot positively prove to be noise
 * is reported as structural, so the caller commits as it always has.
 */

// Version stamps (v0.21.5, v2026.9.24) are content, not noise: a release bump
// must still be committed. They are masked before numbers are collapsed.
const VERSION = /\bv\d+(?:\.\d+)+\b/g;
const MONTH = "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*";
const DATE_PATTERNS = [
  // RFC 822: Mon, 12 Oct 2026 17:18:00 GMT (rss.xml lastBuildDate)
  new RegExp(`\\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \\d{1,2} ${MONTH} \\d{4} \\d{2}:\\d{2}:\\d{2} (?:GMT|[+-]\\d{4})`, "g"),
  // ISO: 2026-10-12 or 2026-10-12T17:18:00.000Z
  /\b\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?/g,
  // October 12, 2026 / Oct 12, 2026 / 12 October 2026 / October 2026
  new RegExp(`\\b${MONTH} \\d{1,2}, \\d{4}\\b`, "g"),
  new RegExp(`\\b\\d{1,2} ${MONTH} \\d{4}\\b`, "g"),
  new RegExp(`\\b${MONTH} \\d{4}\\b`, "g"),
];
// 253047 / 253,047 / 253.0k / 3.9K / 1.2M
const NUMBER = /\d[\d,]*(?:\.\d+)?[kKmM]?\b/g;

/** Collapse star counts and date stamps so two noise-equivalent lines compare equal. */
export function normalizeLine(line) {
  const versions = [];
  let out = line.replace(VERSION, (m) => {
    versions.push(m);
    return `\u0000${versions.length - 1}\u0000`;
  });
  for (const re of DATE_PATTERNS) out = out.replace(re, "<DATE>");
  out = out.replace(NUMBER, "<N>");
  return out.replace(/\u0000<N>\u0000/g, () => versions.shift());
}

/**
 * @param {string} nameStatus  output of `git diff --cached --name-status`
 * @param {string} patch       output of `git diff --cached -U0`
 * @returns {{ noiseOnly: boolean, reason: string }}
 */
export function classifyRebuildDiff(nameStatus, patch) {
  const files = nameStatus.split("\n").filter((l) => l.trim());
  if (files.length === 0) return { noiseOnly: false, reason: "empty diff" };

  for (const line of files) {
    const status = line.split("\t")[0];
    if (status !== "M") {
      return { noiseOnly: false, reason: `non-modify change: ${line.replace(/\t/g, " ")}` };
    }
  }

  let file = null;
  let seenFiles = 0;
  let removed = [];
  let added = [];
  let verdict = null;

  const flushHunk = () => {
    if (verdict || (removed.length === 0 && added.length === 0)) return;
    if (removed.length !== added.length) {
      verdict = { noiseOnly: false, reason: `${file}: hunk adds or removes lines` };
    } else {
      for (let i = 0; i < removed.length; i++) {
        if (normalizeLine(removed[i]) !== normalizeLine(added[i])) {
          verdict = { noiseOnly: false, reason: `${file}: content changed: ${added[i].trim().slice(0, 120)}` };
          break;
        }
      }
    }
    removed = [];
    added = [];
  };

  for (const line of patch.split("\n")) {
    if (line.startsWith("diff --git ")) {
      flushHunk();
      file = line.slice("diff --git ".length);
      seenFiles++;
    } else if (line.startsWith("Binary files ") || line.startsWith("GIT binary patch")) {
      return { noiseOnly: false, reason: `${file}: binary change` };
    } else if (line.startsWith("@@")) {
      flushHunk();
    } else if (line.startsWith("+++") || line.startsWith("---")) {
      // file header
    } else if (line.startsWith("-")) {
      removed.push(line.slice(1));
    } else if (line.startsWith("+")) {
      added.push(line.slice(1));
    }
    if (verdict) return verdict;
  }
  flushHunk();
  if (verdict) return verdict;

  // The patch must account for every file in the name-status list; otherwise
  // something changed that this parser did not see (mode change, truncation).
  if (seenFiles !== files.length) {
    return { noiseOnly: false, reason: `patch covers ${seenFiles} of ${files.length} changed files` };
  }
  return { noiseOnly: true, reason: `${files.length} file(s) changed only in star counts and date stamps` };
}
