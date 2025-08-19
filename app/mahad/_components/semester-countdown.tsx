'use client'

import { useState, useEffect } from 'react'

import { motion } from 'framer-motion'
import { Calendar, Clock } from 'lucide-react'

interface CountdownTime {
  days: number
  hours: number
  minutes: number
  seconds: number
}

// Semester end date: September 7, 2025 (end of day)
const SEMESTER_END_DATE = new Date('2025-09-07T23:59:59')

const SemesterCountdown: React.FC = () => {
  const [timeLeft, setTimeLeft] = useState<CountdownTime>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  })
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)

    const calculateTimeLeft = () => {
      const now = new Date()
      const difference = SEMESTER_END_DATE.getTime() - now.getTime()

      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24))
        const hours = Math.floor((difference / (1000 * 60 * 60)) % 24)
        const minutes = Math.floor((difference / 1000 / 60) % 60)
        const seconds = Math.floor((difference / 1000) % 60)

        setTimeLeft({ days, hours, minutes, seconds })
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 })
      }
    }

    calculateTimeLeft()
    const timer = setInterval(calculateTimeLeft, 1000)

    return () => clearInterval(timer)
  }, [])

  // Don't render anything on server to avoid hydration mismatch
  if (!isClient) {
    return null
  }

  const isExpired =
    timeLeft.days === 0 &&
    timeLeft.hours === 0 &&
    timeLeft.minutes === 0 &&
    timeLeft.seconds === 0

  if (isExpired) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-7xl px-2 py-2 sm:px-4 sm:py-3 lg:px-8"
      >
        {/* Mobile Layout */}
        <div className="block sm:hidden">
          <div className="rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 p-3 text-center">
            <div className="mb-2 flex items-center justify-center gap-2">
              <Calendar className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-800">
                Finals Complete!
              </span>
            </div>
            <div className="text-xs text-green-600">Break: Sep 12-14</div>
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 p-4 text-center sm:flex">
          <Calendar className="h-5 w-5 text-green-600" />
          <div className="text-sm">
            <span className="font-medium text-green-800">
              Finals Week Complete!
            </span>
            <span className="ml-2 text-green-600">
              Semester break: Sep 12-14 • Classes resume after break
            </span>
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-7xl px-2 py-2 sm:px-4 sm:py-3 lg:px-8"
    >
      {/* Mobile Layout */}
      <div className="block sm:hidden">
        <div className="rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 p-3">
          {/* Header */}
          <div className="mb-3 flex items-center justify-center gap-2">
            <Clock className="h-4 w-4 text-indigo-600" />
            <span className="text-sm font-medium text-indigo-800">
              Finals week in:
            </span>
          </div>

          {/* Countdown Numbers - Mobile */}
          <div className="mb-3 flex items-center justify-center gap-2">
            <div className="text-center">
              <div className="text-xl font-bold text-indigo-900">
                {timeLeft.days.toString().padStart(2, '0')}
              </div>
              <div className="text-xs text-indigo-600">days</div>
            </div>
            <div className="text-lg text-indigo-400">:</div>
            <div className="text-center">
              <div className="text-xl font-bold text-indigo-900">
                {timeLeft.hours.toString().padStart(2, '0')}
              </div>
              <div className="text-xs text-indigo-600">hrs</div>
            </div>
            <div className="text-lg text-indigo-400">:</div>
            <div className="text-center">
              <div className="text-xl font-bold text-indigo-900">
                {timeLeft.minutes.toString().padStart(2, '0')}
              </div>
              <div className="text-xs text-indigo-600">mins</div>
            </div>
          </div>

          {/* Mobile Date Info */}
          <div className="text-center text-xs text-indigo-600">
            Finals: Sep 5-7
          </div>
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden items-center justify-center gap-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 p-4 sm:flex">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-indigo-600" />
          <span className="text-sm font-medium text-indigo-800">
            Finals week in:
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Days */}
          <div className="text-center">
            <div className="text-lg font-bold text-indigo-900">
              {timeLeft.days.toString().padStart(2, '0')}
            </div>
            <div className="text-xs text-indigo-600">
              {timeLeft.days === 1 ? 'day' : 'days'}
            </div>
          </div>

          {/* Separator */}
          <div className="text-indigo-400">:</div>

          {/* Hours */}
          <div className="text-center">
            <div className="text-lg font-bold text-indigo-900">
              {timeLeft.hours.toString().padStart(2, '0')}
            </div>
            <div className="text-xs text-indigo-600">
              {timeLeft.hours === 1 ? 'hr' : 'hrs'}
            </div>
          </div>

          {/* Separator */}
          <div className="text-indigo-400">:</div>

          {/* Minutes */}
          <div className="text-center">
            <div className="text-lg font-bold text-indigo-900">
              {timeLeft.minutes.toString().padStart(2, '0')}
            </div>
            <div className="text-xs text-indigo-600">
              {timeLeft.minutes === 1 ? 'min' : 'mins'}
            </div>
          </div>

          {/* Seconds - Desktop only */}
          <div className="text-indigo-400">:</div>
          <div className="text-center">
            <div className="text-lg font-bold text-indigo-900">
              {timeLeft.seconds.toString().padStart(2, '0')}
            </div>
            <div className="text-xs text-indigo-600">
              {timeLeft.seconds === 1 ? 'sec' : 'secs'}
            </div>
          </div>
        </div>

        <div className="text-sm text-indigo-600">
          Finals: Sep 5-7 • Break: Sep 12-14
        </div>
      </div>
    </motion.div>
  )
}

export default SemesterCountdown
