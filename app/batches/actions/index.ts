/**
 * Batch Management Server Actions
 *
 * Centralized export of all server actions for batch and student management.
 * Import from this file to access any action in the application.
 */

// Batch actions
export {
  createBatchAction,
  updateBatchAction,
  deleteBatchAction,
} from './batch-actions'

// Student actions
export {
  createStudentAction,
  updateStudentAction,
  deleteStudentAction,
  bulkUpdateStudentStatusAction,
} from './student-actions'

// Assignment actions
export {
  assignStudentsAction,
  transferStudentsAction,
  unassignStudentsAction,
} from './assignment-actions'

// Duplicate resolution actions
export {
  resolveDuplicatesAction,
  batchResolveDuplicatesAction,
} from './duplicate-actions'
