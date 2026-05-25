# Apple Notes

**Source:** https://hermes-agent.nousresearch.com/docs/ko/user-guide/skills/bundled/apple/apple-apple-notes

Manage Apple Notes via memo CLI: create, search, edit.

## Skill metadata

Source

Bundled (installed by default)

Path

`skills/apple/apple-notes`

Version

`1.0.0`

Author

Hermes Agent

License

MIT

Platforms

macos

Tags

`Notes`, `Apple`, `macOS`, `note-taking`

Related skills

[`obsidian`](/docs/ko/docs/user-guide/skills/bundled/note-taking/note-taking-obsidian)

## Reference: full SKILL.md

정보

The following is the complete skill definition that Hermes loads when this skill is triggered. This is what the agent sees as instructions when the skill is active.

# Apple Notes

Use `memo` to manage Apple Notes directly from the terminal. Notes sync across all Apple devices via iCloud.

## Prerequisites

-   **macOS** with Notes.app
-   Install: `brew tap antoniorodr/memo && brew install antoniorodr/memo/memo`
-   Grant Automation access to Notes.app when prompted (System Settings → Privacy → Automation)

## When to Use

-   User asks to create, view, or search Apple Notes
-   Saving information to Notes.app for cross-device access
-   Organizing notes into folders
-   Exporting notes to Markdown/HTML

## When NOT to Use

-   Obsidian vault management → use the `obsidian` skill
-   Bear Notes → separate app (not supported here)
-   Quick agent-only notes → use the `memory` tool instead

## Quick Reference

### View Notes

```
memo notes                        # List all notes
memo notes -f "Folder Name"       # Filter by folder
memo notes -s "query"             # Search notes (fuzzy)
```

### Create Notes

```
memo notes -a                     # Interactive editor
memo notes -a "Note Title"        # Quick add with title
```

### Edit Notes

```
memo notes -e                     # Interactive selection to edit
```

### Delete Notes

```
memo notes -d                     # Interactive selection to delete
```

### Move Notes

```
memo notes -m                     # Move note to folder (interactive)
```

### Export Notes

```
memo notes -ex                    # Export to HTML/Markdown
```

## Limitations

-   Cannot edit notes containing images or attachments
-   Interactive prompts require terminal access (use pty=true if needed)
-   macOS only — requires Apple Notes.app

## Rules

1.  Prefer Apple Notes when user wants cross-device sync (iPhone/iPad/Mac)
2.  Use the `memory` tool for agent-internal notes that don't need to sync
3.  Use the `obsidian` skill for Markdown-native knowledge management
