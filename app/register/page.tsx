import { Metadata } from 'next'

import { RegisterPage } from './register-page'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Student Registration - Irshād Māhad',
  description: 'Register for the 2024-2025 academic year at Irshād Māhad.',
}

export default function Page() {
  return <RegisterPage />
}
