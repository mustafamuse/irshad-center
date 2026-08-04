# Claude Code Setup

The single source of truth for how this repo uses Claude Code. Read this if you're a new contributor, after `/clear` in a fresh session, or before changing any Claude config.

## TL;DR

- **Mode**: sessions open in `plan` (`Shift+Tab` cycles plan → auto-accept → ask-each)
- **Verification > everything else**: invoke the `verify-app` agent after non-trivial changes
- **High-risk paths**: `lib/services/shared/billing.ts`, `lib/services/webhooks/**`, `prisma/migrations/**`, `lib/safe-action.ts`, `app/api/webhook/**`, `middleware.ts` — gated through specialty agents
- **Context-rot protocol**: `/notes` → work → `/clear` → `/notes` re-reads the same file
- **PRs**: always via `/create-pr` skill — no other format permitted

## Layout

```
.claude/
├── commands/create-pr.md          # canonical PR format
├── rules/                          # path-attached rules (auto-load when working in relevant files)
│   ├── architecture.md             # paths: lib/services/**, lib/db/**, app/**/actions.ts, app/api/**
│   ├── dry-catalog.md
│   ├── stripe-conventions.md
│   ├── testing-patterns.md
│   ├── error-handling.md
│   └── logging-conventions.md
├── skills/                         # path-attached project skills
│   ├── stripe-dual-client/         # Mahad vs Dugsi client separation
│   ├── prisma-migration-safety/    # references Mahad data deletion incident
│   └── webhook-handler/            # signature + idempotency conventions
├── notes/                          # local-only ephemeral notes (gitignored)
│   ├── <task-slug>.md              # written by /notes skill
│   └── session-journal/            # written by session-journal.sh SessionEnd hook
└── settings.local.json             # local permissions + tdd-guard hooks (gitignored)
```

Global config lives in `~/.claude/` — agents, hooks, and skills are personal and applied across all projects.

## Custom agents (global)

Invoke explicitly with `--agent=<name>` or via "use the X agent to..." in a prompt.

| Agent                | Model                          | Purpose                                                                                                                                                  |
| -------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `verify-app`         | Sonnet                         | Boris Cherny's #1 personal agent. Verifies running behavior, knows the stack (`bun run dev`, Stripe listener, Pino → Axiom, Playwright/Claude-in-Chrome) |
| `code-explorer`      | Haiku (forked context)         | Read-only fast file discovery. Skips CLAUDE.md to stay cheap. Use before making changes                                                                  |
| `security-reviewer`  | Opus                           | Reviews auth, webhook, admin, and Stripe code for injection / authz / secret-leak risks                                                                  |
| `migration-reviewer` | Opus (read-only)               | Gates `prisma/migrations/**` edits. References Mahad deletion incident                                                                                   |
| `worktree-worker`    | Sonnet (`isolation: worktree`) | One unit of work in an isolated worktree. Used by `/swarm`                                                                                               |
| `staff-reviewer`     | Opus                           | Comprehensive review for non-trivial diffs                                                                                                               |
| `ReadOnly`           | Sonnet                         | No-edit conversation. Use `claude --agent=ReadOnly` for review sessions                                                                                  |

## Custom hooks (global)

| Event                     | Hook                    | What it does                                                                                                                               |
| ------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `PreToolUse(Bash)`        | `block-dangerous.sh`    | Blocks `rm -rf`, `prisma migrate reset`, force-push to main, `sudo rm`, hardcoded creds in curl. Allows `git reset --hard origin/<branch>` |
| `PreToolUse(Bash)`        | `filter-test-output.sh` | Rewrites verbose test/lint commands to pipe through a FAIL-only filter (per Anthropic /costs doc: 10k tokens → 100s)                       |
| `PreToolUse(Edit\|Write)` | `protect-files.sh`      | Blocks editing `.env*` files, lock files, `.git/` internals                                                                                |
| `UserPromptSubmit`        | `inject-git-context.sh` | Injects branch + diff stat + untracked files as `<git-context>` on every prompt                                                            |
| `Stop`                    | `stop-review-gate.sh`   | Cheap bash gate (no agent spawn). Allows stop unless diff is non-trivial, then nudges toward `/code-review`                                |
| `WorktreeCreate`          | `worktree-create.sh`    | Symlinks `.env*` and `node_modules` from main repo into the new worktree                                                                   |
| `SessionEnd`              | `session-journal.sh`    | Writes structured journal stub to `.claude/notes/session-journal/<timestamp>.md` for later review                                          |
| `SessionStart(compact)`   | inline echo             | Reminds about CLAUDE.md rules and NOTES.md after `/compact`                                                                                |
| `Notification`            | osascript               | macOS desktop notification when Claude needs attention                                                                                     |

## Project-only hooks (`.claude/settings.local.json`)

| Event                                           | What it does                                                           | Opt-in                   |
| ----------------------------------------------- | ---------------------------------------------------------------------- | ------------------------ |
| `PostToolUse(Write\|Edit)`                      | Runs `npx tsc --noEmit` and shows top 20 errors on every .ts/.tsx edit | Always on                |
| `PreToolUse(Write\|Edit\|MultiEdit\|TodoWrite)` | `tdd-guard` blocks implementation edits when no failing test exists    | Opt-in via `TDD_GUARD=1` |
| `UserPromptSubmit`                              | `tdd-guard` (state sync)                                               | Opt-in via `TDD_GUARD=1` |
| `SessionStart(startup\|resume\|clear)`          | `tdd-guard` (state init)                                               | Opt-in via `TDD_GUARD=1` |

## Workflow skills (global)

Loaded on demand by the model, not always-on in context.

| Skill                    | When to use                                                                                                                 |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `/notes [slug]`          | Start of any task > 30 min or > 30 tool calls. Bootstraps `.claude/notes/<slug>.md`. Re-invoke after `/clear` to re-read    |
| `/babysit [pr]`          | Handle PR review bots, rebase on main, shepherd toward merge. Combine with `/loop 5m /babysit`                              |
| `/autopr`                | Run the autonomous PR pipeline (implement → typecheck → test → commit → push → `/create-pr`). Only after scope is finalized |
| `/swarm <change>`        | Fan a refactor across 3+ independent files via parallel `worktree-worker` agents                                            |
| `/feature-gan <feature>` | Planner / Generator / Evaluator three-agent harness for non-trivial features. Per Anthropic's harness design post           |
| `/context-budget`        | Show token cost per loaded skill / MCP / rule. Use when sessions feel slow                                                  |

## Project-only skills (path-attached)

These have `paths:` frontmatter pointing to the files they apply to. They auto-suggest to the model when work touches those paths.

| Skill                     | Paths                                                                              | What it enforces                                                                 |
| ------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `stripe-dual-client`      | `lib/stripe/**`, `lib/services/webhooks/**`, `app/api/webhook/**`, `**/actions.ts` | Mahad uses `stripeServerClient`, Dugsi uses `getDugsiStripeClient()` — never mix |
| `prisma-migration-safety` | `prisma/schema.prisma`, `prisma/migrations/**`                                     | Hard refusals on destructive ops; references Mahad deletion incident             |
| `webhook-handler`         | `app/api/webhook/**`, `lib/services/webhooks/**`                                   | Signature → idempotency → dispatch structure                                     |

## High-risk paths

Per Erik Schluntz's leaf-node restriction pattern, Claude treats these as read-only in auto modes — only edit with explicit user direction:

- `lib/services/shared/billing.ts`
- `lib/services/webhooks/**`
- `lib/stripe/**`
- `prisma/schema.prisma`
- `prisma/migrations/**`
- `lib/safe-action.ts`
- `app/api/webhook/**`
- `middleware.ts`

Specialty agent to invoke per area:

- auth / webhook / admin → `security-reviewer`
- `prisma/migrations/**` / `prisma/schema.prisma` → `migration-reviewer`
- post-change behavior verification → `verify-app`

## Environment variables

Set in `~/.claude/settings.json` `env` block:

| Var                                    | Value    | Effect                                           |
| -------------------------------------- | -------- | ------------------------------------------------ |
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` | `1`      | Enables agent teams                              |
| `CLAUDE_CODE_NEW_INIT`                 | `true`   | New `/init` UX                                   |
| `ENABLE_PROMPT_CACHING_1H`             | `1`      | Free 1-hour cache TTL on API key                 |
| `MAX_THINKING_TOKENS`                  | `8000`   | Caps extended thinking on cheap tasks            |
| `CLAUDE_CODE_FORK_SUBAGENT`            | `1`      | `/fork` preserves parent cache                   |
| `MAX_MCP_OUTPUT_TOKENS`                | `50000`  | Raised from 25k default for Supabase MCP queries |
| `CLAUDE_CODE_AUTO_COMPACT_WINDOW`      | `400000` | Force earlier compaction before context rot      |

## Context-rot protocol (NOTES.md → reset → re-read)

For any task spanning > 30 min or > 30 tool calls:

1. `/notes <task-slug>` — bootstraps `.claude/notes/<task-slug>.md` with goal / decisions / open questions / next step
2. Work, updating the notes file after each major step
3. When context feels stale: `/clear` (preferred if notes are current) or `/compact` (lighter)
4. `/notes` again — re-reads the file in a fresh window

The notes file is **gitignored** (everything under `.claude/notes/` except `.gitignore`, `.gitkeep`, `README.md`).

## Compounding Engineering (GitHub Action)

`.github/workflows/claude-code-review.yml` runs on every PR. When it finds a recurring class of mistake (not a one-off bug), it appends a _"Proposed CLAUDE.md addition"_ section to its top-level comment. You manually promote accepted proposals into the project `CLAUDE.md`. This closes the loop on the address-feedback bot pain.

## Adversarial prompts (when verification feels incomplete)

Per Boris Cherny's tip threads:

- _"Prove to me this works — show diffs and outputs."_
- _"Grill me on these changes and don't make a PR until I pass your test."_
- _"Knowing everything you know now, scrap this and implement the elegant solution."_

## Worktree workflow (shell aliases)

These belong in your `~/.zshrc` (paste manually):

```bash
# Claude Code worktree aliases (Boris Cherny pattern)
# Each opens a new tmux window/session into an isolated git worktree

za() { _claude_worktree "$1" 0; }
zb() { _claude_worktree "$1" 1; }
zc() { _claude_worktree "$1" 2; }

_claude_worktree() {
  local name="$1"
  local idx="${2:-0}"
  if [ -z "$name" ]; then
    echo "usage: za <name> | zb <name> | zc <name>" >&2
    return 1
  fi
  local repo_root
  repo_root=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "not in a git repo" >&2; return 1; }
  local wt="$repo_root/.claude/worktrees/$name"
  if [ ! -d "$wt" ]; then
    git -C "$repo_root" worktree add "$wt" -b "$name"
  fi
  cd "$wt" && claude
}
```

Three letters because Boris uses 5+ concurrent Claudes per project. Adjust the count to your needs.

## When NOT to follow this setup

- **Quick bugfix with clear repro**: skip `/notes`, skip plan mode, just patch
- **Doc-only PR**: skip verify-app
- **Pure refactor with no behavior change**: skip security-reviewer

The setup is structured to fail loud rather than fail silent — when something feels heavyweight, you're probably in one of the above edge cases.

## 2026-08 blog refresh

Reviewed the ten most recent Anthropic engineering/research posts and folded the deltas into this setup. Sources: "How we contain Claude across products", "An update on recent Claude Code quality reports" (Apr 2026), "Scaling Managed Agents" (Apr 2026), "How we built Claude Code auto mode" (Mar 2026), "Harness design for long-running application development" (Mar 2026), "Eval awareness in BrowseComp" (Mar 2026), "Quantifying infrastructure noise in agentic coding evals" (Feb 2026), "Building a C compiler with a team of parallel Claudes" (Feb 2026), "Designing AI-resistant technical evaluations" (Jan 2026), "How Claude Code is used in practice" (research).

**Adopted:**

- **Versioned permission policy** (auto-mode post: tiered allowlists; containment post: layered controls). High-risk paths are now enforced by `permissions.ask` rules in the checked-in `.claude/settings.json` — an edit there always prompts, even in auto-accept mode, on every machine that clones the repo. `prisma migrate reset` variants are `deny` rules, giving a second layer under the global `block-dangerous.sh` hook.
- **Treat tool output and cloned files as untrusted** (containment post). Web content, third-party repo files, and MCP tool results can carry injected instructions; environment controls (hooks, permission rules, sandbox), not model judgment, are the reliable countermeasure. Prefer `/sandbox` for sessions that touch untrusted code.

**Already covered (no change needed):**

- Generator-evaluator harness with negotiated success criteria (harness-design post) → `/feature-gan`
- Progress files, git discipline, session-start re-reads (effective-harnesses post) → `/notes` + SDD ledger
- Test output structured for LLM consumption, minimal context (C-compiler post) → `filter-test-output.sh`
- End-user verification with browser automation (effective-harnesses post) → `verify-app` agent
- Parallel agents without stepping on each other (C-compiler post's file locks) → worktree-per-task convention

**Rejected:**

- 200+ granular JSON feature lists with locked `passes` fields — built for unattended multi-day runs; SDD plans with per-task review gates fit a solo attended workflow better.
- Managed Agents / decoupled brain-hands architecture — platform-scale concern, nothing to apply locally.
- Eval-suite posts (AI-resistant evals, infrastructure noise, demystifying evals) — no model eval suite in this repo; noted for if one ever exists.

## Reference

- Project rules: `.claude/rules/`
- User-level rules: `~/.claude/CLAUDE.md`
- Project memory: `~/.claude/projects/-Users-mustafamuse-dev-irshad-center/memory/MEMORY.md`
- Original audit transcript: see `project_claude_audit_2026_05.md` in memory
