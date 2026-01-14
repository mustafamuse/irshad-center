import Image from 'next/image'
import Link from 'next/link'

import { ArrowRight, GraduationCap, Users, BookOpen, Mic } from 'lucide-react'

import AnnouncementsBanner from '@/components/announcements-banner'
import PrayerTimes from '@/components/prayer-times'
import SiteFooter from '@/components/site-footer'
import StickyHeader from '@/components/sticky-header'
import { Button } from '@/components/ui/button'
import {
  IRSHAD_CENTER,
  PROGRAMS,
  COMMUNITY_STATS,
  JUMMAH_TIMES,
  FRIDAY_YOUTH,
} from '@/lib/constants/homepage'

const statIcons = {
  students: Users,
  graduates: GraduationCap,
  classes: BookOpen,
  halaqah: Mic,
}

export default function Page() {
  return (
    <div className="relative min-h-screen bg-white dark:bg-gray-950">
      <AnnouncementsBanner />
      <StickyHeader />

      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(30deg,#007078_0%,transparent_70%)] opacity-[0.03] dark:opacity-[0.08]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="animate-fade-in space-y-6 sm:space-y-8">
          <div className="relative">
            <div className="mx-auto w-full max-w-[280px] sm:max-w-md md:max-w-lg">
              <Image
                src="/images/Mosque-transparent.svg"
                alt="Irshād Islamic Center"
                width={600}
                height={360}
                className="h-auto w-full"
                priority
              />
            </div>

            <div className="mt-2 space-y-2 text-center">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl md:text-4xl">
                Welcome to{' '}
                <span className="text-[#007078] dark:text-[#00a0a8]">
                  Irshād
                </span>{' '}
                Islamic Center
              </h1>
              <p className="mx-auto max-w-xl text-sm text-gray-600 dark:text-gray-300 sm:text-base">
                {IRSHAD_CENTER.tagline}
              </p>
            </div>
          </div>

          <div className="mx-auto max-w-3xl rounded-2xl border border-[#007078]/10 bg-[#007078]/5 p-4 text-center dark:border-[#007078]/20 dark:bg-[#007078]/10">
            <p className="text-sm text-gray-700 dark:text-gray-300 sm:text-base">
              {IRSHAD_CENTER.mission}
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-center text-lg font-semibold text-gray-700 dark:text-gray-200">
              Our Programs
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="group relative">
                <Button
                  asChild
                  size="lg"
                  className="h-auto w-full rounded-2xl bg-[#007078] p-4 text-white shadow-lg transition-all duration-300 group-hover:scale-[1.02] group-hover:bg-[#007078]/90 group-hover:shadow-xl sm:p-5"
                >
                  <Link
                    href={PROGRAMS.mahad.href}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <div className="text-lg font-semibold sm:text-xl">
                      {PROGRAMS.mahad.name}
                    </div>
                    <div className="text-xs opacity-90 sm:text-sm">
                      {PROGRAMS.mahad.subtitle}
                    </div>
                    <div className="mt-1 text-xs opacity-75">
                      {PROGRAMS.mahad.ageRange} • {PROGRAMS.mahad.schedule}
                    </div>
                    <div className="mt-2 flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs sm:text-sm">
                      <span>Visit Now</span>
                      <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1 sm:h-4 sm:w-4" />
                    </div>
                  </Link>
                </Button>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-[#007078]/10 bg-white px-2 py-0.5 text-[10px] text-[#007078] shadow-sm dark:border-[#007078]/30 dark:bg-gray-800 dark:text-[#00a0a8] sm:px-3 sm:text-xs">
                  {PROGRAMS.mahad.status}
                </div>
              </div>

              <div className="group relative">
                <Button
                  asChild
                  size="lg"
                  className="h-auto w-full rounded-2xl bg-[#deb43e] p-4 text-white shadow-lg transition-all duration-300 group-hover:scale-[1.02] group-hover:bg-[#c9a438] group-hover:shadow-xl sm:p-5"
                >
                  <Link
                    href={PROGRAMS.dugsi.href}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <div className="text-lg font-semibold sm:text-xl">
                      {PROGRAMS.dugsi.name}
                    </div>
                    <div className="text-xs opacity-90 sm:text-sm">
                      {PROGRAMS.dugsi.subtitle}
                    </div>
                    <div className="mt-1 text-xs opacity-75">
                      {PROGRAMS.dugsi.ageRange} • {PROGRAMS.dugsi.schedule}
                    </div>
                    <div className="mt-2 flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs sm:text-sm">
                      <span>Register Now</span>
                      <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1 sm:h-4 sm:w-4" />
                    </div>
                  </Link>
                </Button>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-[#deb43e]/20 bg-white px-2 py-0.5 text-[10px] text-[#deb43e] shadow-sm dark:border-[#deb43e]/40 dark:bg-gray-800 sm:px-3 sm:text-xs">
                  {PROGRAMS.dugsi.status}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            {Object.entries(COMMUNITY_STATS).map(([key, stat]) => {
              const Icon = statIcons[key as keyof typeof statIcons]
              return (
                <div
                  key={key}
                  className="rounded-xl border border-gray-200/50 bg-white/50 p-3 text-center shadow-sm backdrop-blur-sm dark:border-gray-700/50 dark:bg-gray-800/50 sm:p-4"
                >
                  <Icon className="mx-auto mb-1 h-5 w-5 text-[#007078] dark:text-[#00a0a8] sm:h-6 sm:w-6" />
                  <div className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">
                    {stat.value}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {stat.label}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mx-auto w-full max-w-4xl">
            <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
              <div className="relative overflow-hidden rounded-xl border border-[#deb43e]/30 bg-gradient-to-r from-[#deb43e]/10 via-[#deb43e]/5 to-[#deb43e]/10 p-4 shadow-md dark:border-[#deb43e]/40 dark:from-[#deb43e]/20 dark:via-[#deb43e]/10 dark:to-[#deb43e]/20 sm:p-5">
                <div className="relative z-10 text-center">
                  <h3 className="mb-2 text-base font-bold text-gray-900 dark:text-white sm:text-lg">
                    Friday Prayer (Jummah)
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        1st Prayer
                      </p>
                      <p className="text-lg font-bold text-[#deb43e] sm:text-xl">
                        {JUMMAH_TIMES.firstPrayer}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        2nd Prayer
                      </p>
                      <p className="text-lg font-bold text-[#deb43e] sm:text-xl">
                        {JUMMAH_TIMES.secondPrayer}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-xl border border-[#007078]/20 bg-gradient-to-r from-[#007078]/10 via-[#007078]/5 to-[#007078]/10 p-4 shadow-md dark:border-[#007078]/40 dark:from-[#007078]/20 dark:via-[#007078]/10 dark:to-[#007078]/20 sm:p-5">
                <div className="relative z-10 text-center">
                  <h3 className="mb-1 text-base font-bold text-gray-900 dark:text-white sm:text-lg">
                    Youth Night
                  </h3>
                  <p className="mb-2 text-lg font-bold text-[#007078] dark:text-[#00a0a8] sm:text-xl">
                    Every Friday @ {FRIDAY_YOUTH.time}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-300">
                    {FRIDAY_YOUTH.activities.join(' • ')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <PrayerTimes />
        </div>
      </div>

      <SiteFooter />
    </div>
  )
}
