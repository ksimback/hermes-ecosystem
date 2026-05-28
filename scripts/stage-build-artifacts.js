#!/usr/bin/env node
/**
 * Stage every generated artifact emitted by generate-summaries.js and
 * build-pages.js, then fail loudly if the build produced any unstaged files.
 *
 * This keeps .github/workflows/build-pages.yml from hand-maintaining a fragile
 * `git add ...` list. When a future generator emits a new artifact, CI will
 * fail with the exact path instead of silently dropping it from the bot commit.
 */
import { GENERATED_ARTIFACT_PATHS, stageGeneratedArtifacts } from "../lib/build-artifacts.js";

try {
  stageGeneratedArtifacts();
  console.log(`Staged generated artifacts: ${GENERATED_ARTIFACT_PATHS.join(", ")}`);
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}
