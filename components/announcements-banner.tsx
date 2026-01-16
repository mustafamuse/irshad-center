'use client'

import { useState, useEffect, useMemo } from 'react'

import dynamic from 'next/dynamic'

import { X, Megaphone, AlertTriangle, CheckCircle } from 'lucide-react'

import { ANNOUNCEMENTS, type Announcement } from '@/lib/constants/homepage'

const MotionDiv = dynamic(
  () => import('framer-motion').then((mod) => mod.motion.div),
  { ssr: false }
)
const AnimatePresence = dynamic(
  () => import('framer-motion').then((mod) => mod.AnimatePresence),
  { ssr: false }
)

const iconMap = {
  info: Megaphone,
  warning: AlertTriangle,
  success: CheckCircle,
}

const colorMap = {
  info: 'bg-[#007078] text-white',
  warning: 'bg-amber-500 text-white',
  success: 'bg-emerald-600 text-white',
}

export default function AnnouncementsBanner() {
  const [dismissedIds, setDismissedIds] = useState<string[]>([])
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    const stored = localStorage.getItem('dismissedAnnouncements')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (
          Array.isArray(parsed) &&
          parsed.every((id) => typeof id === 'string')
        ) {
          setDismissedIds(parsed)
        }
      } catch {
        localStorage.removeItem('dismissedAnnouncements')
      }
    }
  }, [])

  const activeAnnouncements = useMemo(
    () => ANNOUNCEMENTS.filter((a) => a.active && !dismissedIds.includes(a.id)),
    [dismissedIds]
  )

  const dismissAnnouncement = (id: string) => {
    const newDismissed = [...dismissedIds, id]
    setDismissedIds(newDismissed)
    try {
      localStorage.setItem(
        'dismissedAnnouncements',
        JSON.stringify(newDismissed)
      )
    } catch {
      // localStorage may be unavailable in some environments
    }
  }

  if (!isClient || activeAnnouncements.length === 0) {
    return null
  }

  return (
    <div className="w-full space-y-1">
      <AnimatePresence>
        {activeAnnouncements.map((announcement: Announcement) => {
          const Icon = iconMap[announcement.type]
          return (
            <MotionDiv
              key={announcement.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className={`${colorMap[announcement.type]}`}
            >
              <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4 shrink-0" />
                  <p className="text-sm font-medium">{announcement.text}</p>
                </div>
                <button
                  onClick={() => dismissAnnouncement(announcement.id)}
                  className="shrink-0 rounded-full p-1 transition-colors hover:bg-white/20"
                  aria-label="Dismiss announcement"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </MotionDiv>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
