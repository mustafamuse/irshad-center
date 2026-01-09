'use client'

import { Suspense, useRef, useState, useTransition } from 'react'

import { useSearchParams } from 'next/navigation'

import { validateAdminPin } from './actions'

function LoginForm() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/admin'

  const [pin, setPin] = useState(['', '', '', ''])
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const submitPin = (fullPin: string) => {
    startTransition(async () => {
      const result = await validateAdminPin(fullPin, redirectTo)
      if (!result.success) {
        setError(result.error || 'Invalid PIN')
        setPin(['', '', '', ''])
        inputRefs.current[0]?.focus()
      }
    })
  }

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return

    const newPin = [...pin]
    newPin[index] = value.slice(-1)
    setPin(newPin)
    setError('')

    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus()
    }

    if (newPin.every((digit) => digit !== '')) {
      submitPin(newPin.join(''))
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, 4)
    if (pasted.length === 4) {
      setPin(pasted.split(''))
      setError('')
      submitPin(pasted)
    }
  }

  return (
    <div className="w-full max-w-sm space-y-6 rounded-lg bg-white p-8 shadow-lg">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Admin Access</h1>
        <p className="mt-2 text-sm text-gray-600">Enter 4-digit PIN</p>
      </div>

      <div className="flex justify-center gap-3">
        {pin.map((digit, index) => (
          <input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={index === 0 ? handlePaste : undefined}
            disabled={isPending}
            className="h-14 w-14 rounded-lg border-2 border-gray-300 text-center text-2xl font-bold focus:border-[#007078] focus:outline-none focus:ring-2 focus:ring-[#007078]/20 disabled:opacity-50"
            autoFocus={index === 0}
          />
        ))}
      </div>

      {error && (
        <p className="text-center text-sm font-medium text-red-600">{error}</p>
      )}

      {isPending && (
        <p className="text-center text-sm text-gray-500">Verifying...</p>
      )}
    </div>
  )
}

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <Suspense fallback={<div className="text-gray-500">Loading...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
