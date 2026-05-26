---
description: Use when editing app/dugsi/**/actions.ts, app/admin/dugsi/**/actions.ts, or lib/safe-action.ts. Phase 4 of the next-safe-action v8 migration covers splitting dugsi actions into teachers vs admin.
paths:
  - app/dugsi/**
  - app/admin/dugsi/**
  - lib/safe-action.ts
---

# next-safe-action v8 migration (Phase 4)

Per `~/.claude/projects/-Users-mustafamuse-dev-irshad-center/memory/project_next_safe_action_migration.md`: Phases 1-3 are done. **Phase 4** = `dugsi/teachers/actions.ts` + `dugsi/actions.ts` split.

## The pattern

```ts
'use server'
import { after } from 'next/server'
import { adminActionClient } from '@/lib/safe-action'
import { mySchema } from './schema'

const _myAction = adminActionClient
  .metadata({ actionName: 'myAction' })
  .schema(mySchema)
  .action(async ({ parsedInput }) => {
    // mutation here
    after(() => {
      revalidatePath('/admin/dugsi/students')
    })
    return { data: result }
  })

export const myAction = _myAction
```

## Client variants

- `adminActionClient` — admin only, calls `assertAdmin()`
- `rateLimitedActionClient` — public-facing, rate-limited (no-op when Upstash env vars absent)
- Use the right one — swapping is a security regression

## Return shape (v8)

Server actions return `{ data, serverError, validationErrors }`. **All three** must be handled in client code.

```tsx
const { execute, result, isPending } = useAction(myAction)
// result.data, result.serverError, result.validationErrors
```

## Phase 4 checklist

- [ ] `app/dugsi/teachers/actions.ts` — split from `app/dugsi/actions.ts`
- [ ] Each action wrapped in `adminActionClient` or `rateLimitedActionClient`
- [ ] Zod schema in colocated `schema.ts`
- [ ] No direct `prisma.*` calls — go through query layer (`lib/db/queries/`)
- [ ] Tests use new return shape `{ data, serverError, validationErrors }`
- [ ] `revalidatePath` happens in `after()` (server-side, post-response)

## Gotchas

- `assertAdmin()` throws — don't swallow the throw. Let `adminActionClient` catch it and convert to `serverError`
- `metadata({ actionName })` is used by error logging and rate limiter — must be unique per action
- Server actions cannot call other server actions directly; share logic via service-layer functions in `lib/services/`
- Tests that mock `adminActionClient` must also mock `assertAdmin` (per recent commits: `edc92dd0 fix: add assertAdmin mock to teacher details test`)
- The rate limiter's `fromEnv()` guard means absent env vars produce silent no-ops in test — verify production env has `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
