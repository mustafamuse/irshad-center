import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import { MahadBatch } from '../../../_types'
import { CreateBatchDialog } from '../batch-form-dialog'

const mockRefresh = vi.fn()
const mockCloseDialog = vi.fn()
const mockCreateBatchAction = vi.fn()
const mockUpdateBatchAction = vi.fn()

let mockDialogType: 'createBatch' | 'editBatch' | null = null
let mockDialogData: MahadBatch | null = null

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: mockRefresh }),
}))

vi.mock('../../../store', () => ({
  useDialog: () => ({ type: mockDialogType, data: mockDialogData }),
  useMahadUIStore: (
    selector: (s: { closeDialog: typeof mockCloseDialog }) => unknown
  ) => selector({ closeDialog: mockCloseDialog }),
}))

vi.mock('../../../_actions', () => ({
  createBatchAction: (formData: FormData) => mockCreateBatchAction(formData),
  updateBatchAction: (id: string, data: unknown) =>
    mockUpdateBatchAction(id, data),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

function getNameInput(): HTMLInputElement {
  return screen.getByLabelText(/batch name/i) as HTMLInputElement
}

function getSubmitButton(): HTMLButtonElement {
  const isEditMode = mockDialogType === 'editBatch'
  return screen.getByRole('button', {
    name: isEditMode ? /save changes/i : /create batch/i,
  }) as HTMLButtonElement
}

async function fillAndSubmit(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
  options?: { startDate?: string; endDate?: string; clearFirst?: boolean }
): Promise<void> {
  const nameInput = getNameInput()
  if (options?.clearFirst) await user.clear(nameInput)
  await user.type(nameInput, name)

  if (options?.startDate) {
    await user.type(screen.getByLabelText(/start date/i), options.startDate)
  }
  if (options?.endDate) {
    await user.type(screen.getByLabelText(/end date/i), options.endDate)
  }

  await user.click(getSubmitButton())
}

describe('CreateBatchDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDialogType = 'createBatch'
    mockDialogData = null
    mockCreateBatchAction.mockResolvedValue({ success: true })
  })

  describe('rendering', () => {
    it('renders dialog when open', () => {
      render(<CreateBatchDialog />)
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Create New Batch')).toBeInTheDocument()
    })

    it('does not render dialog when closed', () => {
      mockDialogType = null
      render(<CreateBatchDialog />)
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('renders form fields and buttons', () => {
      render(<CreateBatchDialog />)
      expect(getNameInput()).toBeInTheDocument()
      expect(screen.getByText('*')).toBeInTheDocument()
      expect(screen.getByLabelText(/start date/i)).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /cancel/i })
      ).toBeInTheDocument()
      expect(getSubmitButton()).toBeInTheDocument()
    })
  })

  describe('form validation', () => {
    it('disables submit button when name is empty', () => {
      render(<CreateBatchDialog />)
      expect(getSubmitButton()).toBeDisabled()
    })

    it('enables submit button when name has value', async () => {
      const user = userEvent.setup()
      render(<CreateBatchDialog />)
      await user.type(getNameInput(), 'Fall 2024')
      expect(getSubmitButton()).toBeEnabled()
    })

    it('trims whitespace from name', async () => {
      const user = userEvent.setup()
      render(<CreateBatchDialog />)
      await fillAndSubmit(user, '  Fall 2024  ')

      await waitFor(() => {
        const formData = mockCreateBatchAction.mock.calls[0][0] as FormData
        expect(formData.get('name')).toBe('Fall 2024')
      })
    })
  })

  describe('form submission', () => {
    it('calls createBatchAction with form data', async () => {
      const user = userEvent.setup()
      render(<CreateBatchDialog />)
      await fillAndSubmit(user, 'Fall 2024', {
        startDate: '2024-09-01',
        endDate: '2024-12-15',
      })

      await waitFor(() => {
        const formData = mockCreateBatchAction.mock.calls[0][0] as FormData
        expect(formData.get('name')).toBe('Fall 2024')
        expect(formData.get('startDate')).toBe('2024-09-01')
        expect(formData.get('endDate')).toBe('2024-12-15')
      })
    })

    it('closes dialog and refreshes on success', async () => {
      const user = userEvent.setup()
      render(<CreateBatchDialog />)
      await fillAndSubmit(user, 'Fall 2024')

      await waitFor(() => {
        expect(mockCloseDialog).toHaveBeenCalled()
        expect(mockRefresh).toHaveBeenCalled()
      })
    })

    it('shows error toast on failure', async () => {
      mockCreateBatchAction.mockResolvedValue({
        success: false,
        error: 'Batch name already exists',
      })
      const user = userEvent.setup()
      render(<CreateBatchDialog />)
      await fillAndSubmit(user, 'Existing Batch')

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Batch name already exists')
      })
    })
  })

  describe('cancel button', () => {
    it('closes dialog when clicked', async () => {
      const user = userEvent.setup()
      render(<CreateBatchDialog />)
      await user.click(screen.getByRole('button', { name: /cancel/i }))
      expect(mockCloseDialog).toHaveBeenCalled()
    })
  })
})

describe('EditBatchDialog (edit mode)', () => {
  const mockBatch: MahadBatch = {
    id: 'batch-123',
    name: 'Fall 2024',
    startDate: new Date('2024-09-01T12:00:00'),
    endDate: new Date('2024-12-15T12:00:00'),
    createdAt: new Date(),
    updatedAt: new Date(),
    studentCount: 10,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockDialogType = 'editBatch'
    mockDialogData = mockBatch
    mockUpdateBatchAction.mockResolvedValue({ success: true })
  })

  describe('rendering', () => {
    it('renders edit mode UI with pre-populated data', () => {
      render(<CreateBatchDialog />)
      expect(screen.getByText('Edit Batch')).toBeInTheDocument()
      expect(getSubmitButton()).toHaveTextContent(/save changes/i)
      expect(getNameInput().value).toBe('Fall 2024')
      expect(
        (screen.getByLabelText(/start date/i) as HTMLInputElement).value
      ).toBe('2024-09-01')
      expect(
        (screen.getByLabelText(/end date/i) as HTMLInputElement).value
      ).toBe('2024-12-15')
    })
  })

  describe('form submission', () => {
    it('calls updateBatchAction with batch data', async () => {
      const user = userEvent.setup()
      render(<CreateBatchDialog />)
      await user.click(getSubmitButton())

      await waitFor(() => {
        expect(mockUpdateBatchAction).toHaveBeenCalledWith('batch-123', {
          name: 'Fall 2024',
          startDate: expect.any(Date),
          endDate: expect.any(Date),
        })
      })
    })

    it('updates batch with modified values', async () => {
      const user = userEvent.setup()
      render(<CreateBatchDialog />)
      await fillAndSubmit(user, 'Spring 2025', { clearFirst: true })

      await waitFor(() => {
        expect(mockUpdateBatchAction).toHaveBeenCalledWith(
          'batch-123',
          expect.objectContaining({ name: 'Spring 2025' })
        )
      })
    })

    it('closes dialog and shows success toast on success', async () => {
      const user = userEvent.setup()
      render(<CreateBatchDialog />)
      await user.click(getSubmitButton())

      await waitFor(() => {
        expect(mockCloseDialog).toHaveBeenCalled()
        expect(mockRefresh).toHaveBeenCalled()
        expect(toast.success).toHaveBeenCalledWith(
          expect.stringContaining('Fall 2024')
        )
      })
    })

    it('shows error toast on failure', async () => {
      mockUpdateBatchAction.mockResolvedValue({
        success: false,
        error: 'Update failed',
      })
      const user = userEvent.setup()
      render(<CreateBatchDialog />)
      await user.click(getSubmitButton())

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Update failed')
      })
    })
  })
})
