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

const SemesterCountdown: React.FC = () => {
  const [timeLeft, setTimeLeft] = useState<CountdownTime>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  })
  const [isClient, setIsClient] = useState(false)

  // Semester end date: September 7, 2025 (end of day)
  const semesterEndDate = new Date('2025-09-07T23:59:59')

  useEffect(() => {
    setIsClient(true)

    const calculateTimeLeft = () => {
      const now = new Date()
      const difference = semesterEndDate.getTime() - now.getTime()

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
  }, [semesterEndDate])

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
        className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8"
      >
        <div className="flex items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 p-4 text-center">
          <Calendar className="h-5 w-5 text-green-600" />
          <div className="text-sm">
            <span className="font-medium text-green-800">Semester Break</span>
            <span className="ml-2 text-green-600">
              Classes resume after the break period
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
      className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8"
    >
      <div className="flex items-center justify-center gap-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 p-4">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-indigo-600" />
          <span className="text-sm font-medium text-indigo-800">
            Semester ends in:
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

          {/* Show seconds only on larger screens */}
          <div className="hidden sm:block">
            <div className="text-indigo-400">:</div>
          </div>

          <div className="hidden text-center sm:block">
            <div className="text-lg font-bold text-indigo-900">
              {timeLeft.seconds.toString().padStart(2, '0')}
            </div>
            <div className="text-xs text-indigo-600">
              {timeLeft.seconds === 1 ? 'sec' : 'secs'}
            </div>
          </div>
        </div>

        <div className="text-sm text-indigo-600">
          <span className="hidden sm:inline">
            Sep 5-7 • Break following weekend
          </span>
          <span className="sm:hidden">Sep 5-7</span>
        </div>
      </div>
    </motion.div>
  )
}

export default SemesterCountdown
