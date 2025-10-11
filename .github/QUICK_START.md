# 🚀 Quick Start: Automated PR Templates

This guide will get you set up with automated PR template selection in 2 minutes.

## ⚡ TL;DR

1. Name your branches correctly: `feature/*`, `fix/*`, `hotfix/*`, `migration/*`
2. Push to GitHub
3. Create PR - template auto-applies
4. Fill out checklist
5. Done! 🎉

## 📋 Step-by-Step Setup

### 1. Install Git Hooks (One-Time, Optional)

Get template suggestions before you even push:

```bash
bash .github/scripts/setup-hooks.sh
```

This installs a pre-push hook that shows which template will be selected.

### 2. Use Branch Naming Conventions

When creating branches, use these prefixes:

```bash
# For new features
git checkout -b feature/your-feature-name

# For bug fixes
git checkout -b fix/your-bug-description

# For urgent hotfixes
git checkout -b hotfix/critical-issue

# For database changes
git checkout -b migration/your-schema-change
```

### 3. Make Your Changes

Work normally - commit, make changes, etc.

### 4. Test Which Template Will Be Selected (Optional)

Before pushing, see which template will be auto-applied:

```bash
node .github/scripts/suggest-pr-template.js
```

You'll see output like:

```
🤖 AI PR Template Suggester
============================================================
📊 Analysis:
  Branch: feature/add-attendance
  Changed files: 15

✨ Recommended Template: FEATURE
  Reason: Feature branch detected
  Template file: .github/PULL_REQUEST_TEMPLATE/feature.md
```

### 5. Push to GitHub

```bash
git push origin your-branch-name
```

If you installed git hooks, you'll see the template suggestion when pushing.

### 6. Create Pull Request

Go to GitHub and click "Create Pull Request"

**Magic happens here! 🪄**

- GitHub Action runs automatically
- Detects your branch name and changes
- Applies the correct template
- Adds a comment explaining the selection

### 7. Fill Out Template

The PR description now has a template with checklists. Just fill it out:

- Check off completed items
- Add descriptions
- Fill in test results
- Add screenshots if needed

### 8. Request Review

Once the checklist is complete, request a review. Done! 🎉

## 🎯 Branch Naming Cheat Sheet

| What You're Doing      | Branch Prefix         | Template Applied         |
| ---------------------- | --------------------- | ------------------------ |
| Adding new feature     | `feature/*`           | ✨ Feature               |
| Fixing a bug           | `fix/*` or `bugfix/*` | 🐛 Bug Fix               |
| Urgent production fix  | `hotfix/*`            | 🔥 Hotfix                |
| Database schema change | `migration/*`         | 🗃️ Database Migration ⚠️ |
| Other changes          | Any name              | 📝 Default               |

## 🔍 Special Cases

### Database Changes

If you modify `prisma/schema.prisma`, the **Database Migration** template is automatically applied, **regardless of your branch name**.

**⚠️ CRITICAL:** Always use `migration/*` branch prefix for clarity!

### Wrong Template Applied?

If the automation picks the wrong template:

1. Edit the PR description
2. Copy/paste the correct template from `.github/PULL_REQUEST_TEMPLATE/`
3. Or append `?template=template_name.md` to the PR URL

## 💡 Pro Tips

### For AI Assistants (Cursor, Claude)

When using AI coding assistants, tell them:

> "Create a feature branch for adding X"

The AI will use proper naming, and automation handles the rest!

### For Urgent Changes

Use `hotfix/` prefix for anything production-critical. This:

- Applies the streamlined Hotfix template
- Signals reviewers this needs immediate attention

### For Database Changes

**ALWAYS** use `migration/*` prefix when touching Prisma schema:

```bash
git checkout -b migration/add-attendance-table
```

This ensures:

- Database Migration template applied
- Extra safety checklists included
- Reviewers know to be extra careful

## ❓ Troubleshooting

### "Template not applied"

- Make sure the GitHub Action has permissions
- Check that your branch name follows conventions
- The Action only runs on PR creation (not on every push)

### "Wrong template applied"

- Manually edit the PR description
- The automation is based on branch naming and file changes
- Use the branch naming cheat sheet above

### "Can't find the script"

Make sure you're in the project root:

```bash
cd /path/to/irshad-center
node .github/scripts/suggest-pr-template.js
```

### "Git hooks not working"

Re-run the setup script:

```bash
bash .github/scripts/setup-hooks.sh
```

## 📚 Learn More

- Full documentation: [`.github/README.md`](.github/README.md)
- Template examples: [`.github/PULL_REQUEST_TEMPLATE/`](.github/PULL_REQUEST_TEMPLATE/)
- Database safety rules: [`/docs/CRITICAL_RULES.md`](/docs/CRITICAL_RULES.md)

## 🎓 Examples

### Example 1: Adding a Feature

```bash
# Create feature branch
git checkout -b feature/add-student-search

# Make changes
# ... code changes ...

# Commit
git commit -m "Add student search functionality"

# Push
git push origin feature/add-student-search

# Create PR on GitHub
# ✅ Feature template auto-applied!
```

### Example 2: Fixing a Bug

```bash
# Create fix branch
git checkout -b fix/payment-calculation-error

# Make changes
# ... fix the bug ...

# Commit
git commit -m "Fix payment calculation rounding error"

# Push
git push origin fix/payment-calculation-error

# Create PR on GitHub
# ✅ Bug Fix template auto-applied!
```

### Example 3: Database Migration

```bash
# Create migration branch
git checkout -b migration/add-attendance-model

# Update schema
# Edit prisma/schema.prisma

# Create migration
npx prisma migrate dev --name add_attendance_model

# Commit
git commit -m "Add Attendance model to schema"

# Push
git push origin migration/add-attendance-model

# Create PR on GitHub
# ✅ Database Migration template auto-applied!
# 🚨 Extra safety checklists included!
```

---

**That's it! You're all set up with automated PR template selection.** 🎉

Questions? Check the [full README](.github/README.md) or ask in Slack!
