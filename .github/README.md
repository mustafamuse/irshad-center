# GitHub Templates

This directory contains templates for Pull Requests and Issues to ensure consistency and quality across the project.

## 🤖 Automated PR Template Selection

**Good news!** You don't need to manually select templates. Our automation handles it for you!

### How It Works

1. **Name your branch** using our conventions (see below)
2. **Push your changes** to GitHub
3. **Create a PR** - the GitHub Action automatically detects and applies the right template
4. **Fill out the template** - just complete the checklist
5. **Request review** - you're done!

### Branch Naming Conventions

Use these prefixes to automatically trigger the correct template:

| Branch Prefix                    | Template Applied      | Example                          |
| -------------------------------- | --------------------- | -------------------------------- |
| `feature/*` or `feat/*`          | ✨ Feature            | `feature/add-attendance`         |
| `fix/*` or `bugfix/*` or `bug/*` | 🐛 Bug Fix            | `fix/payment-error`              |
| `hotfix/*` or `emergency/*`      | 🔥 Hotfix             | `hotfix/critical-stripe-issue`   |
| `migration/*` or `database/*`    | 🗃️ Database Migration | `migration/add-attendance-table` |
| Anything else                    | 📝 Default            | `update-readme`                  |

**Special Detection:**

- If you modify `prisma/schema.prisma` → **Database Migration** template (regardless of branch name)
- Keywords like "urgent", "critical" → **Hotfix** template

### Setup (One-Time)

Install the git hooks for local suggestions:

```bash
bash .github/scripts/setup-hooks.sh
```

This adds a helpful pre-push hook that shows you which template will be selected before you even create the PR!

## Pull Request Templates

We use multiple PR templates for different scenarios. The GitHub Action automatically selects the right one:

### Available Templates

1. **Default Template** (`PULL_REQUEST_TEMPLATE.md`)
   - General purpose template
   - Use when no specific template fits
   - Includes all checklists

2. **🐛 Bug Fix** (`PULL_REQUEST_TEMPLATE/bug_fix.md`)
   - For fixing bugs
   - Requires reproduction steps
   - Focuses on before/after behavior

3. **✨ New Feature** (`PULL_REQUEST_TEMPLATE/feature.md`)
   - For adding new features
   - Detailed implementation docs
   - User impact assessment

4. **🗃️ Database Migration** (`PULL_REQUEST_TEMPLATE/database_migration.md`)
   - **CRITICAL**: For any database schema changes
   - Extra safety checklists
   - Requires rollback plan
   - Mandatory for Prisma schema changes

5. **🔥 Hotfix** (`PULL_REQUEST_TEMPLATE/hotfix.md`)
   - For critical production issues
   - Fast-tracked review process
   - Requires immediate attention

## How to Use Templates

### 🤖 Automatic (Recommended)

**Just use proper branch naming!** The GitHub Action will automatically select and apply the template when you create a PR. No manual selection needed!

### 🧪 Test Locally (Optional)

Before pushing, check which template will be selected:

```bash
node .github/scripts/suggest-pr-template.js
```

This shows you which template will be auto-applied based on your branch name and changes.

### 🛠️ Manual Override (If Needed)

If the automation selects the wrong template, you can manually change it:

#### Via GitHub URL

Append the template name when creating a PR:

```
?template=bug_fix.md
?template=feature.md
?template=database_migration.md
?template=hotfix.md
```

#### Via GitHub UI

Click "Preview" when creating a PR to see template options in the dropdown.

#### Edit PR Description

Simply replace the auto-applied template with another one from `.github/PULL_REQUEST_TEMPLATE/`.

## Important Reminders

### Database Safety Rules 🔒

- **NEVER reset the database**
- **NEVER delete or drop tables**
- **Schema changes must be additive only**
- Always use the **Database Migration template** for schema changes
- See `/docs/CRITICAL_RULES.md` for full rules

### Code Quality Standards

- Follow TypeScript and Next.js best practices
- Minimize 'use client' usage
- Use Server Components by default
- Add proper TypeScript types
- Handle errors and loading states

### Before Submitting

- [ ] Self-review your code
- [ ] Run linter and fix all errors
- [ ] Test on multiple devices (mobile/tablet/desktop)
- [ ] Verify database safety rules
- [ ] Add screenshots for UI changes

## Need Help?

If you're unsure which template to use, ask yourself:

- Does it touch the database? → Use **Database Migration**
- Is it critical and urgent? → Use **Hotfix**
- Is it a bug? → Use **Bug Fix**
- Is it new functionality? → Use **Feature**
- Everything else → Use **Default**

## 🏗️ Automation Architecture

### How the Automation Works

The PR template automation consists of three components:

1. **GitHub Action** (`.github/workflows/auto-select-pr-template.yml`)
   - Triggers when a PR is opened
   - Analyzes branch name and changed files
   - Detects Prisma schema changes automatically
   - Updates the PR description with the appropriate template
   - Adds a helpful comment explaining the selection

2. **Local Suggester Script** (`.github/scripts/suggest-pr-template.js`)
   - Run manually or via git hooks
   - Shows which template will be selected before creating PR
   - Provides instant feedback on branch naming
   - Warns about critical database changes

3. **Git Hooks** (`.github/hooks/pre-push`)
   - Optional local enhancement
   - Runs before pushing
   - Shows template suggestion in terminal
   - Install with: `bash .github/scripts/setup-hooks.sh`

### Template Selection Logic

The automation follows this priority order:

1. **🗃️ Database Migration** (Priority: 10/10)
   - Detects: `prisma/schema.prisma` changes
   - Branch names: `migration/*`, `database/*`, `schema/*`
   - Keywords: "migration", "database", "schema"

2. **🔥 Hotfix** (Priority: 9/10)
   - Branch names: `hotfix/*`, `emergency/*`
   - Keywords: "urgent", "critical", "hotfix"

3. **🐛 Bug Fix** (Priority: 5/10)
   - Branch names: `fix/*`, `bugfix/*`, `bug/*`
   - Keywords: "fix", "bug"

4. **✨ Feature** (Priority: 3/10)
   - Branch names: `feature/*`, `feat/*`
   - Keywords: "feature", "add"

5. **📝 Default** (Priority: 1/10)
   - Everything else

### For AI Assistants (Cursor, Claude, etc.)

When helping users create PRs, AI assistants should:

1. **Use branch naming conventions** from the table above
2. **Check for Prisma changes** - always use `migration/*` branch prefix
3. **Let automation handle template selection** - don't ask users to choose
4. **Remind about database safety** if schema changes detected
5. **Reference this README** for branch naming patterns

Example AI workflow:

```
User: "Add attendance feature"
AI: Creates branch "feature/add-attendance"
AI: Makes changes...
AI: Pushes to GitHub
GitHub Action: Auto-applies Feature template ✅
```

## Contributing

Feel free to suggest improvements to these templates or automation by opening an issue or PR!
