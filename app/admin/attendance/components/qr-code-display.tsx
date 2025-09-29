'use client'

import { useCallback, useEffect, useState } from 'react'

import Image from 'next/image'

import { RefreshCw, Users, Clock } from 'lucide-react'

import { Button } from '@/components/ui/button'

import { generateQRCode } from '../actions'

interface QRCodeDisplayProps {
  sessionId: string
  isEnabled: boolean
  onToggle: (enabled: boolean) => void
  studentsCount?: number
  checkedInCount?: number
}

export function QRCodeDisplay({
  sessionId,
  isEnabled,
  onToggle,
  studentsCount = 0,
  checkedInCount = 0,
}: QRCodeDisplayProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(60)
  const [error, setError] = useState<string | null>(null)

  // Generate QR code when enabled
  const generateNewQRCode = useCallback(async () => {
    if (!isEnabled) return

    setIsLoading(true)
    setError(null)

    try {
      const qrDataUrl = await generateQRCode(sessionId)
      setQrCodeUrl(qrDataUrl)
      setTimeRemaining(60) // Reset timer
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to generate QR code'
      )
      setQrCodeUrl(null)
    } finally {
      setIsLoading(false)
    }
  }, [isEnabled, sessionId])

  // Auto-refresh QR code every 60 seconds
  useEffect(() => {
    if (!isEnabled) {
      setQrCodeUrl(null)
      setTimeRemaining(60)
      return
    }

    generateNewQRCode()

    const interval = setInterval(() => {
      generateNewQRCode()
    }, 60000) // Refresh every 60 seconds

    return () => clearInterval(interval)
  }, [isEnabled, sessionId, generateNewQRCode])

  // Countdown timer
  useEffect(() => {
    if (!isEnabled || !qrCodeUrl) return

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          return 60 // Reset when it reaches 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [isEnabled, qrCodeUrl])

  const attendanceRate =
    studentsCount > 0 ? Math.round((checkedInCount / studentsCount) * 100) : 0

  return (
    <div className="w-full max-w-md space-y-4">
      {/* Toggle Button */}
      <Button
        onClick={() => onToggle(!isEnabled)}
        variant={isEnabled ? 'destructive' : 'default'}
        className="w-full"
        disabled={isLoading}
      >
        {isEnabled ? 'Stop Self Check-In' : 'Start Self Check-In'}
      </Button>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>
            {checkedInCount} / {studentsCount}
          </span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="font-medium">{attendanceRate}%</span>
        </div>
      </div>

      {/* QR Code Display */}
      {isEnabled && (
        <div className="space-y-3">
          {error && (
            <div className="rounded bg-red-50 p-2 text-sm text-red-600">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="flex h-48 items-center justify-center rounded-lg bg-gray-50">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : qrCodeUrl ? (
            <div className="space-y-3">
              <div className="flex items-center justify-center rounded-lg border bg-white p-4">
                <Image
                  src={qrCodeUrl}
                  alt="QR Code for attendance check-in"
                  width={200}
                  height={200}
                  className="h-auto w-full max-w-[200px]"
                />
              </div>

              {/* Timer */}
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>Expires in {timeRemaining}s</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={generateNewQRCode}
                  disabled={isLoading}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">
              QR code will appear here
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      {isEnabled && (
        <div className="rounded bg-blue-50 p-3 text-xs text-muted-foreground">
          <p className="mb-1 font-medium">Instructions for students:</p>
          <ol className="list-inside list-decimal space-y-1">
            <li>Scan the QR code with your phone camera</li>
            <li>Allow location access when prompted</li>
            <li>Select your name from the list</li>
            <li>Tap "Check In" to mark attendance</li>
          </ol>
        </div>
      )}
    </div>
  )
}
