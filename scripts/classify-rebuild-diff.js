#!/usr/bin/env node
/**
 * classify-rebuild-diff.js
 *
 * Classifies the STAGED build-pages diff (run after stage-build-artifacts.js).
 *
 *   exit 0  -> freshness noise only (star counts / date stamps)
 *   exit 1  -> structural change, or anything the classifier is unsure about
 *
 * build-pages.yml skips the bot commit only on exit 0, so every failure mode
 * of this script (crash, unreadable diff, unknown shape) falls back to the old
 * behavior of committing. See lib/rebuild-diff.js and #958.
 */
import { execFileSync } from "node:child_process";
import { classifyRebuildDiff } from "../lib/rebuild-diff.js";

try {
  const git = (args) =>
    execFileSync("git", args, { encoding: "utf-8", maxBuffer: 1024 * 1024 * 1024 });
  const nameStatus = git(["diff", "--cached", "--name-status"]);
  const patch = git(["diff", "--cached", "-U0", "--no-color", "--no-ext-diff"]);
  const { noiseOnly, reason } = classifyRebuildDiff(nameStatus, patch);
  console.log(`${noiseOnly ? "NOISE-ONLY" : "STRUCTURAL"}: ${reason}`);
  process.exit(noiseOnly ? 0 : 1);
} catch (err) {
  console.log(`STRUCTURAL (classifier error, failing open): ${err.message || err}`);
  process.exit(1);
}
