import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Heading,
  Hr,
} from '@react-email/components'

interface ScholarshipEmailProps {
  studentName: string
  studentEmail: string
  className: string
  phone: string
}

export function ScholarshipApplicationEmail({
  studentName,
  studentEmail,
  className,
  phone,
}: ScholarshipEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>New Scholarship Application</Heading>

          <Text style={text}>
            A new scholarship application has been submitted.
          </Text>

          <Section style={infoSection}>
            <Text style={label}>Student Information:</Text>
            <Text style={value}>
              <strong>Name:</strong> {studentName}
            </Text>
            <Text style={value}>
              <strong>Class:</strong> {className}
            </Text>
            <Text style={value}>
              <strong>Email:</strong> {studentEmail}
            </Text>
            <Text style={value}>
              <strong>Phone:</strong> {phone}
            </Text>
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            Please review the attached PDF for complete application details.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
}

const h1 = {
  color: '#007078',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '40px 0',
  padding: '0',
  textAlign: 'center' as const,
}

const text = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '16px 0',
}

const infoSection = {
  backgroundColor: '#f4f4f5',
  borderRadius: '8px',
  padding: '24px',
  margin: '24px 0',
}

const label = {
  color: '#666',
  fontSize: '14px',
  fontWeight: 'bold',
  marginBottom: '12px',
}

const value = {
  color: '#333',
  fontSize: '14px',
  lineHeight: '24px',
  margin: '8px 0',
}

const hr = {
  borderColor: '#e6ebf1',
  margin: '20px 0',
}

const footer = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '16px',
  margin: '24px 0',
}
