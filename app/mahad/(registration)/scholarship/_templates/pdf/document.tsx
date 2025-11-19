import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { format } from 'date-fns'

export interface ScholarshipPDFData {
  'Applicant Details': {
    studentName: string
    className: string
    email: string
    phone: string
    payer: string
    payerRelation?: string
    payerName?: string
    payerPhone?: string
    siblingCount?: number
    monthlyRate?: number
  }
  'Financial Assessment': {
    educationStatus: string
    schoolName?: string
    schoolYear?: string
    collegeName?: string
    collegeYear?: string
    qualifiesForFafsa?: string
    fafsaExplanation?: string
    householdSize: string
    dependents: string
    adultsInHousehold: string
    livesWithBothParents: string
    livingExplanation?: string
    isEmployed: string
    monthlyIncome?: number
  }
  'Scholarship Justification': {
    needJustification: string
    goalSupport: string
    commitment: string
    additionalInfo?: string
  }
  'Terms Agreement': {
    termsAgreed: boolean
  }
}

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: '48 72',
    fontSize: 11,
    fontFamily: 'Times-Roman',
    lineHeight: 1.4,
  },
  header: {
    marginBottom: 24,
  },
  date: {
    textAlign: 'right',
    fontSize: 11,
    marginBottom: 24,
    fontFamily: 'Times-Roman',
  },
  salutation: {
    marginBottom: 16,
    fontSize: 11,
    fontFamily: 'Times-Roman',
  },
  paragraph: {
    marginBottom: 12,
    textAlign: 'justify',
    fontSize: 11,
    fontFamily: 'Times-Roman',
    lineHeight: 1.4,
  },
  signatureBlock: {
    marginTop: 16,
  },
  sincerely: {
    marginBottom: 24,
    fontSize: 11,
    fontFamily: 'Times-Roman',
  },
  signatureName: {
    fontSize: 11,
    fontFamily: 'Times-Bold',
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 72,
    right: 72,
    textAlign: 'center',
    fontSize: 8,
    color: '#666666',
    borderTop: '1 solid #cccccc',
    paddingTop: 8,
  },
})

interface Props {
  data: ScholarshipPDFData
}

export function ScholarshipPDFDocument({ data }: Props) {
  const {
    studentName,
    className,
    email,
    phone,
    payer,
    payerRelation,
    payerName,
    payerPhone,
    siblingCount = 0,
    monthlyRate = 0,
  } = data['Applicant Details']

  const {
    educationStatus,
    schoolName,
    schoolYear,
    collegeName,
    collegeYear,
    qualifiesForFafsa,
    fafsaExplanation,
    householdSize,
    dependents,
    adultsInHousehold,
    livesWithBothParents,
    livingExplanation,
    isEmployed,
    monthlyIncome,
  } = data['Financial Assessment']

  const { needJustification, goalSupport, commitment, additionalInfo } =
    data['Scholarship Justification']

  const dateStr = format(new Date(), 'MMMM dd, yyyy')

  const formatCurrency = (amount?: number) => {
    if (!amount) return ''
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const siblingInfo = siblingCount
    ? `I have ${siblingCount} sibling${siblingCount > 1 ? 's' : ''}${
        monthlyRate
          ? ` and my monthly tuition rate is ${formatCurrency(monthlyRate)}`
          : ''
      }.`
    : monthlyRate
      ? `My monthly tuition rate is ${formatCurrency(monthlyRate)}.`
      : ''

  const parentsInfo =
    livesWithBothParents === 'yes'
      ? 'I currently live with both of my parents'
      : `I do not live with both of my parents${livingExplanation ? `. ${livingExplanation}` : ''}`

  const educationInfo =
    educationStatus === 'highschool'
      ? `I am currently a ${schoolYear} at ${schoolName}`
      : `I am currently a ${collegeYear} at ${collegeName}`

  const fafsaInfo =
    educationStatus === 'college'
      ? qualifiesForFafsa === 'yes'
        ? 'I do qualify for FAFSA'
        : `I do not qualify for FAFSA${fafsaExplanation ? `. ${fafsaExplanation}` : ''}`
      : ''

  const employmentInfo =
    isEmployed === 'yes'
      ? `I am currently employed and earn ${formatCurrency(monthlyIncome)} per month`
      : 'I am not currently employed'

  const payerInfo =
    payer === 'parent'
      ? 'My parent/guardian is responsible for paying my tuition'
      : `${payerName || 'A relative'} (${payerRelation || 'relation not specified'}) is responsible for paying my tuition. They can be reached at ${payerPhone || phone}`

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.date}>{dateStr}</Text>
          <Text style={styles.salutation}>To the Mahad Office,</Text>
        </View>

        <Text style={styles.paragraph}>
          Assalamu Alaikum. My name is {studentName}, and I am a student in{' '}
          {className}. {siblingInfo} {payerInfo}
        </Text>

        <Text style={styles.paragraph}>
          {educationInfo}. {fafsaInfo && `${fafsaInfo}. `}
          My household consists of {householdSize} people, including{' '}
          {dependents} dependents and {adultsInHousehold} adults. {parentsInfo}.{' '}
          {employmentInfo}.
        </Text>

        <Text style={styles.paragraph}>{needJustification}</Text>

        <Text style={styles.paragraph}>{goalSupport}</Text>

        <Text style={styles.paragraph}>{commitment}</Text>

        {additionalInfo && (
          <Text style={styles.paragraph}>{additionalInfo}</Text>
        )}

        <View style={styles.signatureBlock}>
          <Text style={styles.sincerely}>Jazakallahu Khairan,</Text>
          <Text style={styles.signatureName}>{studentName}</Text>
          <Text>{email}</Text>
          <Text>{phone}</Text>
        </View>

        <View style={styles.footer}>
          <Text>
            This document is confidential and should be handled according to
            institutional privacy policies.
          </Text>
        </View>
      </Page>
    </Document>
  )
}
