import type { ScholarshipApplicationOutput } from '../_schemas'
import type { ScholarshipPDFData } from '../_templates/pdf/document'

/**
 * Format validated scholarship data for PDF generation
 * Transforms application data into PDF-friendly structure with conditional fields
 *
 * @param formData - Validated and transformed scholarship application data
 * @returns Formatted data ready for PDF document generation
 *
 * @example
 * const pdfData = formatPDFData(validatedData)
 * const pdf = await generateScholarshipPDF(pdfData)
 */
export function formatPDFData(
  formData: ScholarshipApplicationOutput
): ScholarshipPDFData {
  // Use formData directly with proper typing
  const data = formData
  return {
    'Applicant Details': {
      studentName: data.studentName,
      className: data.className,
      email: data.email,
      phone: data.phone,
      payer: data.payer,
      ...(data.payer === 'relative'
        ? {
            payerRelation: data.payerRelation,
            payerName: data.payerName,
            payerPhone: data.payerPhone,
          }
        : {}),
      siblingCount: data.siblingCount,
      monthlyRate: data.monthlyRate,
    },
    'Financial Assessment': {
      educationStatus: data.educationStatus,
      ...(data.educationStatus === 'highschool'
        ? {
            schoolName: data.schoolName,
            schoolYear: data.schoolYear,
          }
        : {}),
      ...(data.educationStatus === 'college'
        ? {
            collegeName: data.collegeName,
            collegeYear: data.collegeYear,
            qualifiesForFafsa: data.qualifiesForFafsa,
            ...(data.qualifiesForFafsa === 'no'
              ? {
                  fafsaExplanation: data.fafsaExplanation,
                }
              : {}),
          }
        : {}),
      householdSize: String(data.householdSize),
      dependents: String(data.dependents),
      adultsInHousehold: String(data.adultsInHousehold),
      livesWithBothParents: data.livesWithBothParents,
      ...(data.livesWithBothParents === 'no'
        ? {
            livingExplanation: data.livingExplanation,
          }
        : {}),
      isEmployed: data.isEmployed,
      ...(data.isEmployed === 'yes'
        ? {
            monthlyIncome: data.monthlyIncome ?? undefined,
          }
        : {}),
    },
    'Scholarship Justification': {
      needJustification: data.needJustification,
      goalSupport: data.goalSupport,
      commitment: data.commitment,
      ...(data.additionalInfo
        ? {
            additionalInfo: data.additionalInfo,
          }
        : {}),
    },
    'Terms Agreement': {
      termsAgreed: data.termsAgreed,
    },
  }
}
