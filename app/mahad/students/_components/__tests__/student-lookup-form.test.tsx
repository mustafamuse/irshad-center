import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockExecute, useActionSpy, toastError } = vi.hoisted(() => ({
  mockExecute: vi.fn(),
  useActionSpy: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('next-safe-action/hooks', () => ({
  useAction: (...args: unknown[]) => useActionSpy(...args),
}))

vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
  },
}))

vi.mock('../../_actions/lookup', () => ({
  lookupMahadRegistration: vi.fn(),
}))

import { StudentLookupForm } from '../student-lookup-form'

type LookupSuccessData =
  | { found: false }
  | { found: true; registeredAt: string; programStatusLabel: string }

interface ActionError {
  serverError?: string
  validationErrors?: Record<string, unknown>
}

function setupUseAction({ isPending = false }: { isPending?: boolean } = {}) {
  let capturedOnSuccess:
    | ((args: { data?: LookupSuccessData }) => void)
    | undefined
  let capturedOnError: ((args: { error: ActionError }) => void) | undefined

  useActionSpy.mockImplementation(
    (
      _action: unknown,
      options: {
        onSuccess?: (args: { data?: LookupSuccessData }) => void
        onError?: (args: { error: ActionError }) => void
      }
    ) => {
      capturedOnSuccess = options.onSuccess
      capturedOnError = options.onError
      return {
        execute: mockExecute,
        isPending,
      }
    }
  )

  return {
    triggerSuccess: (data: LookupSuccessData) =>
      act(() => {
        capturedOnSuccess?.({ data })
      }),
    triggerError: (error: ActionError) =>
      act(() => {
        capturedOnError?.({ error })
      }),
  }
}

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/legal first name/i), 'Amina')
  await user.type(screen.getByLabelText(/legal last name/i), 'Hassan')
  await user.type(screen.getByLabelText(/last 4 digits/i), '1234')
  await user.click(screen.getByRole('button', { name: /check registration/i }))
}

describe('StudentLookupForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls the lookup action with normalized inputs on valid submit', async () => {
    const user = userEvent.setup()
    setupUseAction()
    render(<StudentLookupForm />)

    await fillAndSubmit(user)

    await waitFor(() => expect(mockExecute).toHaveBeenCalledTimes(1))
    expect(mockExecute).toHaveBeenCalledWith({
      firstName: 'Amina',
      lastName: 'Hassan',
      phoneLast4: '1234',
    })
  })

  it('renders the found card when the action returns a match', async () => {
    const user = userEvent.setup()
    const { triggerSuccess } = setupUseAction()
    render(<StudentLookupForm />)

    await fillAndSubmit(user)
    triggerSuccess({
      found: true,
      registeredAt: '2026-02-15',
      programStatusLabel: 'Enrolled',
    })

    expect(await screen.findByText(/registration on file/i)).toBeInTheDocument()
    expect(screen.getByText('Enrolled')).toBeInTheDocument()
    expect(screen.getByText(/February 15, 2026/)).toBeInTheDocument()
  })

  it('renders the not-found card when the action reports no match', async () => {
    const user = userEvent.setup()
    const { triggerSuccess } = setupUseAction()
    render(<StudentLookupForm />)

    await fillAndSubmit(user)
    triggerSuccess({ found: false })

    expect(
      await screen.findByText(/no registration found/i)
    ).toBeInTheDocument()
  })

  it('surfaces a server error via toast', async () => {
    const user = userEvent.setup()
    const { triggerError } = setupUseAction()
    render(<StudentLookupForm />)

    await fillAndSubmit(user)
    triggerError({
      serverError: 'Too many attempts. Try again later.',
    })

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        'Too many attempts. Try again later.'
      )
    )
  })

  it('marks the submit button busy while the action is pending', () => {
    setupUseAction({ isPending: true })
    render(<StudentLookupForm />)

    const submit = screen.getByRole('button', { name: /checking/i })
    expect(submit).toHaveAttribute('aria-busy', 'true')
    expect(submit).toBeDisabled()
  })
})
