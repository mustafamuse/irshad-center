'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

import { motion } from 'framer-motion'
import { Clock, MapPin } from 'lucide-react'

import { IQAMAH_OFFSETS } from '@/lib/constants/homepage'

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

interface PrayTimeInstance {
  location(coords: [number, number]): this
  timezone(tz: string): this
  format(fmt: string): this
  getTimes(): PrayerTimes
}

type PrayTimeConstructor = new (method: string) => PrayTimeInstance

let PrayTimeClass: PrayTimeConstructor | null = null

const prayerNames = {
  fajr: 'Fajr',
  sunrise: 'Sunrise',
  dhuhr: 'Dhuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
}

const getIqamahTime = (prayerTime: string, offsetMinutes: number): string => {
  const [timeOnly, period] = prayerTime.split(' ')
  const [hours, minutes] = timeOnly.split(':').map(Number)

  let totalMinutes = hours * 60 + minutes
  if (period === 'PM' && hours !== 12) totalMinutes += 12 * 60
  if (period === 'AM' && hours === 12) totalMinutes = minutes

  totalMinutes += offsetMinutes

  let newHours = Math.floor(totalMinutes / 60) % 24
  const newMinutes = totalMinutes % 60
  const newPeriod = newHours >= 12 ? 'PM' : 'AM'
  if (newHours > 12) newHours -= 12
  if (newHours === 0) newHours = 12

  return `${newHours}:${newMinutes.toString().padStart(2, '0')} ${newPeriod}`
}

export default function PrayerTimes() {
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimes | null>(null)
  const [nextPrayer, setNextPrayer] = useState<NextPrayer | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [usingFallback, setUsingFallback] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const prayerTimesRef = useRef<PrayerTimes | null>(null)

  useEffect(() => {
    prayerTimesRef.current = prayerTimes
  }, [prayerTimes])

  useEffect(() => {
    setIsClient(true)
  }, [])

  const calculateNextPrayer = useCallback((times: PrayerTimes) => {
    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()

    const prayerMinutes = Object.entries(times)
      .map(([name, time]) => {
        if (name === 'sunrise') return null

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

    const upcomingPrayers = prayerMinutes.filter(
      (prayer): prayer is NonNullable<typeof prayer> =>
        prayer !== null && prayer.minutes > currentMinutes
    )
    const next =
      upcomingPrayers.length > 0 ? upcomingPrayers[0] : prayerMinutes[0]

    if (next) {
      const timeDiff =
        next.minutes > currentMinutes
          ? next.minutes - currentMinutes
          : 24 * 60 - currentMinutes + next.minutes

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
  }, [])

  useEffect(() => {
    if (!isClient) return

    const calculatePrayerTimes = () => {
      try {
        if (!PrayTimeClass) return

        const praytime = new PrayTimeClass('ISNA')
        const times = praytime
          .location([44.8547, -93.4708])
          .timezone('America/Chicago')
          .format('12h')
          .getTimes()

        setPrayerTimes(times)
        calculateNextPrayer(times)
      } catch (err) {
        console.error('Error calculating prayer times:', err)
        setError('Unable to calculate prayer times. Please refresh the page.')
      }
    }

    if (!PrayTimeClass) {
      const loadPrayTime = async () => {
        try {
          const prayTimeModule = await import('praytime')
          PrayTimeClass =
            prayTimeModule.PrayTime || prayTimeModule.default || prayTimeModule
          if (PrayTimeClass) {
            calculatePrayerTimes()
          }
        } catch (err) {
          console.error('Failed to load PrayTime library:', err)
          setUsingFallback(true)
          const fallbackTimes = {
            fajr: '5:45 AM',
            sunrise: '7:21 AM',
            dhuhr: '12:27 PM',
            asr: '3:53 PM',
            maghrib: '5:34 PM',
            isha: '7:52 PM',
          }
          setPrayerTimes(fallbackTimes)
          calculateNextPrayer(fallbackTimes)
        }
      }
      loadPrayTime()
    } else {
      calculatePrayerTimes()
    }

    const now = new Date()
    const midnightTimer = setTimeout(
      () => {
        if (PrayTimeClass) {
          try {
            const praytime = new PrayTimeClass('ISNA')
            const times = praytime
              .location([44.8547, -93.4708])
              .timezone('America/Chicago')
              .format('12h')
              .getTimes()
            setPrayerTimes(times)
            calculateNextPrayer(times)
          } catch (err) {
            console.error(
              'Failed to recalculate prayer times at midnight:',
              err
            )
          }
        }
      },
      24 * 60 * 60 * 1000 - (now.getTime() % (24 * 60 * 60 * 1000))
    )

    return () => {
      clearTimeout(midnightTimer)
    }
  }, [isClient, calculateNextPrayer])

  useEffect(() => {
    if (!isClient || !prayerTimesRef.current) return

    calculateNextPrayer(prayerTimesRef.current)

    const timeInterval = setInterval(() => {
      if (prayerTimesRef.current) {
        calculateNextPrayer(prayerTimesRef.current)
      }
    }, 60000)

    return () => {
      clearInterval(timeInterval)
    }
  }, [isClient, prayerTimes, calculateNextPrayer])

  if (!isClient) {
    return null
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-5xl">
        <div className="rounded-3xl border border-red-200/30 bg-red-50/50 p-8 text-center dark:border-red-900/30 dark:bg-red-900/10">
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
          >
            Refresh Page
          </button>
        </div>
      </div>
    )
  }

  if (!prayerTimes) {
    return (
      <div className="mx-auto w-full max-w-5xl">
        <div className="relative animate-pulse rounded-3xl border border-gray-200/30 bg-gradient-to-br from-white/40 via-white/20 to-white/10 p-6 shadow-2xl backdrop-blur-xl dark:border-gray-700/50 dark:from-gray-800/60 dark:via-gray-800/40 dark:to-gray-800/30 sm:p-8">
          <div className="space-y-6">
            <div className="h-32 rounded-2xl bg-gray-200 dark:bg-gray-700" />
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-6">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="h-28 rounded-xl bg-gray-200 dark:bg-gray-700"
                />
              ))}
            </div>
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
      <div className="relative rounded-3xl border border-gray-200/30 bg-gradient-to-br from-white/40 via-white/20 to-white/10 p-6 shadow-2xl backdrop-blur-xl dark:border-gray-700/50 dark:from-gray-800/60 dark:via-gray-800/40 dark:to-gray-800/30 sm:p-8">
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[#007078]/5 via-transparent to-[#deb43e]/5 dark:from-[#007078]/10 dark:to-[#deb43e]/10" />
        <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-gradient-to-bl from-[#deb43e]/10 to-transparent blur-2xl" />
        <div className="absolute bottom-0 left-0 h-24 w-24 rounded-full bg-gradient-to-tr from-[#007078]/10 to-transparent blur-xl" />

        <div className="relative z-10 space-y-6">
          {nextPrayer && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6 }}
              className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#007078] via-[#006569] to-[#007078] p-6 text-white shadow-xl sm:p-8"
            >
              <div className="absolute inset-0">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLW9wYWNpdHk9IjAuMSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-20" />
                <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-gradient-to-bl from-white/20 to-transparent blur-3xl" />
                <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-gradient-to-tr from-[#deb43e]/20 to-transparent blur-2xl" />
              </div>

              <div className="relative z-10">
                <div className="mb-4 flex items-center justify-center gap-2 text-sm font-medium text-white/80 sm:text-base">
                  <MapPin className="h-4 w-4" />
                  <span>Eden Prairie, Minnesota</span>
                  <span className="mx-2 h-1 w-1 rounded-full bg-white/40" />
                  <span>
                    {new Date().toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                </div>

                <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
                  <div className="text-center sm:text-left">
                    <div className="mb-1 text-xs font-medium uppercase tracking-wider text-white/70 sm:text-sm">
                      Next Prayer
                    </div>
                    <div className="text-2xl font-bold sm:text-3xl">
                      {nextPrayer.name}
                    </div>
                    <div className="mt-1 text-sm text-white/80 sm:text-base">
                      {nextPrayer.time}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="rounded-xl bg-white/20 p-3 ring-1 ring-white/30 backdrop-blur-sm">
                      <Clock className="h-6 w-6 text-white sm:h-8 sm:w-8" />
                    </div>
                    <div className="text-center">
                      <div className="mb-1 text-xs font-medium uppercase tracking-wider text-white/70 sm:text-sm">
                        Time Remaining
                      </div>
                      <div className="text-3xl font-extrabold text-[#deb43e] sm:text-4xl">
                        {nextPrayer.countdown}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          <div>
            <h3 className="mb-4 text-center text-lg font-semibold text-gray-900 dark:text-white sm:text-xl">
              Today's Prayer Schedule
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
              {Object.entries(prayerTimes).map(([prayer, time], index) => {
                if (
                  prayer === 'midnight' ||
                  prayer === 'sunset' ||
                  prayer === 'sunrise'
                )
                  return null

                const isNextPrayer =
                  nextPrayer?.name ===
                  prayerNames[prayer as keyof typeof prayerNames]

                return (
                  <motion.div
                    key={prayer}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className="group relative overflow-hidden"
                  >
                    <div
                      className={`relative rounded-xl border-2 p-4 text-center backdrop-blur-sm transition-all duration-300 hover:scale-105 ${
                        isNextPrayer
                          ? 'border-[#deb43e]/60 bg-gradient-to-br from-[#deb43e]/15 to-[#deb43e]/5 shadow-lg shadow-[#deb43e]/20 ring-2 ring-[#deb43e]/30 dark:border-[#deb43e]/70 dark:from-[#deb43e]/25 dark:to-[#deb43e]/10 dark:ring-[#deb43e]/40'
                          : 'border-white/40 bg-white/30 shadow-md hover:shadow-xl dark:border-gray-700/50 dark:bg-gray-800/50'
                      }`}
                    >
                      <div
                        className={`mb-2 text-xs font-semibold uppercase tracking-wide sm:text-sm ${
                          isNextPrayer
                            ? 'text-[#deb43e] dark:text-[#deb43e]'
                            : 'text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {prayerNames[prayer as keyof typeof prayerNames]}
                      </div>
                      <div
                        className={`mb-1 flex items-center justify-center gap-2 text-xl font-bold tracking-tight sm:text-2xl ${
                          isNextPrayer
                            ? 'text-[#deb43e] dark:text-[#deb43e]'
                            : 'text-gray-900 dark:text-white'
                        }`}
                      >
                        {time}
                        {isNextPrayer && (
                          <span className="inline-flex h-2 w-2 animate-ping rounded-full bg-[#deb43e]" />
                        )}
                      </div>
                      {IQAMAH_OFFSETS[prayer] !== undefined && (
                        <div
                          className={`mt-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                            isNextPrayer
                              ? 'bg-[#deb43e]/20 text-[#deb43e] dark:bg-[#deb43e]/30 dark:text-[#deb43e]'
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                          }`}
                        >
                          Iqamah: {getIqamahTime(time, IQAMAH_OFFSETS[prayer])}
                        </div>
                      )}

                      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#007078]/5 to-[#deb43e]/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>

          <div className="pt-2 text-center">
            {usingFallback ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-50/50 px-4 py-2 text-xs text-amber-600 backdrop-blur-sm dark:border-amber-500/30 dark:bg-amber-900/20 dark:text-amber-400">
                <span>Approximate times shown</span>
                <span
                  className="h-1 w-1 rounded-full bg-amber-400"
                  aria-hidden="true"
                />
                <span>Actual times may vary</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-full border border-gray-200/20 bg-white/20 px-4 py-2 text-xs text-gray-500 backdrop-blur-sm dark:border-gray-700/50 dark:bg-gray-800/50 dark:text-gray-400">
                <MapPin className="h-3 w-3" aria-hidden="true" />
                <span>Calculated using ISNA method</span>
                <span
                  className="h-1 w-1 rounded-full bg-gray-300 dark:bg-gray-600"
                  aria-hidden="true"
                />
                <span>Times may vary by ±2 minutes</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
