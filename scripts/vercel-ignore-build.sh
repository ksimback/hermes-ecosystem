#!/usr/bin/env bash
# Vercel "Ignored Build Step" (vercel.json ignoreCommand). Exit 0 skips the
# deployment, exit 1 builds it.
#
# Skips a production deployment when every file changed since the last
# production deployment is in research/docs/ or .github/. A docs-mirror commit
# (refresh-docs.yml) is followed minutes later by rebuild-chunks.yml's
# knowledge-base commit, which deploys both. Skipped changes still ship with the
# next deployment, because the diff is taken from VERCEL_GIT_PREVIOUS_SHA (the
# last deployed commit), not HEAD^. Previews always build, because PR smoke
# tests wait on them. Anything uncertain builds.
set -u

SKIP_RE='^(research/docs/|\.github/)'

[ "${VERCEL_ENV:-}" = "production" ] || exit 1
prev="${VERCEL_GIT_PREVIOUS_SHA:-}"
[ -n "$prev" ] || exit 1

# Vercel clones shallowly; fetch the last deployed commit if it isn't present.
git cat-file -e "$prev^{commit}" 2>/dev/null ||
  git fetch --quiet --depth=200 origin "$prev" 2>/dev/null ||
  exit 1
changed=$(git diff --name-only "$prev" HEAD) || exit 1
[ -n "$changed" ] || exit 1

if printf '%s\n' "$changed" | grep -qvE "$SKIP_RE"; then exit 1; fi

echo "Skipping build: only research/docs/ or .github/ changed since ${prev:0:7}."
exit 0
