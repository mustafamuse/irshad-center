import { StudentStatus } from '@/lib/types/student'

import { MahadBatch, MahadStudent } from '../_types'

export const createMockStudent = (
  overrides: Partial<MahadStudent> = {}
): MahadStudent => ({
  id: `student-${Math.random().toString(36).slice(2)}`,
  name: 'Test Student',
  email: 'test@example.com',
  phone: '1234567890',
  dateOfBirth: new Date('2000-01-01'),
  gradeLevel: null,
  schoolName: null,
  graduationStatus: null,
  paymentFrequency: null,
  billingType: null,
  paymentNotes: null,
  status: StudentStatus.ENROLLED,
  batchId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  batch: null,
  subscription: null,
  siblingCount: 0,
  ...overrides,
})

export const createMockBatch = (
  overrides: Partial<MahadBatch> = {}
): MahadBatch => ({
  id: `batch-${Math.random().toString(36).slice(2)}`,
  name: 'Test Batch',
  startDate: new Date('2024-09-01'),
  endDate: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  studentCount: 5,
  ...overrides,
})
