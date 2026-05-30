import type { z } from 'zod'

type ActionHandler = (args: { parsedInput: unknown }) => Promise<unknown>
type NoInputHandler = () => Promise<unknown>

interface AdminActionClientMock {
  metadata: () => AdminActionClientMock
  use: () => AdminActionClientMock
  schema: (schema: z.ZodType) => {
    action: (handler: ActionHandler) => (input: unknown) => Promise<unknown>
  }
  action: (handler: NoInputHandler) => () => Promise<unknown>
}

export function createAdminActionClientMock(): AdminActionClientMock {
  const client: AdminActionClientMock = {
    metadata: () => client,
    use: () => client,
    schema: (schema: z.ZodType) => ({
      action: (handler: ActionHandler) => async (input: unknown) => {
        const parsed = schema.safeParse(input)
        if (!parsed.success) {
          return { validationErrors: parsed.error.flatten().fieldErrors }
        }
        try {
          const data = await handler({ parsedInput: parsed.data })
          return { data }
        } catch (error) {
          const { ActionError } = await import('@/lib/errors/action-error')
          if (error instanceof ActionError) return { serverError: error.message }
          return { serverError: 'Something went wrong' }
        }
      },
    }),
    action: (handler: NoInputHandler) => async () => {
      try {
        const data = await handler()
        return { data }
      } catch (error) {
        const { ActionError } = await import('@/lib/errors/action-error')
        if (error instanceof ActionError) return { serverError: error.message }
        return { serverError: 'Something went wrong' }
      }
    },
  }
  return client
}
