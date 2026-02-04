---
allowed-tools: Bash, Read, Grep, Glob, Edit, Write, Task
argument-hint: [pr-number]
description: Pull PR review comments, analyze each with agents, implement fixes, and resolve addressed comments
model: sonnet
---

# Address PR Feedback

Systematically review and resolve PR review comments.

## Step 1: Identify the PR

- If `$ARGUMENTS` contains a PR number, use that
- Otherwise detect from current branch: !`gh pr view --json number,title,url 2>/dev/null || echo "No PR found for current branch"`

## Step 2: Pull All Comments

Fetch every review comment and issue-level comment on the PR:

```bash
gh api repos/{owner}/{repo}/pulls/{number}/comments
gh api repos/{owner}/{repo}/pulls/{number}/reviews
gh api repos/{owner}/{repo}/issues/{number}/comments
```

Filter out bot noise (Vercel deployment status, etc). Keep only substantive review feedback.

## Step 3: Deep Analysis (Use Parallel Agents)

For EACH substantive comment, launch a `feature-dev:code-explorer` agent to:

1. Read the file and lines referenced in the comment
2. Trace callers and usages of the affected code
3. Check the Prisma schema for relationship/cascade implications
4. Verify if the issue is real or a false positive
5. Assess severity: Critical / Medium / Low / Non-issue

Run agents in parallel when comments are independent.

## Step 4: Present Assessment

For each comment, present a structured assessment:

```
### Issue: [title]
- **File**: path:line
- **What**: One-line description
- **Why it occurred**: Root cause
- **Why it matters**: Business/technical impact (or why it doesn't)
- **Severity**: Critical / Medium / Low / Non-issue
- **Fix**: Recommended solution with code snippet, or "No change needed" with rationale
```

Group by severity. Clearly separate "Fix" from "Dismiss" items.

## Step 5: Interview

Before implementing, ask the user:
- Do they agree with the assessment?
- Any items they want to override (fix something dismissed, or dismiss something marked for fix)?
- Any questions about the analysis?

Wait for user confirmation before proceeding.

## Step 6: Implement Fixes

For each agreed fix:
1. Read the target file
2. Make the minimal change
3. Run `npx tsc --noEmit` to verify types
4. Run relevant tests if they exist

## Step 7: Verify

```bash
npx tsc --noEmit
npx vitest run --reporter=verbose 2>&1 | tail -20
```

## Step 8: Commit and Resolve

1. Stage and commit the fixes with a descriptive message
2. Push to the PR branch
3. For each resolved comment, post a reply explaining what was fixed:
   ```bash
   gh api repos/{owner}/{repo}/pulls/{number}/comments/{comment_id}/replies -f body="Fixed: [brief explanation]"
   ```

## Rules

- Never dismiss an issue without reading the actual code first
- Always trace through callers and schema relationships
- Present findings before implementing -- get user sign-off
- Minimal changes only -- fix the issue, don't refactor surrounding code
- If a comment is a false positive, explain why with evidence from the code
