import { FieldPath, FieldValues, UseFormReturn } from 'react-hook-form'

/**
 * Maps next-safe-action `validationErrors` (formatted shape) into
 * react-hook-form field errors via `setError`.
 *
 * Expected shape (recursive) — produced by `returnValidationErrors` /
 * `formatValidationErrors`:
 *   { _errors?: string[], [field]: { _errors?: string[], ... } }
 *
 * - Top-level `_errors` are attached to the form as a root error.
 * - Nested objects are walked recursively and joined with `.`, matching
 *   the dot-notation used by react-hook-form for nested field paths.
 */
type ValidationErrorNode = {
  _errors?: string[]
  [key: string]: unknown
}

export function applySafeActionValidationErrorsToForm<T extends FieldValues>(
  form: UseFormReturn<T>,
  validationErrors: Record<string, unknown> | undefined
): void {
  if (!validationErrors) return

  walk(validationErrors as ValidationErrorNode, '', form)
}

function walk<T extends FieldValues>(
  node: ValidationErrorNode,
  path: string,
  form: UseFormReturn<T>,
  depth = 0
): void {
  if (depth > 6) return

  const rootMessage = node._errors?.[0]
  if (rootMessage) {
    if (path === '') {
      form.setError('root', { type: 'manual', message: rootMessage })
    } else {
      form.setError(path as FieldPath<T>, {
        type: 'manual',
        message: rootMessage,
      })
    }
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === '_errors') continue
    if (!value || typeof value !== 'object') continue

    const nextPath = path === '' ? key : `${path}.${key}`
    walk(value as ValidationErrorNode, nextPath, form, depth + 1)
  }
}
