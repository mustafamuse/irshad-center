'use client'

import Link from 'next/link'

import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Logo } from '@/components/ui/logo'

import { RegisterForm } from './components/register-form'
import { Providers } from './providers'

export function RegisterPage() {
  return (
    <Providers>
      <div className="min-h-screen bg-white">
        <div className="container mx-auto px-4 py-8 md:px-6 md:py-12">
          {/* Navigation */}
          <div className="mb-8 flex items-center justify-between">
            <Button
              asChild
              variant="ghost"
              className="h-10 gap-2 rounded-xl text-sm text-[#007078] hover:bg-[#007078]/10"
            >
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Home</span>
              </Link>
            </Button>
            <div className="w-32">
              <Logo size="sm" className="w-full" />
            </div>
          </div>

          <div className="mx-auto max-w-2xl">
            <header className="mb-12 space-y-3 text-center">
              <h1 className="text-3xl font-bold tracking-tight text-[#007078] sm:text-4xl">
                Student Registration
              </h1>
              <p className="text-lg text-gray-600">
                Join our 2024-2025 academic year at Irshād Māhad
              </p>
            </header>
            <RegisterForm />
          </div>
        </div>
      </div>
    </Providers>
  )
}
