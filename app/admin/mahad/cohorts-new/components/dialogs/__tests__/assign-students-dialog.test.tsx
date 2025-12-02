import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach, beforeAll } from 'vitest'

import {
  createMockBatch,
  createMockStudent,
} from '../../../__tests__/test-helpers'
import { MahadBatch, MahadStudent } from '../../../_types'
import { AssignStudentsDialog } from '../assign-students-dialog'

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn()
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
})

const mockPush = vi.fn()
const mockRefresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}))

const mockCloseDialog = vi.fn()
let mockOpenDialog: string | null = null

vi.mock('../../../store', () => ({
  useDialogState: () => mockOpenDialog,
  useMahadUIStore: (selector: (s: unknown) => unknown) =>
    selector({
      closeDialog: mockCloseDialog,
    }),
}))

const mockAssignStudentsAction = vi.fn()

vi.mock('../../../../cohorts/_actions', () => ({
  assignStudentsAction: (batchId: string, studentIds: string[]) =>
    mockAssignStudentsAction(batchId, studentIds),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}))

describe('AssignStudentsDialog', () => {
  const defaultStudents: MahadStudent[] = [
    createMockStudent({ id: 'student-1', name: 'Alice Smith', batchId: null }),
    createMockStudent({ id: 'student-2', name: 'Bob Jones', batchId: null }),
    createMockStudent({
      id: 'student-3',
      name: 'Charlie Brown',
      batchId: 'existing-batch',
    }),
  ]

  const defaultBatches: MahadBatch[] = [
    createMockBatch({ id: 'batch-1', name: 'Fall 2024', studentCount: 10 }),
    createMockBatch({ id: 'batch-2', name: 'Spring 2025', studentCount: 5 }),
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockOpenDialog = 'assignStudents'
    mockAssignStudentsAction.mockResolvedValue({
      success: true,
      data: { assignedCount: 2, failedAssignments: [] },
    })
  })

  describe('rendering', () => {
    it('renders dialog when open', () => {
      render(
        <AssignStudentsDialog
          students={defaultStudents}
          batches={defaultBatches}
        />
      )
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Assign Students to Batch')).toBeInTheDocument()
    })

    it('does not render dialog when closed', () => {
      mockOpenDialog = null
      render(
        <AssignStudentsDialog
          students={defaultStudents}
          batches={defaultBatches}
        />
      )
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('shows only unassigned students', () => {
      render(
        <AssignStudentsDialog
          students={defaultStudents}
          batches={defaultBatches}
        />
      )
      expect(screen.getByText('Alice Smith')).toBeInTheDocument()
      expect(screen.getByText('Bob Jones')).toBeInTheDocument()
      expect(screen.queryByText('Charlie Brown')).not.toBeInTheDocument()
    })

    it('displays student count correctly', () => {
      render(
        <AssignStudentsDialog
          students={defaultStudents}
          batches={defaultBatches}
        />
      )
      expect(screen.getByText(/0 of 2/)).toBeInTheDocument()
    })

    it('renders batch selector with all batches', async () => {
      const user = userEvent.setup()
      render(
        <AssignStudentsDialog
          students={defaultStudents}
          batches={defaultBatches}
        />
      )

      const trigger = screen.getByRole('combobox')
      await user.click(trigger)

      expect(screen.getByText('Fall 2024 (10 students)')).toBeInTheDocument()
      expect(screen.getByText('Spring 2025 (5 students)')).toBeInTheDocument()
    })
  })

  describe('empty state', () => {
    it('shows empty state when all students are assigned', () => {
      const assignedStudents = [
        createMockStudent({
          id: 'student-1',
          name: 'Alice',
          batchId: 'batch-1',
        }),
      ]

      render(
        <AssignStudentsDialog
          students={assignedStudents}
          batches={defaultBatches}
        />
      )

      expect(
        screen.getByText(/all students are already assigned/i)
      ).toBeInTheDocument()
    })
  })

  describe('student selection', () => {
    it('allows selecting individual students', async () => {
      const user = userEvent.setup()
      render(
        <AssignStudentsDialog
          students={defaultStudents}
          batches={defaultBatches}
        />
      )

      const aliceCheckbox = screen.getByRole('checkbox', { name: /alice/i })
      await user.click(aliceCheckbox)

      expect(aliceCheckbox).toBeChecked()
      expect(screen.getByText(/1 of 2/)).toBeInTheDocument()
    })

    it('allows deselecting students', async () => {
      const user = userEvent.setup()
      render(
        <AssignStudentsDialog
          students={defaultStudents}
          batches={defaultBatches}
        />
      )

      const aliceCheckbox = screen.getByRole('checkbox', { name: /alice/i })
      await user.click(aliceCheckbox)
      expect(aliceCheckbox).toBeChecked()

      await user.click(aliceCheckbox)
      expect(aliceCheckbox).not.toBeChecked()
    })

    it('allows selecting all students', async () => {
      const user = userEvent.setup()
      render(
        <AssignStudentsDialog
          students={defaultStudents}
          batches={defaultBatches}
        />
      )

      const selectAllButton = screen.getByRole('button', {
        name: /select all/i,
      })
      await user.click(selectAllButton)

      expect(screen.getByText(/2 of 2/)).toBeInTheDocument()
      expect(screen.getAllByRole('checkbox', { checked: true })).toHaveLength(2)
    })

    it('allows deselecting all students', async () => {
      const user = userEvent.setup()
      render(
        <AssignStudentsDialog
          students={defaultStudents}
          batches={defaultBatches}
        />
      )

      const selectAllButton = screen.getByRole('button', {
        name: /select all/i,
      })
      await user.click(selectAllButton)

      const deselectAllButton = screen.getByRole('button', {
        name: /deselect all/i,
      })
      await user.click(deselectAllButton)

      expect(screen.getByText(/0 of 2/)).toBeInTheDocument()
    })
  })

  describe('form validation', () => {
    it('disables submit when no batch selected', async () => {
      const user = userEvent.setup()
      render(
        <AssignStudentsDialog
          students={defaultStudents}
          batches={defaultBatches}
        />
      )

      const aliceCheckbox = screen.getByRole('checkbox', { name: /alice/i })
      await user.click(aliceCheckbox)

      const submitButton = screen.getByRole('button', {
        name: /assign 1 student/i,
      })
      expect(submitButton).toBeDisabled()
    })

    it('disables submit when no students selected', async () => {
      const user = userEvent.setup()
      render(
        <AssignStudentsDialog
          students={defaultStudents}
          batches={defaultBatches}
        />
      )

      const trigger = screen.getByRole('combobox')
      await user.click(trigger)
      await user.click(screen.getByText('Fall 2024 (10 students)'))

      const submitButton = screen.getByRole('button', {
        name: /assign 0 student/i,
      })
      expect(submitButton).toBeDisabled()
    })

    it('enables submit when batch and students are selected', async () => {
      const user = userEvent.setup()
      render(
        <AssignStudentsDialog
          students={defaultStudents}
          batches={defaultBatches}
        />
      )

      const trigger = screen.getByRole('combobox')
      await user.click(trigger)
      await user.click(screen.getByText('Fall 2024 (10 students)'))

      const aliceCheckbox = screen.getByRole('checkbox', { name: /alice/i })
      await user.click(aliceCheckbox)

      const submitButton = screen.getByRole('button', {
        name: /assign 1 student to fall 2024/i,
      })
      expect(submitButton).toBeEnabled()
    })
  })

  describe('form submission', () => {
    it('calls assignStudentsAction with correct data', async () => {
      const user = userEvent.setup()
      render(
        <AssignStudentsDialog
          students={defaultStudents}
          batches={defaultBatches}
        />
      )

      const trigger = screen.getByRole('combobox')
      await user.click(trigger)
      await user.click(screen.getByText('Fall 2024 (10 students)'))

      const aliceCheckbox = screen.getByRole('checkbox', { name: /alice/i })
      await user.click(aliceCheckbox)

      const submitButton = screen.getByRole('button', {
        name: /assign 1 student/i,
      })
      await user.click(submitButton)

      expect(mockAssignStudentsAction).toHaveBeenCalledWith('batch-1', [
        'student-1',
      ])
    })

    it('shows success toast and closes dialog on success', async () => {
      const { toast } = await import('sonner')
      const user = userEvent.setup()
      render(
        <AssignStudentsDialog
          students={defaultStudents}
          batches={defaultBatches}
        />
      )

      const trigger = screen.getByRole('combobox')
      await user.click(trigger)
      await user.click(screen.getByText('Fall 2024 (10 students)'))

      await user.click(screen.getByRole('checkbox', { name: /alice/i }))
      await user.click(screen.getByRole('checkbox', { name: /bob/i }))

      await user.click(
        screen.getByRole('button', { name: /assign 2 students/i })
      )

      expect(toast.success).toHaveBeenCalledWith(
        'Successfully assigned 2 students'
      )
      expect(mockCloseDialog).toHaveBeenCalled()
      expect(mockRefresh).toHaveBeenCalled()
    })

    it('shows warning toast on partial success', async () => {
      const { toast } = await import('sonner')
      mockAssignStudentsAction.mockResolvedValue({
        success: true,
        data: {
          assignedCount: 1,
          failedAssignments: ['student-2'],
        },
      })

      const user = userEvent.setup()
      render(
        <AssignStudentsDialog
          students={defaultStudents}
          batches={defaultBatches}
        />
      )

      const trigger = screen.getByRole('combobox')
      await user.click(trigger)
      await user.click(screen.getByText('Fall 2024 (10 students)'))

      await user.click(screen.getByRole('checkbox', { name: /alice/i }))
      await user.click(screen.getByRole('checkbox', { name: /bob/i }))

      await user.click(
        screen.getByRole('button', { name: /assign 2 students/i })
      )

      expect(toast.warning).toHaveBeenCalledWith(
        'Assigned 1 student. 1 failed.'
      )
    })

    it('shows error toast on failure', async () => {
      const { toast } = await import('sonner')
      mockAssignStudentsAction.mockResolvedValue({
        success: false,
        error: 'Assignment failed',
      })

      const user = userEvent.setup()
      render(
        <AssignStudentsDialog
          students={defaultStudents}
          batches={defaultBatches}
        />
      )

      const trigger = screen.getByRole('combobox')
      await user.click(trigger)
      await user.click(screen.getByText('Fall 2024 (10 students)'))

      await user.click(screen.getByRole('checkbox', { name: /alice/i }))

      await user.click(
        screen.getByRole('button', { name: /assign 1 student/i })
      )

      expect(toast.error).toHaveBeenCalledWith('Assignment failed')
    })
  })

  describe('dialog state management', () => {
    it('closes dialog when cancel is clicked', async () => {
      const user = userEvent.setup()
      render(
        <AssignStudentsDialog
          students={defaultStudents}
          batches={defaultBatches}
        />
      )

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      expect(mockCloseDialog).toHaveBeenCalled()
    })

    it('resets selections when dialog closes', async () => {
      const user = userEvent.setup()
      render(
        <AssignStudentsDialog
          students={defaultStudents}
          batches={defaultBatches}
        />
      )

      const aliceCheckbox = screen.getByRole('checkbox', { name: /alice/i })
      await user.click(aliceCheckbox)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      expect(mockCloseDialog).toHaveBeenCalled()
    })
  })

  describe('button text', () => {
    it('shows singular form for one student', async () => {
      const user = userEvent.setup()
      render(
        <AssignStudentsDialog
          students={defaultStudents}
          batches={defaultBatches}
        />
      )

      await user.click(screen.getByRole('checkbox', { name: /alice/i }))

      expect(
        screen.getByRole('button', { name: /assign 1 student$/i })
      ).toBeInTheDocument()
    })

    it('shows plural form for multiple students', async () => {
      const user = userEvent.setup()
      render(
        <AssignStudentsDialog
          students={defaultStudents}
          batches={defaultBatches}
        />
      )

      await user.click(screen.getByRole('checkbox', { name: /alice/i }))
      await user.click(screen.getByRole('checkbox', { name: /bob/i }))

      expect(
        screen.getByRole('button', { name: /assign 2 students/i })
      ).toBeInTheDocument()
    })

    it('shows batch name in button when selected', async () => {
      const user = userEvent.setup()
      render(
        <AssignStudentsDialog
          students={defaultStudents}
          batches={defaultBatches}
        />
      )

      const trigger = screen.getByRole('combobox')
      await user.click(trigger)
      await user.click(screen.getByText('Fall 2024 (10 students)'))

      await user.click(screen.getByRole('checkbox', { name: /alice/i }))

      expect(
        screen.getByRole('button', { name: /to fall 2024/i })
      ).toBeInTheDocument()
    })
  })

  describe('student email display', () => {
    it('shows student email when available', () => {
      const studentsWithEmail = [
        createMockStudent({
          id: 'student-1',
          name: 'Alice Smith',
          email: 'alice@example.com',
          batchId: null,
        }),
      ]

      render(
        <AssignStudentsDialog
          students={studentsWithEmail}
          batches={defaultBatches}
        />
      )

      expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    })

    it('does not show email placeholder when not available', () => {
      const studentsWithoutEmail = [
        createMockStudent({
          id: 'student-1',
          name: 'Alice Smith',
          email: null,
          batchId: null,
        }),
      ]

      render(
        <AssignStudentsDialog
          students={studentsWithoutEmail}
          batches={defaultBatches}
        />
      )

      expect(screen.getByText('Alice Smith')).toBeInTheDocument()
      const studentItem = screen.getByText('Alice Smith').closest('div')
      expect(
        within(studentItem as HTMLElement).queryByText(/@/i)
      ).not.toBeInTheDocument()
    })
  })
})
