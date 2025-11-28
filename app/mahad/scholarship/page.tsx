import { Metadata } from 'next'

import { ScholarshipForm } from './_components/form'

export const metadata: Metadata = {
  title: 'Scholarship Application | Mahad',
  description: 'Apply for financial assistance for Mahad tuition',
}

export default function ScholarshipApplicationPage() {
  return <ScholarshipForm />
}
