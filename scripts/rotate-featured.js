#!/usr/bin/env node
/**
 * rotate-featured.js
 *
 * Rotate the homepage "Featured this week" pick.
 *
 * Usage: node scripts/rotate-featured.js <owner>/<repo>
 *
 * Effects:
 *   - Validates the slug exists in data/repos.json
 *   - Prepends the new pick to data/featured.json (newest first)
 *   - Rewrites the <!-- BEGIN featured-week --> / <!-- END featured-week -->
 *     block in index.html with HTML rendered from repos.json + summaries.json
 *
 * Re-running with the same slug is a no-op for featured.json (deduped by
 * weekStart) but always re-renders index.html, which is useful when the
 * blurb or stats have changed upstream.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatStars(n) {
  if (!n || n < 1000) return String(n || 0);
  return (n / 1000).toFixed(1) + "K";
}

function formatDate(iso) {
  const d = new Date(iso + "T00:00:00Z");
  const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

// Snap a date to the most recent Monday so weekly rotations stay aligned.
function mondayOf(date) {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0=Sun, 1=Mon, ...
  const offset = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

function truncate(s, max = 240) {
  if (!s || s.length <= max) return s || "";
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return cut.slice(0, lastSpace > max - 40 ? lastSpace : max).trimEnd() + "…";
}

function renderFeaturedSection(pick, repo, summary, weekStart) {
  const slug = `${repo.owner}/${repo.repo}`;
  const blurb = truncate(summary?.summary || repo.description || "", 260);
  const stars = formatStars(repo.stars);
  const category = (repo.category || "").toLowerCase();
  const dateLabel = formatDate(weekStart);

  return `<!-- BEGIN featured-week (auto-managed by scripts/rotate-featured.js) -->
<section class="featured-week" aria-label="Featured project this week">
  <div class="featured-week-meta">
    <div class="featured-label">featured · this week</div>
    <span class="featured-week-date">${escapeHtml(dateLabel)}</span>
  </div>
  <a class="featured-week-name" href="/projects/${escapeHtml(repo.owner)}/${escapeHtml(repo.repo)}">
    <span class="org">${escapeHtml(repo.owner)}</span><span class="slash">/</span>${escapeHtml(repo.repo)}${repo.official ? ' <span class="repo-flag">official</span>' : ""}
  </a>
  <p class="featured-week-desc">${escapeHtml(blurb)}</p>
  <div class="featured-week-foot">
    <span class="featured-week-tag featured-week-tag--star">★ ${escapeHtml(stars)}</span>
    <span class="featured-week-tag">${escapeHtml(category)}</span>
    <a class="featured-week-link" href="/projects/${escapeHtml(repo.owner)}/${escapeHtml(repo.repo)}">read the full breakdown →</a>
  </div>
</section>
<!-- END featured-week -->`;
}

function main() {
  const arg = process.argv[2];
  if (!arg || !arg.includes("/")) {
    console.error("Usage: node scripts/rotate-featured.js <owner>/<repo>");
    process.exit(1);
  }
  const [owner, repoName] = arg.split("/", 2);

  // Load repos
  const repos = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "repos.json"), "utf-8"));
  const repo = repos.find((r) => r.owner === owner && r.repo === repoName);
  if (!repo) {
    console.error(`✗ ${arg} not found in data/repos.json`);
    process.exit(1);
  }

  // Load summary (optional)
  let summary = null;
  try {
    const summaries = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "summaries.json"), "utf-8"));
    summary = summaries[`${owner}/${repoName}`] || null;
  } catch {}
  if (!summary?.summary) {
    console.warn(`⚠ No generated summary for ${arg} — falling back to repo.description`);
  }

  // Load + update featured.json
  const featuredPath = path.join(ROOT, "data", "featured.json");
  let featured = [];
  if (fs.existsSync(featuredPath)) {
    featured = JSON.parse(fs.readFileSync(featuredPath, "utf-8"));
  }
  const weekStart = mondayOf(new Date());
  const slug = `${owner}/${repoName}`;
  // Drop any existing entry for this same week (re-running same week shouldn't
  // create duplicates) and prepend the new pick.
  featured = featured.filter((e) => e.weekStart !== weekStart);
  featured.unshift({ slug, weekStart, addedAt: new Date().toISOString() });
  fs.writeFileSync(featuredPath, JSON.stringify(featured, null, 2) + "\n", "utf-8");
  console.log(`✓ data/featured.json updated (${featured.length} entries; current: ${slug} for week of ${weekStart})`);

  // Update index.html
  const indexPath = path.join(ROOT, "index.html");
  const indexHtml = fs.readFileSync(indexPath, "utf-8");
  const block = renderFeaturedSection({ slug, weekStart }, repo, summary, weekStart);
  const re = /<!-- BEGIN featured-week[\s\S]*?<!-- END featured-week -->/;
  if (!re.test(indexHtml)) {
    console.error("✗ Could not find <!-- BEGIN featured-week --> / <!-- END featured-week --> markers in index.html");
    console.error("  Add a placeholder containing those exact comment markers and try again.");
    process.exit(1);
  }
  const updated = indexHtml.replace(re, block);
  fs.writeFileSync(indexPath, updated, "utf-8");
  console.log(`✓ index.html featured-week section replaced (${slug})`);
  console.log("\nNext: review the diff, commit, and push.");
}

main();
