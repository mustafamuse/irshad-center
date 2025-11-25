# Chunk-by-Chunk Improvement Workflow

## Quick Start

### 1. Check Overall Status

```bash
./scripts/check-chunk.sh
```

This shows you the error count for each major chunk.

### 2. Review a Specific Chunk

```bash
./scripts/chunk-review.sh "Mahad Services" tsconfig.mahad-services.json
```

This will:

- Count errors in that chunk
- Show error summary by file
- Show first 20 detailed errors
- Save full report to `docs/chunk-reports/`

### 3. Fix the Issues

Work through the errors systematically:

1. Start with the file with the most errors
2. Fix one type of error at a time
3. Run the chunk review script after each fix
4. Verify error count decreases

### 4. Verify No Regressions

```bash
# Check the chunk is clean
npx tsc --noEmit --project tsconfig.mahad-services.json

# Check full codebase hasn't regressed
npx tsc --noEmit
```

### 5. Update Documentation

Update `CODEBASE_IMPROVEMENT_ROADMAP.md`:

- Mark chunk as complete
- Record errors before/after
- List files modified

---

## Available Chunks

| Chunk Name     | Config File                    | Command                                                                   |
| -------------- | ------------------------------ | ------------------------------------------------------------------------- |
| Queries Layer  | `tsconfig.lib-queries.json`    | `./scripts/chunk-review.sh "Queries" tsconfig.lib-queries.json`           |
| Services Layer | `tsconfig.lib-services.json`   | `./scripts/chunk-review.sh "Services" tsconfig.lib-services.json`         |
| Mahad Services | `tsconfig.mahad-services.json` | `./scripts/chunk-review.sh "Mahad Services" tsconfig.mahad-services.json` |
| All lib/       | `tsconfig.lib-all.json`        | `./scripts/chunk-review.sh "Lib All" tsconfig.lib-all.json`               |

---

## Example Workflow: Fixing Mahad Services

### Step 1: Review

```bash
./scripts/chunk-review.sh "Mahad Services" tsconfig.mahad-services.json
```

Output:

```
📋 Chunk Review: Mahad Services
Found: 15 errors

📊 Error summary by file:
   6 lib/services/mahad/enrollment-service.ts
   3 lib/services/mahad/student-service.ts
   3 lib/services/shared/parent-service.ts
   2 lib/services/mahad/cohort-service.ts
   1 lib/db/queries/batch.ts
```

### Step 2: Prioritize

Fix in order of impact:

1. `enrollment-service.ts` (6 errors) - High impact
2. `student-service.ts` (3 errors) - High impact
3. `parent-service.ts` (3 errors) - Shared service
4. `cohort-service.ts` (2 errors) - Medium impact
5. `batch.ts` (1 error) - Low impact

### Step 3: Fix One File at a Time

**Example: enrollment-service.ts**

```bash
# Look at the errors
npx tsc --noEmit --project tsconfig.mahad-services.json 2>&1 | grep "enrollment-service"

# Fix the errors (use Claude Code or manual editing)

# Verify the fix
npx tsc --noEmit --project tsconfig.mahad-services.json 2>&1 | grep "enrollment-service"

# Should show fewer or no errors for that file
```

### Step 4: Re-check After Each Fix

```bash
./scripts/check-chunk.sh
```

Watch the error count decrease!

### Step 5: Final Verification

```bash
# Chunk should be clean
npx tsc --noEmit --project tsconfig.mahad-services.json
# Should output nothing (success!)

# Full codebase check
npx tsc --noEmit 2>&1 | wc -l
# Should be same or lower than before
```

### Step 6: Update Roadmap

Edit `CODEBASE_IMPROVEMENT_ROADMAP.md`:

```markdown
| Mahad Services | 🟢 Complete | 15 | 0 | 3 files |
```

---

## Tips for Success

### 1. **Work in Small Batches**

Fix 1-3 files at a time, not the whole chunk at once.

### 2. **Verify Frequently**

Run the chunk review script after each fix to ensure progress.

### 3. **Don't Break Things**

Always check the full codebase after finishing a chunk:

```bash
npx tsc --noEmit
npm run build  # If it builds successfully
```

### 4. **Document As You Go**

When you find deprecated code or duplicates:

- Add a comment explaining why
- Update the roadmap
- Consider creating a TODO for removal

### 5. **Use Code Review First**

Before fixing, run `/code-review` on the chunk to understand:

- Why errors exist
- What patterns to follow
- What's deprecated vs what's current

---

## Creating New Chunks

To add a new chunk (e.g., "Admin Actions"):

### 1. Create tsconfig

```json
// tsconfig.admin-actions.json
{
  "extends": "./tsconfig.json",
  "include": ["app/admin/**/actions.ts", "lib/**/*"],
  "exclude": ["node_modules", "**/*.test.ts"]
}
```

### 2. Test it

```bash
./scripts/chunk-review.sh "Admin Actions" tsconfig.admin-actions.json
```

### 3. Add to Roadmap

Update `CODEBASE_IMPROVEMENT_ROADMAP.md` with the new chunk.

---

## Troubleshooting

### "Too many errors!"

Break the chunk into smaller pieces:

- Instead of `lib/services/*`, do `lib/services/mahad/*`
- Instead of `app/admin/*`, do `app/admin/dugsi/*`

### "Errors keep coming back"

You might be missing dependencies. Include them in the tsconfig:

```json
{
  "include": [
    "your/chunk/**/*",
    "lib/db/**/*", // Add dependencies
    "lib/types/**/*", // Add dependencies
    "lib/services/shared/**/*" // Add dependencies
  ]
}
```

### "How do I know what to fix?"

Run `/code-review @path/to/chunk` to get AI-powered analysis and recommendations.

---

## Progress Tracking

Create a simple log in `docs/chunk-reports/progress.log`:

```
2025-01-XX: Started chunk-by-chunk approach. Baseline: 14 errors
2025-01-XX: Fixed Mahad Services. 15 errors → 0 errors. Total: 14 → 8
2025-01-XX: Fixed Queries Layer. 1 error → 0 errors. Total: 8 → 7
...
```

---

## Next Steps

Based on current status:

1. 🎯 **Mahad Services** (15 errors) - Clear, isolated, high impact
2. 🎯 **Services Layer** (14 errors) - Broader scope
3. 🎯 **Queries Layer** (1 error) - Quick win!

**Recommended:** Start with **Queries Layer** (1 error) for a quick confidence boost, then tackle **Mahad Services** (15 errors).
