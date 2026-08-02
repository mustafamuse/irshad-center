import { describe, expect, it } from 'vitest'

import { scholarshipApplicationSchema } from '../index'

const validApplication = {
  studentName: 'Abdi Hassan',
  className: 'Year 1',
  email: 'abdi@example.com',
  phone: '6125551234',
  payer: 'self',
  educationStatus: 'not-studying',
  householdSize: '5',
  dependents: '2',
  adultsInHousehold: '2',
  livesWithBothParents: 'yes',
  isEmployed: 'no',
  needJustification: 'a'.repeat(60),
  goalSupport: 'a'.repeat(60),
  commitment: 'a'.repeat(60),
  termsAgreed: true,
}

describe('scholarshipApplicationSchema conditional refinements', () => {
  it('accepts a valid self-payer application', () => {
    expect(
      scholarshipApplicationSchema.safeParse(validApplication).success
    ).toBe(true)
  })

  it('rejects payer=relative without payer contact fields', () => {
    const result = scholarshipApplicationSchema.safeParse({
      ...validApplication,
      payer: 'relative',
    })
    expect(result.success).toBe(false)
  })

  it('accepts payer=relative with complete payer info', () => {
    const result = scholarshipApplicationSchema.safeParse({
      ...validApplication,
      payer: 'relative',
      payerRelation: 'Uncle',
      payerName: 'Omar Hassan',
      payerPhone: '6125555678',
    })
    expect(result.success).toBe(true)
  })

  it('rejects highschool status without school name and year', () => {
    const result = scholarshipApplicationSchema.safeParse({
      ...validApplication,
      educationStatus: 'highschool',
    })
    expect(result.success).toBe(false)
  })

  it('rejects college status without a FAFSA answer', () => {
    const result = scholarshipApplicationSchema.safeParse({
      ...validApplication,
      educationStatus: 'college',
      collegeName: 'U of M',
      collegeYear: 'Freshman',
    })
    expect(result.success).toBe(false)
  })

  it('accepts college status with FAFSA answer', () => {
    const result = scholarshipApplicationSchema.safeParse({
      ...validApplication,
      educationStatus: 'college',
      collegeName: 'U of M',
      collegeYear: 'Freshman',
      qualifiesForFafsa: 'yes',
    })
    expect(result.success).toBe(true)
  })

  it('rejects livesWithBothParents=no without an explanation', () => {
    const result = scholarshipApplicationSchema.safeParse({
      ...validApplication,
      livesWithBothParents: 'no',
    })
    expect(result.success).toBe(false)
  })

  it('rejects isEmployed=yes without monthly income', () => {
    const result = scholarshipApplicationSchema.safeParse({
      ...validApplication,
      isEmployed: 'yes',
    })
    expect(result.success).toBe(false)
  })

  it('accepts isEmployed=yes with monthly income', () => {
    const result = scholarshipApplicationSchema.safeParse({
      ...validApplication,
      isEmployed: 'yes',
      monthlyIncome: 1200,
    })
    expect(result.success).toBe(true)
  })
})
