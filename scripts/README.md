# Code Review Scripts

Automated code review tools for analyzing codebases and generating comprehensive architectural reviews.

## 🚀 Quick Start

```bash
# Review a folder
./scripts/code-review.sh app/admin/attendance

# Save analysis to file
./scripts/code-review.sh app/admin/attendance analysis.md
```

## 📁 Scripts

### `code-review.sh`

Main analysis script that generates:

- File structure analysis
- Import/export patterns
- Code quality metrics
- Issue detection
- Claude Code review prompt

### `claude-code-reviewer.md`

Specialized agent prompt for comprehensive reviews

## 🔍 Analysis Features

- **File Types**: `.ts`, `.tsx`, `.js`, `.jsx`, `.json`, `.md`
- **Metrics**: File counts, complexity, test coverage
- **Issues**: TODOs, debug statements, TypeScript errors
- **Architecture**: Component patterns, dependencies

## 💡 Usage Examples

```bash
./scripts/code-review.sh src/components
./scripts/code-review.sh app full-review.md
./scripts/code-review.sh lib/utils
```

## 🤖 With Claude Code

1. Run analysis: `./scripts/code-review.sh your/folder`
2. Use generated prompt in Claude Code
3. Get comprehensive architectural review

## 📊 Output

Creates analysis files in `/tmp/code-review-[timestamp]/`:

- Summary report
- Detailed findings
- Claude Code prompt
- Raw analysis data
