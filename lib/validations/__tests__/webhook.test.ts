import { describe, expect, it } from 'vitest'

import { webhookStudentNameSchema } from '../webhook'

describe('webhookStudentNameSchema', () => {
  it('accepts Arabic names', () => {
    expect(webhookStudentNameSchema.safeParse('محمد علي').success).toBe(true)
    expect(webhookStudentNameSchema.safeParse('فاطمة').success).toBe(true)
  })

  it('accepts accented Latin names', () => {
    expect(webhookStudentNameSchema.safeParse('José').success).toBe(true)
    expect(webhookStudentNameSchema.safeParse('Müller').success).toBe(true)
  })

  it('rejects names with special characters', () => {
    expect(webhookStudentNameSchema.safeParse('John@Doe').success).toBe(false)
  })

  it('rejects names with numbers', () => {
    expect(webhookStudentNameSchema.safeParse('John123').success).toBe(false)
  })
})
