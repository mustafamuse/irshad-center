---
name: create-pr
description: |
  This skill should be used when the user asks to "create a PR", "open a pull request",
  "make a PR", "submit a PR", "push a PR", or any variation of creating/opening a pull request.
  The skill focuses on extracting the INTENT behind changes and creating meaningful PR descriptions.
allowed-tools: Bash Read Write Grep Glob AskUserQuestion
---

# Pull Request Creation

## Core Rules

1. **NEVER fabricate intent.** Most users say "do X" without explaining why. When intent is missing (which is usually the case), ASK before creating the PR.

2. **NEVER list files.** No "Files Updated" or "Files Changed" sections. GitHub shows this already.

3. **NEVER narrate code changes.** Don't explain what the code does in human language. The diff shows the implementation.

4. **NEVER speculate on risks.** Only include risks if the user explicitly mentioned them.

5. **NEVER include a "Test plan" section.** Testing is implicit in QA processes. Omit any test plan, test checklist, or testing instructions from PR descriptions.

## Workflow

### 1. Look for intent in session history

Did the user explicitly state:

- What problem they're solving?
- Why they need this change?

**"Do X" is not intent.** "Add button to page" describes WHAT, not WHY.

### 2. Ask for intent (usually needed)

Most sessions won't have intent. Ask:

```
Before creating this PR, I need to understand the intent behind this change.

What problem does this solve, and why is this change needed?
```

### 3. Commit and push if needed

If changes aren't committed and pushed, do that first.

### 4. Determine the base branch

The base branch is the branch this PR should merge INTO.

1. Get the repo's default branch: `gh repo view --json defaultBranchRef -q '.defaultBranchRef.name'`
2. Check the current branch's upstream: `git rev-parse --abbrev-ref @{upstream} 2>/dev/null` — if this returns empty (no upstream set), skip to step 4.
3. If the upstream tracking branch differs from the default branch (e.g., tracks `full` instead of `main`), use the upstream's remote branch as the base.
4. If uncertain, ask the user which branch to target.
5. Always pass `--base <branch>` to `gh pr create`.

### 5. Validate diff matches intent

Before writing the PR description, review the actual diff to ensure it matches the user's intent:

1. Run `git diff <base-branch>...HEAD --stat` to see all files changed
2. Compare the changed files against what the user discussed in this session
3. If there are **unexpected files** — files changed that weren't part of the conversation — STOP and warn the user:

```
I notice the diff includes changes to files we didn't discuss:
- <unexpected file 1>
- <unexpected file 2>

These may be leftover changes from a previous session. Should I:
1. Proceed with all changes in one PR
2. Help you split these into separate commits/PRs
3. Exclude them (you'll need to stash or reset those files)
```

4. Only proceed to step 6 once the user has confirmed the diff is intentional
5. When writing the PR description, base the "How?" section on the **actual diff**, not just the conversation context

### 6. Create or update PR

Use `gh` CLI for all PR operations:

**Create new PR:**

```bash
gh pr create --base "<base-branch>" --title "<title>" --body "$(cat <<'EOF'
<description body here>
EOF
)"
```

**Update existing PR:**

```bash
gh pr edit --body "$(cat <<'EOF'
<description body here>
EOF
)"
```

**Check if PR exists:** `gh pr view --json number 2>/dev/null`

If PR already exists for branch, update its description. Otherwise create new PR.

**Description format:**

```markdown
### Why?

[The problem we're solving - from user's explanation, NOT fabricated]

### How?

[High-level approach - 1-2 sentences. Do NOT list changes or files. The diff shows the implementation.]

<details>
<summary>Implementation Plan</summary>

[PLAN_CONTENT — see "Finding the plan file" below. If no plan file found, omit this entire <details> section.]

</details>

<sub>Generated with Claude Code</sub>
```

**Issue/PR references:** When referencing related issues or PRs, use bulleted lists (`- #123` or `- https://github.com/intercom/repo/issues/123`) so GitHub renders them as rich linked cards.

**Avoid accidental issue links:** On GitHub, `#` followed by a number (e.g., `#1`, `#42`) automatically creates a hyperlink to the issue/PR with that number. Only use `#NUMBER` when intentionally linking to an issue or PR. Never use it in prose like "the #1 cause" or "#3 priority" — rephrase instead (e.g., "the top cause", "third priority"). If a literal `#` before a number is unavoidable, escape it with a backslash (`\#1`).

**Finding the plan file:**

1. **Check conversation history first.** Look in this conversation for a system message containing a path like `~/.claude/plans/<name>.md`. When plan mode was used, the system always injects the full path. Use it directly with the Read tool.
2. **If not in history**, check project-scoped plans first: `ls -t .claude/plans/*.md 2>/dev/null | head -5`, then fall back to global: `ls -t ~/.claude/plans/*.md 2>/dev/null | head -5`. Read the first few lines of each to identify which one matches the current task (based on the changes you're about to PR). If no plan clearly matches, or if the match is ambiguous, omit the plan section. (Do NOT use Glob for this — Glob sorts alphabetically by filename, not by modification time, and plan filenames are random.)
3. Paste the plan file's full markdown contents into the `<details>` block. Do NOT include the file path — plan files are gitignored and won't exist in the PR.
4. If no plan file is found by either method, omit the entire `<details>` block.

**Optional sections** (only if user explicitly discussed):

- `### Decisions` - if user explained trade-offs or choices made
- `### Risks` - ONLY if user mentioned specific concerns

## Anti-Patterns

| Don't                            | Why                                                                               |
| -------------------------------- | --------------------------------------------------------------------------------- |
| Fabricate intent                 | User didn't explain why -> ASK, don't invent                                      |
| List files changed               | GitHub already shows this                                                         |
| Speculate on risks               | Only include if user mentioned them                                               |
| Narrate code changes             | Diff shows the implementation                                                     |
| Add "Test plan" section          | Testing is implicit in QA; clutters the PR                                        |
| Write intent, ignore actual diff | PR description must reflect the ACTUAL changes, not just what was discussed       |
| Use `#NUMBER` in prose           | `#42` links to issue 42 — only use for intentional references, rephrase otherwise |
