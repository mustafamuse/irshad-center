# Claude Code Shell Snippets

Paste these into `~/.zshrc` (or `~/.bashrc`). They are **not** auto-applied; this file is a clipboard, not a config.

## Worktree aliases (`za` / `zb` / `zc`)

Boris Cherny's pattern: run 3-5 Claudes in parallel, each in its own isolated worktree. Saves the friction of `git worktree add` + `cd` + `claude` every time.

```bash
# --- Claude Code worktree aliases (paste into ~/.zshrc) ---
za() { _claude_worktree "$1"; }
zb() { _claude_worktree "$1"; }
zc() { _claude_worktree "$1"; }

_claude_worktree() {
  local name="$1"
  if [ -z "$name" ]; then
    echo "usage: za <name> | zb <name> | zc <name>" >&2
    return 1
  fi
  local repo_root
  repo_root=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "not in a git repo" >&2; return 1; }
  local wt="$repo_root/.claude/worktrees/$name"
  if [ ! -d "$wt" ]; then
    git -C "$repo_root" worktree add "$wt" -b "$name" || return 1
  fi
  cd "$wt" && claude
}

# Optional: `zl` to list worktrees, `zd <name>` to drop one
zl() {
  local repo_root
  repo_root=$(git rev-parse --show-toplevel 2>/dev/null) || return 1
  git -C "$repo_root" worktree list
}
zd() {
  local name="$1"
  if [ -z "$name" ]; then
    echo "usage: zd <worktree-name>" >&2
    return 1
  fi
  local repo_root
  repo_root=$(git rev-parse --show-toplevel 2>/dev/null) || return 1
  git -C "$repo_root" worktree remove "$repo_root/.claude/worktrees/$name"
}
# --- end Claude Code worktree aliases ---
```

After pasting, `source ~/.zshrc`. Then from inside any repo:

```bash
za fix-payment-bug       # creates .claude/worktrees/fix-payment-bug, branches off HEAD, opens Claude
zb dob-validation        # second tab: another isolated worktree
zc refactor-billing      # third tab
zl                       # list all worktrees
zd fix-payment-bug       # remove a worktree (does not delete the branch)
```

### Why three letters (`za`/`zb`/`zc`)

Boris uses 5+ concurrent Claudes. Three is a reasonable default for this codebase — you've stated 2-3 in your worktree-naming memory. Add `zd`/`ze` if you start needing more.

The hook `~/.claude/hooks/worktree-create.sh` automatically symlinks `.env*` and `node_modules` from the main repo into the new worktree, so `bun run dev` works immediately.

## NO_FLICKER renderer (for Termius / SSH sessions)

Boris's tip — Claude Code's experimental virtualized renderer. Adds mouse support inside the terminal, eliminates flicker/jump, but breaks native `cmd-F` (use `ctrl+o` then `/` to search).

```bash
# --- Claude Code NO_FLICKER renderer (paste into ~/.zshrc) ---
alias claude-stable='claude'
alias claude-smooth='CLAUDE_CODE_NO_FLICKER=1 claude'
# Use claude-smooth when you want smooth scroll / mouse support
# Use claude-stable (or plain claude) when you need native terminal find/copy
# --- end ---
```

## `--bare` for scripted Claude calls

10× faster startup. Skips CLAUDE.md, settings, MCP discovery. Use in CI or shell scripts where you don't need the full project context.

```bash
# --- Bare claude alias for scripts (paste into ~/.zshrc) ---
alias claude-bare='claude -p --bare --output-format=stream-json --verbose'
# Example:
#   echo "summarize the README" | claude-bare
# --- end ---
```

## TDD-guard one-session toggle

`tdd-guard` is wired in `.claude/settings.local.json` but opt-in via env var. To run an entire session under TDD-guard:

```bash
TDD_GUARD=1 claude
```

Or alias it:

```bash
alias claude-tdd='TDD_GUARD=1 claude'
```

## Verification

After pasting and `source ~/.zshrc`:

```bash
type za zb zc     # should show "function"
type claude-smooth claude-bare claude-tdd  # should show "aliased to ..."
```

If any returns "not found", check that you sourced the right file (`~/.zshrc` for zsh, `~/.bashrc` for bash).
