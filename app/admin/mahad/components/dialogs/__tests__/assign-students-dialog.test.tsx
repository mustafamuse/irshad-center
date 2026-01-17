import { render, screen } from '@testing-library/react'
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

const mockRefresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: mockRefresh }),
}))

const mockCloseDialog = vi.fn()
let mockDialogType: 'assignStudents' | null = null

vi.mock('../../../store', () => ({
  useDialogType: () => mockDialogType,
  useMahadUIStore: (
    selector: (s: { closeDialog: typeof mockCloseDialog }) => unknown
  ) => selector({ closeDialog: mockCloseDialog }),
}))

const mockAssignStudentsAction = vi.fn()

vi.mock('../../../_actions', () => ({
  assignStudentsAction: (batchId: string, studentIds: string[]) =>
    mockAssignStudentsAction(batchId, studentIds),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
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

  function renderDialog(
    students: MahadStudent[] = defaultStudents,
    batches: MahadBatch[] = defaultBatches
  ) {
    const user = userEvent.setup()
    render(<AssignStudentsDialog students={students} batches={batches} />)
    return {
      user,
      selectBatch: async (batchName = 'Fall 2024 (10 students)') => {
        await user.click(screen.getByRole('combobox'))
        await user.click(screen.getByText(batchName))
      },
      clickStudent: (name: RegExp) =>
        user.click(screen.getByRole('checkbox', { name })),
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockDialogType = 'assignStudents'
    mockAssignStudentsAction.mockResolvedValue({
      success: true,
      data: { assignedCount: 2, failedAssignments: [] },
    })
  })

  describe('rendering', () => {
    it('renders dialog when open', () => {
      renderDialog()
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Assign Students to Batch')).toBeInTheDocument()
    })

    it('does not render dialog when closed', () => {
      mockDialogType = null
      renderDialog()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('shows only unassigned students', () => {
      renderDialog()
      expect(screen.getByText('Alice Smith')).toBeInTheDocument()
      expect(screen.getByText('Bob Jones')).toBeInTheDocument()
      expect(screen.queryByText('Charlie Brown')).not.toBeInTheDocument()
    })

    it('displays student count correctly', () => {
      renderDialog()
      expect(screen.getByText(/0 of 2/)).toBeInTheDocument()
    })

    it('renders batch selector with all batches', async () => {
      const { user } = renderDialog()
      await user.click(screen.getByRole('combobox'))
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
      renderDialog(assignedStudents)
      expect(
        screen.getByText(/all students are already assigned/i)
      ).toBeInTheDocument()
    })
  })

  describe('student selection', () => {
    it('allows selecting individual students', async () => {
      const { clickStudent } = renderDialog()
      const aliceCheckbox = screen.getByRole('checkbox', { name: /alice/i })
      await clickStudent(/alice/i)
      expect(aliceCheckbox).toBeChecked()
      expect(screen.getByText(/1 of 2/)).toBeInTheDocument()
    })

    it('allows deselecting students', async () => {
      const { clickStudent } = renderDialog()
      const aliceCheckbox = screen.getByRole('checkbox', { name: /alice/i })
      await clickStudent(/alice/i)
      expect(aliceCheckbox).toBeChecked()
      await clickStudent(/alice/i)
      expect(aliceCheckbox).not.toBeChecked()
    })

    it('allows selecting all students', async () => {
      const { user } = renderDialog()
      await user.click(screen.getByRole('button', { name: /select all/i }))
      expect(screen.getByText(/2 of 2/)).toBeInTheDocument()
      expect(screen.getAllByRole('checkbox', { checked: true })).toHaveLength(2)
    })

    it('allows deselecting all students', async () => {
      const { user } = renderDialog()
      await user.click(screen.getByRole('button', { name: /select all/i }))
      await user.click(screen.getByRole('button', { name: /deselect all/i }))
      expect(screen.getByText(/0 of 2/)).toBeInTheDocument()
    })
  })

  describe('form validation', () => {
    it('disables submit when no batch selected', async () => {
      const { clickStudent } = renderDialog()
      await clickStudent(/alice/i)
      expect(
        screen.getByRole('button', { name: /assign 1 student/i })
      ).toBeDisabled()
    })

    it('disables submit when no students selected', async () => {
      const { selectBatch } = renderDialog()
      await selectBatch()
      expect(
        screen.getByRole('button', { name: /assign 0 student/i })
      ).toBeDisabled()
    })

    it('enables submit when batch and students are selected', async () => {
      const { selectBatch, clickStudent } = renderDialog()
      await selectBatch()
      await clickStudent(/alice/i)
      expect(
        screen.getByRole('button', { name: /assign 1 student to fall 2024/i })
      ).toBeEnabled()
    })
  })

  describe('form submission', () => {
    it('calls assignStudentsAction with correct data', async () => {
      const { selectBatch, clickStudent, user } = renderDialog()
      await selectBatch()
      await clickStudent(/alice/i)
      await user.click(
        screen.getByRole('button', { name: /assign 1 student/i })
      )
      expect(mockAssignStudentsAction).toHaveBeenCalledWith('batch-1', [
        'student-1',
      ])
    })

    it('shows success toast and closes dialog on success', async () => {
      const { toast } = await import('sonner')
      const { selectBatch, clickStudent, user } = renderDialog()
      await selectBatch()
      await clickStudent(/alice/i)
      await clickStudent(/bob/i)
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
        data: { assignedCount: 1, failedAssignments: ['student-2'] },
      })
      const { selectBatch, clickStudent, user } = renderDialog()
      await selectBatch()
      await clickStudent(/alice/i)
      await clickStudent(/bob/i)
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
      const { selectBatch, clickStudent, user } = renderDialog()
      await selectBatch()
      await clickStudent(/alice/i)
      await user.click(
        screen.getByRole('button', { name: /assign 1 student/i })
      )
      expect(toast.error).toHaveBeenCalledWith('Assignment failed')
    })
  })

  describe('dialog state management', () => {
    it('closes dialog when cancel is clicked', async () => {
      const { user } = renderDialog()
      await user.click(screen.getByRole('button', { name: /cancel/i }))
      expect(mockCloseDialog).toHaveBeenCalled()
    })

    it('resets selections when dialog closes', async () => {
      const { clickStudent, user } = renderDialog()
      await clickStudent(/alice/i)
      await user.click(screen.getByRole('button', { name: /cancel/i }))
      expect(mockCloseDialog).toHaveBeenCalled()
    })
  })

  describe('button text', () => {
    it('shows singular form for one student', async () => {
      const { clickStudent } = renderDialog()
      await clickStudent(/alice/i)
      expect(
        screen.getByRole('button', { name: /assign 1 student$/i })
      ).toBeInTheDocument()
    })

    it('shows plural form for multiple students', async () => {
      const { clickStudent } = renderDialog()
      await clickStudent(/alice/i)
      await clickStudent(/bob/i)
      expect(
        screen.getByRole('button', { name: /assign 2 students/i })
      ).toBeInTheDocument()
    })

    it('shows batch name in button when selected', async () => {
      const { selectBatch, clickStudent } = renderDialog()
      await selectBatch()
      await clickStudent(/alice/i)
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
      renderDialog(studentsWithEmail)
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
      renderDialog(studentsWithoutEmail)
      expect(screen.getByText('Alice Smith')).toBeInTheDocument()
      expect(screen.queryByText(/@/)).not.toBeInTheDocument()
    })
  })
})
