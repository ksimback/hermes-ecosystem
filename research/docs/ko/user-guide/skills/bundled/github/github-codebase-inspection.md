# Codebase Inspection

**Source:** https://hermes-agent.nousresearch.com/docs/ko/user-guide/skills/bundled/github/github-codebase-inspection

Inspect codebases w/ pygount: LOC, languages, ratios.

## Skill metadata

Source

Bundled (installed by default)

Path

`skills/github/codebase-inspection`

Version

`1.0.0`

Author

Hermes Agent

License

MIT

Platforms

linux, macos, windows

Tags

`LOC`, `Code Analysis`, `pygount`, `Codebase`, `Metrics`, `Repository`

Related skills

[`github-repo-management`](/docs/ko/docs/user-guide/skills/bundled/github/github-github-repo-management)

## Reference: full SKILL.md

정보

The following is the complete skill definition that Hermes loads when this skill is triggered. This is what the agent sees as instructions when the skill is active.

# Codebase Inspection with pygount

Analyze repositories for lines of code, language breakdown, file counts, and code-vs-comment ratios using `pygount`.

## When to Use

-   User asks for LOC (lines of code) count
-   User wants a language breakdown of a repo
-   User asks about codebase size or composition
-   User wants code-vs-comment ratios
-   General "how big is this repo" questions

## Prerequisites

```
pip install --break-system-packages pygount 2>/dev/null || pip install pygount
```

## 1\. Basic Summary (Most Common)

Get a full language breakdown with file counts, code lines, and comment lines:

```
cd /path/to/repo
pygount --format=summary \
  --folders-to-skip=".git,node_modules,venv,.venv,__pycache__,.cache,dist,build,.next,.tox,.eggs,*.egg-info" \
  .
```

**IMPORTANT:** Always use `--folders-to-skip` to exclude dependency/build directories, otherwise pygount will crawl them and take a very long time or hang.

## 2\. Common Folder Exclusions

Adjust based on the project type:

```
# Python projects
--folders-to-skip=".git,venv,.venv,__pycache__,.cache,dist,build,.tox,.eggs,.mypy_cache"

# JavaScript/TypeScript projects
--folders-to-skip=".git,node_modules,dist,build,.next,.cache,.turbo,coverage"

# General catch-all
--folders-to-skip=".git,node_modules,venv,.venv,__pycache__,.cache,dist,build,.next,.tox,vendor,third_party"
```

## 3\. Filter by Specific Language

```
# Only count Python files
pygount --suffix=py --format=summary .

# Only count Python and YAML
pygount --suffix=py,yaml,yml --format=summary .
```

## 4\. Detailed File-by-File Output

```
# Default format shows per-file breakdown
pygount --folders-to-skip=".git,node_modules,venv" .

# Sort by code lines (pipe through sort)
pygount --folders-to-skip=".git,node_modules,venv" . | sort -t$'\t' -k1 -nr | head -20
```

## 5\. Output Formats

```
# Summary table (default recommendation)
pygount --format=summary .

# JSON output for programmatic use
pygount --format=json .

# Pipe-friendly: Language, file count, code, docs, empty, string
pygount --format=summary . 2>/dev/null
```

## 6\. Interpreting Results

The summary table columns:

-   **Language** — detected programming language
-   **Files** — number of files of that language
-   **Code** — lines of actual code (executable/declarative)
-   **Comment** — lines that are comments or documentation
-   **%** — percentage of total

Special pseudo-languages:

-   `__empty__` — empty files
-   `__binary__` — binary files (images, compiled, etc.)
-   `__generated__` — auto-generated files (detected heuristically)
-   `__duplicate__` — files with identical content
-   `__unknown__` — unrecognized file types

## Pitfalls

1.  **Always exclude .git, node\_modules, venv** — without `--folders-to-skip`, pygount will crawl everything and may take minutes or hang on large dependency trees.
2.  **Markdown shows 0 code lines** — pygount classifies all Markdown content as comments, not code. This is expected behavior.
3.  **JSON files show low code counts** — pygount may count JSON lines conservatively. For accurate JSON line counts, use `wc -l` directly.
4.  **Large monorepos** — for very large repos, consider using `--suffix` to target specific languages rather than scanning everything.
