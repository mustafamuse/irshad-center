# `.claude/notes/`

Ephemeral notes Claude writes for long-running tasks.

## Subdirectories

- `<task-slug>.md` — task NOTES.md files written by the `/notes` skill
- `session-journal/<timestamp>.md` — session-end journals written automatically by the `session-journal.sh` SessionEnd hook

## Lifecycle

- **Everything in this directory is gitignored** (the inner `.gitignore` has `*` with allow-listed `.gitignore`, `.gitkeep`, `README.md`). The directory exists for tool convenience; contents are local-only.
- Session journals are pruned to the last 30 entries automatically by the hook.
- Task notes have no auto-cleanup; review periodically and delete when the task is shipped.

## When the user reviews

When you (or a future session) want to harvest durable insights from these notes into `~/.claude/projects/.../memory/MEMORY.md`, read the latest session-journal entries and any task-notes that have a populated "Learnings to promote to MEMORY.md" section.
