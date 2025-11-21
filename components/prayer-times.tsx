'use client'

import { useState, useEffect } from 'react'

import { motion } from 'framer-motion'
import { Clock, MapPin } from 'lucide-react'

// Dynamic import for PrayTime library
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let PrayTimeClass: any = null

interface PrayerTimes {
  fajr: string
  sunrise: string
  dhuhr: string
  asr: string
  maghrib: string
  isha: string
}

interface NextPrayer {
  name: string
  time: string
  countdown: string
}

const prayerNames = {
  fajr: 'Fajr',
  sunrise: 'Sunrise',
  dhuhr: 'Dhuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
}

export default function PrayerTimes() {
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimes | null>(null)
  const [nextPrayer, setNextPrayer] = useState<NextPrayer | null>(null)
  const [_currentTime, setCurrentTime] = useState(new Date())
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isClient) return

    const calculatePrayerTimes = () => {
      try {
        if (!PrayTimeClass) return

        // Create PrayTime instance with ISNA method
        const praytime = new PrayTimeClass('ISNA')

        // Set Eden Prairie, MN coordinates and timezone
        const times = praytime
          .location([44.8547, -93.4708])
          .timezone('America/Chicago')
          .format('12h')
          .getTimes()

        setPrayerTimes(times)
        calculateNextPrayer(times)
      } catch (error) {
        console.error('Error calculating prayer times:', error)
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calculateNextPrayer = (times: any) => {
      const now = new Date()
      const currentMinutes = now.getHours() * 60 + now.getMinutes()

      // Convert prayer times to minutes since midnight
      const prayerMinutes = Object.entries(times)
        .map(([name, time]) => {
          if (name === 'sunrise') return null // Skip sunrise for next prayer calculation

          const timeStr = time as string
          const [timeOnly, period] = timeStr.split(' ')
          const [hours, minutes] = timeOnly.split(':').map(Number)

          let totalMinutes = hours * 60 + minutes
          if (period === 'PM' && hours !== 12) totalMinutes += 12 * 60
          if (period === 'AM' && hours === 12) totalMinutes = minutes

          return {
            name: prayerNames[name as keyof typeof prayerNames],
            minutes: totalMinutes,
            time: timeStr,
          }
        })
        .filter(Boolean)

      // Find next prayer
      const upcomingPrayers = prayerMinutes.filter(
        (prayer) => prayer!.minutes > currentMinutes
      )
      let next =
        upcomingPrayers.length > 0 ? upcomingPrayers[0] : prayerMinutes[0] // If no more today, next is Fajr tomorrow

      if (next) {
        const timeDiff =
          next.minutes > currentMinutes
            ? next.minutes - currentMinutes
            : 24 * 60 - currentMinutes + next.minutes // Next day

        const hours = Math.floor(timeDiff / 60)
        const mins = timeDiff % 60

        let countdown = ''
        if (hours > 0) countdown += `${hours}h `
        countdown += `${mins}m`

        setNextPrayer({
          name: next.name,
          time: next.time,
          countdown,
        })
      }
    }

    // Load PrayTime dynamically if not already loaded
    if (!PrayTimeClass) {
      // Use dynamic import with proper error handling
      const loadPrayTime = async () => {
        try {
          const prayTimeModule = await import('praytime')
          PrayTimeClass =
            prayTimeModule.PrayTime || prayTimeModule.default || prayTimeModule
          if (PrayTimeClass) {
            calculatePrayerTimes()
          }
        } catch (error) {
          console.error('Failed to load PrayTime library:', error)
          // Set fallback times for display (approximate for Eden Prairie in January)
          setPrayerTimes({
            fajr: '5:45 AM',
            sunrise: '7:21 AM',
            dhuhr: '12:27 PM',
            asr: '3:53 PM',
            maghrib: '5:34 PM',
            isha: '7:52 PM',
          })
        }
      }
      loadPrayTime()
    } else {
      calculatePrayerTimes()
    }

    // Update current time every minute
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date())
      if (prayerTimes) calculateNextPrayer(prayerTimes)
    }, 60000)

    // Recalculate prayer times at midnight
    const now = new Date()
    const midnightTimer = setTimeout(
      () => {
        if (PrayTimeClass) calculatePrayerTimes()
      },
      24 * 60 * 60 * 1000 - (now.getTime() % (24 * 60 * 60 * 1000))
    )

    return () => {
      clearInterval(timeInterval)
      clearTimeout(midnightTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient])

  if (!isClient) {
    return null // Don't render on server side
  }

  if (!prayerTimes) {
    return (
      <div className="mx-auto w-full max-w-5xl">
        <div className="relative animate-pulse rounded-3xl border border-gray-200/30 bg-gradient-to-br from-white/40 via-white/20 to-white/10 p-8 shadow-2xl backdrop-blur-md">
          <div className="space-y-8">
            {/* Header Skeleton */}
            <div className="flex flex-col items-center space-y-4">
              <div className="h-8 w-48 rounded-lg bg-gray-200" />
              <div className="h-4 w-36 rounded-lg bg-gray-200" />
            </div>
            {/* Prayer Times Grid Skeleton */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-24 rounded-2xl bg-gray-200" />
              ))}
            </div>
            {/* Next Prayer Skeleton */}
            <div className="h-24 rounded-2xl bg-gray-200" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      className="mx-auto w-full max-w-5xl"
    >
      <div className="relative rounded-3xl border border-gray-200/30 bg-gradient-to-br from-white/40 via-white/20 to-white/10 p-8 shadow-2xl backdrop-blur-md">
        {/* Decorative Background Elements */}
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[#007078]/5 via-transparent to-[#deb43e]/5" />
        <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-gradient-to-bl from-[#deb43e]/10 to-transparent blur-2xl" />
        <div className="absolute bottom-0 left-0 h-24 w-24 rounded-full bg-gradient-to-tr from-[#007078]/10 to-transparent blur-xl" />

        <div className="relative z-10">
          {/* Header */}
          <div className="mb-8 text-center">
            <div className="mb-2 flex items-center justify-center gap-3">
              <div className="rounded-xl bg-[#007078]/10 p-2 backdrop-blur-sm">
                <MapPin className="h-5 w-5 text-[#007078]" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900">Prayer Times</h3>
            </div>
            <p className="text-base font-medium text-gray-600">
              Eden Prairie, Minnesota
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>

          {/* Prayer Times Grid */}
          <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {Object.entries(prayerTimes).map(([prayer, time], index) => {
              // Skip midnight and sunset times
              if (prayer === 'midnight' || prayer === 'sunset') return null

              return (
                <motion.div
                  key={prayer}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="group relative overflow-hidden"
                >
                  <div
                    className={`relative rounded-2xl border p-4 text-center backdrop-blur-sm transition-all duration-300 hover:scale-105 ${
                      nextPrayer?.name ===
                      prayerNames[prayer as keyof typeof prayerNames]
                        ? 'border-[#007078]/30 bg-[#007078]/10 shadow-lg shadow-[#007078]/5'
                        : 'border-white/40 bg-white/30 shadow-md hover:shadow-xl'
                    }`}
                  >
                    {/* Prayer Name */}
                    <div
                      className={`mb-2 text-sm font-semibold uppercase tracking-wide ${
                        nextPrayer?.name ===
                        prayerNames[prayer as keyof typeof prayerNames]
                          ? 'text-[#007078]'
                          : 'text-gray-700'
                      }`}
                    >
                      {prayerNames[prayer as keyof typeof prayerNames]}
                    </div>
                    {/* Prayer Time */}
                    <div
                      className={`flex items-center justify-center gap-2 text-lg font-bold tracking-tight ${
                        nextPrayer?.name ===
                        prayerNames[prayer as keyof typeof prayerNames]
                          ? 'text-[#007078]'
                          : 'text-gray-900'
                      }`}
                    >
                      {time}
                      {nextPrayer?.name ===
                        prayerNames[prayer as keyof typeof prayerNames] && (
                        <span className="inline-flex h-2 w-2 animate-ping rounded-full bg-[#007078]" />
                      )}
                    </div>

                    {/* Subtle gradient overlay on hover */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#007078]/5 to-[#deb43e]/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  </div>
                </motion.div>
              )
            })}
          </div>

          {/* Next Prayer Countdown */}
          {nextPrayer && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#007078] to-[#006569] p-6 text-white shadow-xl"
            >
              {/* Decorative elements */}
              <div className="absolute inset-0">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLW9wYWNpdHk9IjAuMSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-20" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#007078] via-transparent to-[#006569] opacity-80" />
                <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-gradient-to-bl from-white/20 to-transparent blur-3xl" />
                <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-gradient-to-tr from-[#deb43e]/20 to-transparent blur-2xl" />
              </div>

              <div className="relative z-10 flex items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="rounded-xl bg-white/20 p-3 ring-1 ring-white/30 backdrop-blur-sm">
                    <Clock className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-white/80">
                      Next Prayer
                    </span>
                    <div className="text-xl font-bold">{nextPrayer.name}</div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-medium text-white/80">
                    Time Remaining
                  </span>
                  <div className="text-2xl font-extrabold text-[#deb43e]">
                    {nextPrayer.countdown}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Calculation Method Note */}
          <div className="mt-6 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-gray-200/20 bg-white/20 px-4 py-2 text-xs text-gray-500 backdrop-blur-sm">
              <MapPin className="h-3 w-3" aria-hidden="true" />
              <span>Calculated using ISNA method</span>
              <span
                className="h-1 w-1 rounded-full bg-gray-300"
                aria-hidden="true"
              />
              <span>Times may vary by ±2 minutes</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
