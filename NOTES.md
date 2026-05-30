# PR #235 — Autonomous Refactor Loop

## Goal
Fully refactor + clean up the entire PR #235 diff (22 files, ~1,675 insertions) via repeated,
verified multi-agent rounds, escalating to a large council-refactor finale. Run unattended
("aggressive + all-day heartbeat") until the user returns later today (2026-05-30).

## Config (decided with user)
- **Scope**: entire PR diff vs `main` (core export files + all changed `scripts/`).
- **Aggressiveness**: aggressive — up to 8 review-refine rounds/cycle, council finale of 10 agents,
  long-interval heartbeat re-runs until user returns.
- **Push**: commit locally each green round; push to `origin/dugsi-export-hardening` only at
  council-finale checkpoints (avoids bot-comment spam during all-day run).
- **Branch/worktree**: `dugsi-export-hardening` at
  `/Users/mustafamuse/dev/irshad-center/.claude/worktrees/dugsi-export-hardening` (HEAD b87abfe9).

## Engine (Workflow: pr-refactor-loop)
Per round:
1. Review fan-out — 6 lenses (bugs, types, simplify, slop, dead-code, perf), read-only.
2. Dedup findings (plain JS).
3. Adversarial verify — one skeptic per finding; keep only real + behavior-preserving + in-scope +
   not a high-risk path.
4. Apply — single sequential applier agent: minimal edits → `bun run typecheck` →
   `bunx vitest run` (self-heal x3). Green → commit. Red → `git checkout -- .` (per-round revert).
5. Loop until 2 consecutive dry rounds or 8 rounds.
6. Council finale — 10 angles → synthesize → apply safest → verify → commit.

## Safety invariants
- NEVER edit high-risk paths: lib/services/shared/billing.ts, lib/services/webhooks/**, lib/stripe/**,
  prisma/**, lib/safe-action.ts, app/api/webhook/**, middleware.ts. (Diff currently touches none.)
- A round only survives if typecheck + tests are green; otherwise it is reverted to HEAD.
- Never auto-merge. Never force-push.
- Domain invariant: `skippedDuplicate` is contact-level, not family-level (see CLAUDE.md). Do not let
  any refactor rename/repurpose it.

## State / progress log
- (loop appends here as cycles complete)
