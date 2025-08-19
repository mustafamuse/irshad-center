'use client'

import { useEffect, useState } from 'react'

import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'

const ScholarshipPDF = dynamic(() => import('../pdf-preview'), {
  ssr: false,
  loading: () => null,
})

export default function PDFPreviewPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Get data from localStorage
  const storedData =
    mounted && typeof window !== 'undefined'
      ? localStorage.getItem('scholarshipData')
      : null

  const formData = storedData ? JSON.parse(storedData) : null

  useEffect(() => {
    if (mounted && !formData) {
      router.push('/scholarship-application')
    }
  }, [formData, router, mounted])

  if (!mounted || !formData) {
    return null
  }

  return <ScholarshipPDF data={formData} />
}
