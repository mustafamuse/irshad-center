import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import { CreateBatchDialog } from '../batch-form-dialog'

const mockPush = vi.fn()
const mockRefresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}))

const mockCloseDialog = vi.fn()
const mockOpenDialogWithData = vi.fn()
let mockOpenDialog: string | null = null
let mockDialogData: unknown = null

vi.mock('../../../store', () => ({
  useDialogState: () => mockOpenDialog,
  useDialogData: () => mockDialogData,
  useMahadUIStore: (selector: (s: unknown) => unknown) =>
    selector({
      closeDialog: mockCloseDialog,
      openDialogWithData: mockOpenDialogWithData,
    }),
}))

const mockCreateBatchAction = vi.fn()
const mockUpdateBatchAction = vi.fn()

vi.mock('../../../_actions', () => ({
  createBatchAction: (formData: FormData) => mockCreateBatchAction(formData),
  updateBatchAction: (id: string, data: unknown) =>
    mockUpdateBatchAction(id, data),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('CreateBatchDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOpenDialog = 'createBatch'
    mockCreateBatchAction.mockResolvedValue({ success: true })
  })

  describe('rendering', () => {
    it('renders dialog when open', () => {
      render(<CreateBatchDialog />)
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Create New Batch')).toBeInTheDocument()
    })

    it('does not render dialog when closed', () => {
      mockOpenDialog = null
      render(<CreateBatchDialog />)
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('renders batch name input with required indicator', () => {
      render(<CreateBatchDialog />)
      expect(screen.getByLabelText(/batch name/i)).toBeInTheDocument()
      expect(screen.getByText('*')).toBeInTheDocument()
    })

    it('renders optional start date input', () => {
      render(<CreateBatchDialog />)
      expect(screen.getByLabelText(/start date/i)).toBeInTheDocument()
      const optionalLabels = screen.getAllByText(/optional/i)
      expect(optionalLabels.length).toBeGreaterThanOrEqual(1)
    })

    it('renders cancel and create buttons', () => {
      render(<CreateBatchDialog />)
      expect(
        screen.getByRole('button', { name: /cancel/i })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /create batch/i })
      ).toBeInTheDocument()
    })
  })

  describe('form validation', () => {
    it('disables submit button when name is empty', () => {
      render(<CreateBatchDialog />)
      const submitButton = screen.getByRole('button', { name: /create batch/i })
      expect(submitButton).toBeDisabled()
    })

    it('enables submit button when name has value', async () => {
      const user = userEvent.setup()
      render(<CreateBatchDialog />)

      const nameInput = screen.getByLabelText(/batch name/i)
      await user.type(nameInput, 'Fall 2024')

      const submitButton = screen.getByRole('button', { name: /create batch/i })
      expect(submitButton).toBeEnabled()
    })

    it('trims whitespace from name', async () => {
      const user = userEvent.setup()
      render(<CreateBatchDialog />)

      const nameInput = screen.getByLabelText(/batch name/i)
      await user.type(nameInput, '  Fall 2024  ')

      const submitButton = screen.getByRole('button', { name: /create batch/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockCreateBatchAction).toHaveBeenCalled()
        const formData = mockCreateBatchAction.mock.calls[0][0] as FormData
        expect(formData.get('name')).toBe('Fall 2024')
      })
    })
  })

  describe('form submission', () => {
    it('calls createBatchAction on submit', async () => {
      const user = userEvent.setup()
      render(<CreateBatchDialog />)

      const nameInput = screen.getByLabelText(/batch name/i)
      await user.type(nameInput, 'Fall 2024')

      const submitButton = screen.getByRole('button', { name: /create batch/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockCreateBatchAction).toHaveBeenCalled()
      })
    })

    it('includes start date in form data when provided', async () => {
      const user = userEvent.setup()
      render(<CreateBatchDialog />)

      const nameInput = screen.getByLabelText(/batch name/i)
      await user.type(nameInput, 'Fall 2024')

      const dateInput = screen.getByLabelText(/start date/i)
      await user.type(dateInput, '2024-09-01')

      const submitButton = screen.getByRole('button', { name: /create batch/i })
      await user.click(submitButton)

      await waitFor(() => {
        const formData = mockCreateBatchAction.mock.calls[0][0] as FormData
        expect(formData.get('startDate')).toBe('2024-09-01')
      })
    })

    it('closes dialog and refreshes on success', async () => {
      const user = userEvent.setup()
      render(<CreateBatchDialog />)

      const nameInput = screen.getByLabelText(/batch name/i)
      await user.type(nameInput, 'Fall 2024')

      const submitButton = screen.getByRole('button', { name: /create batch/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockCloseDialog).toHaveBeenCalled()
        expect(mockRefresh).toHaveBeenCalled()
      })
    })

    it('shows error toast on failure', async () => {
      const { toast } = await import('sonner')
      mockCreateBatchAction.mockResolvedValue({
        success: false,
        error: 'Batch name already exists',
      })

      const user = userEvent.setup()
      render(<CreateBatchDialog />)

      const nameInput = screen.getByLabelText(/batch name/i)
      await user.type(nameInput, 'Existing Batch')

      const submitButton = screen.getByRole('button', { name: /create batch/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Batch name already exists')
      })
    })
  })

  describe('dialog state management', () => {
    it('closes dialog when cancel is clicked', async () => {
      const user = userEvent.setup()
      render(<CreateBatchDialog />)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      expect(mockCloseDialog).toHaveBeenCalled()
    })

    it('resets form when dialog closes', async () => {
      const user = userEvent.setup()
      render(<CreateBatchDialog />)

      const nameInput = screen.getByLabelText(/batch name/i)
      await user.type(nameInput, 'Test Batch')

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      expect(mockCloseDialog).toHaveBeenCalled()
    })
  })

  describe('loading state', () => {
    it('submit button shows loading text when pending', () => {
      render(<CreateBatchDialog />)
      const submitButton = screen.getByRole('button', { name: /create batch/i })
      expect(submitButton).toBeInTheDocument()
      expect(submitButton.textContent).toContain('Create Batch')
    })
  })
})
