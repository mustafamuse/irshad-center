'use client'

import Link from 'next/link'

import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Book,
  BookOpenCheck,
  BookText,
  CheckCircle,
  Clock,
  Compass,
  GraduationCap,
  Heart,
  History,
  Lightbulb,
  Scroll,
  Users,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Logo } from '@/components/ui/logo'

const semesters = [
  {
    name: 'Fall Semester 2024',
    dates: 'July 7 - October 19, 2024',
    notes: 'Final Exams: October 18-19',
  },
  {
    name: 'Winter Semester 2024-2025',
    dates: 'November 1, 2024 - February 2, 2025',
    notes: 'Winter Break: January 3-16',
  },
  {
    name: 'Spring Semester 2025',
    dates: 'February 15 - May 25, 2025',
    notes: 'Ramadan & Eid Break: March 21-30',
  },
]

const firstYearCourses = [
  {
    id: 1,
    name: 'Quranic Studies',
    description:
      'Learn proper recitation, memorization techniques, and basic Quranic interpretation.',
    icon: BookOpenCheck,
    detailedCourses: [
      { code: 'ISE120', title: 'Rules of Quranic Recitation', credits: 3 },
      {
        code: 'ISE121',
        title: "Introduction to the Qur'anic Studies",
        credits: 3,
      },
    ],
  },
  {
    id: 2,
    name: 'Islamic Creed & Jurisprudence',
    description:
      'Study fundamental Islamic beliefs and practical religious rulings.',
    icon: BookText,
    detailedCourses: [
      { code: 'ISE100', title: 'Islamic Creed 1', credits: 3 },
      { code: 'ISE101', title: 'Islamic Creed 2', credits: 3 },
      {
        code: 'ISE110',
        title: 'The History of Islamic Jurisprudence',
        credits: 3,
      },
      { code: 'ISE111', title: 'Fiqh of Worship 1', credits: 3 },
    ],
  },
  {
    id: 3,
    name: 'Prophetic Studies',
    description:
      'Learn about the life of Prophet Muhammad ﷺ and authentic hadith.',
    icon: History,
    detailedCourses: [
      { code: 'ISE130', title: 'Introduction to Hadeeth Sciences', credits: 3 },
      { code: 'ISE140', title: 'Stories of the Prophets', credits: 3 },
      { code: 'ISE141', title: 'Prophetic Biography Makka Period', credits: 3 },
    ],
  },
  {
    id: 4,
    name: 'Spiritual Development',
    description: 'Focus on character development and spiritual purification.',
    icon: Heart,
    detailedCourses: [
      { code: 'ISE131', title: 'Purification of the Soul 1', credits: 3 },
    ],
  },
]

const secondYearCourses = [
  {
    id: 1,
    name: 'Advanced Quranic Studies',
    description:
      'Deep dive into Quranic exegesis and advanced interpretation methods.',
    icon: Scroll,
    detailedCourses: [
      {
        code: 'ISE220',
        title: 'Usul At Tafseer - Analytical Quranic 1',
        credits: 3,
      },
      {
        code: 'ISE240',
        title: 'Usul At Tafseer - Analytical Quranic 2',
        credits: 3,
      },
    ],
  },
  {
    id: 2,
    name: 'Advanced Islamic Studies',
    description: 'Study advanced topics in Islamic law and jurisprudence.',
    icon: BookText,
    detailedCourses: [
      { code: 'ISE210', title: 'Fiqh of Worship 2', credits: 3 },
      {
        code: 'ISE211',
        title: 'Introduction to the Principles of Jurisprudence',
        credits: 3,
      },
      {
        code: 'ISE221',
        title: 'An Understanding of Heretical Innovation',
        credits: 3,
      },
    ],
  },
  {
    id: 3,
    name: 'Islamic History',
    description: 'Study the history of early Islam and its development.',
    icon: Compass,
    detailedCourses: [
      {
        code: 'ISE200',
        title: 'Prophetic Biography Madina Period',
        credits: 3,
      },
      {
        code: 'ISE201',
        title: 'The History of the Rightly Guided Caliphs',
        credits: 3,
      },
    ],
  },
  {
    id: 4,
    name: 'Character & Education',
    description: 'Focus on Islamic manners and educational principles.',
    icon: Lightbulb,
    detailedCourses: [
      { code: 'ISE230', title: 'Islamic Manners', credits: 3 },
      { code: 'ISE231', title: 'Purification of the Soul 2', credits: 3 },
      {
        code: 'ISE241',
        title: 'Introduction to Islamic Education',
        credits: 3,
      },
    ],
  },
]

const gradeScale = [
  { letter: 'A', range: '90 - 100%' },
  { letter: 'B', range: '80 - 89%' },
  { letter: 'C', range: '70 - 79%' },
  { letter: 'D', range: '60 - 69%' },
  { letter: 'F', range: 'Below 60%' },
]

const gradeComponents = [
  { name: 'Class Participation', weight: 10 },
  { name: 'Homework & Assignments', weight: 30 },
  { name: 'Quizzes', weight: 20 },
  { name: 'Final Exam', weight: 40 },
]

const studentExpectations = [
  {
    title: 'Academic Responsibilities',
    items: [
      'Attend all classes punctually',
      'Complete assignments with integrity',
      'Submit work on time',
      'Actively participate in discussions',
    ],
  },
  {
    title: 'Personal Conduct',
    items: [
      'Maintain respectful behavior',
      'Practice good time management',
      'Adhere to Islamic etiquette',
      "Follow Ma'had's code of conduct",
    ],
  },
]

export default function ProgramsPage() {
  return (
    <div className="relative min-h-screen bg-white">
      {/* Background decoration */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -inset-[10px] animate-gradient-slow opacity-20">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-secondary/20 to-primary/20 blur-3xl" />
        </div>
      </div>

      <div className="container relative px-4 py-8 md:py-16">
        <div className="mx-auto max-w-5xl">
          {/* Back Button and Logo */}
          <div className="mb-8 flex items-center justify-between md:mb-12">
            <Button
              asChild
              variant="ghost"
              className="h-10 gap-2 rounded-xl text-sm text-[#007078] hover:bg-[#007078]/10"
            >
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back to Home</span>
                <span className="sm:hidden">Back</span>
              </Link>
            </Button>
            <div className="w-24 sm:w-32">
              <Logo size="sm" />
            </div>
          </div>

          {/* Header */}
          <div className="relative mb-8 text-center sm:mb-12">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="text-2xl font-bold tracking-tight text-[#007078] sm:text-4xl lg:text-5xl"
            >
              Irshād Māhad Program
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="mx-auto mt-3 max-w-2xl px-4 text-sm leading-relaxed text-gray-600 sm:mt-4 sm:text-base md:text-lg"
            >
              Discover a comprehensive Islamic education program that combines
              traditional knowledge with modern learning approaches.
            </motion.p>
          </div>

          {/* Content */}
          <div className="space-y-6 sm:space-y-8 md:space-y-12">
            {/* Overview Section */}
            <section>
              <Card className="overflow-hidden rounded-2xl border-0 bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:p-6 lg:p-8">
                <div className="grid gap-6 md:grid-cols-3 md:gap-8">
                  <div className="md:col-span-2">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="rounded-full bg-[#007078]/10 p-2">
                        <GraduationCap className="h-5 w-5 text-[#007078]" />
                      </div>
                      <h2 className="text-lg font-semibold sm:text-xl md:text-2xl">
                        Program Overview
                      </h2>
                    </div>
                    <div className="prose prose-gray dark:prose-invert max-w-none">
                      <p className="text-sm leading-relaxed text-gray-600 sm:text-base">
                        Our flagship program offers a structured curriculum in
                        Islamic Studies, Arabic language, and Quranic Sciences.
                        Learn more about our accrediting institution at{' '}
                        <Link
                          href="https://site.ium.edu.so/en"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#007078] transition-colors hover:text-[#deb43e]"
                        >
                          site.ium.edu.so
                        </Link>
                      </p>
                      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 md:mt-6">
                        <div>
                          <h3 className="mb-3 text-base font-medium md:text-lg">
                            What's included
                          </h3>
                          <ul className="space-y-3">
                            {[
                              'Comprehensive Islamic Studies',
                              'Arabic Language',
                              'Quranic Sciences',
                            ].map((item, index) => (
                              <li
                                key={index}
                                className="flex items-start gap-2"
                              >
                                <div className="mt-1 rounded-full bg-[#deb43e]/10 p-1">
                                  <CheckCircle className="h-4 w-4 text-[#deb43e]" />
                                </div>
                                <span className="text-sm text-gray-600 sm:text-base">
                                  {item}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <ul className="space-y-3">
                            {[
                              'Islamic History',
                              'Islamic Jurisprudence',
                              'Character Development',
                            ].map((item, index) => (
                              <li
                                key={index}
                                className="flex items-start gap-2"
                              >
                                <div className="mt-1 rounded-full bg-[#deb43e]/10 p-1">
                                  <CheckCircle className="h-4 w-4 text-[#deb43e]" />
                                </div>
                                <span className="text-sm text-gray-600 sm:text-base">
                                  {item}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-[#007078] p-4 text-white sm:p-6">
                    <h3 className="mb-4 text-base font-medium text-white/90 sm:mb-6 sm:text-lg">
                      Full Program Details
                    </h3>
                    <div className="mb-4 text-center sm:mb-6">
                      <div className="text-3xl font-bold sm:text-4xl md:text-5xl">
                        60
                      </div>
                      <div className="text-sm text-white/80">credit hours</div>
                    </div>
                    <Button
                      size="lg"
                      className="w-full gap-2 rounded-full bg-[#deb43e] text-[#007078] transition-colors hover:bg-[#deb43e]/90"
                      asChild
                    >
                      <Link
                        href="#curriculum"
                        className="flex items-center justify-center gap-2"
                      >
                        View Full Curriculum
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                    <p className="mt-3 text-center text-xs text-white/70 sm:text-sm">
                      Classes held at our Eden Prairie location
                    </p>
                  </div>
                </div>
              </Card>
            </section>

            {/* Instructors & Materials */}
            <section className="grid gap-4 sm:grid-cols-2 sm:gap-6">
              <Card className="rounded-2xl border-0 p-4 shadow-sm ring-1 ring-gray-200 sm:p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-full bg-[#007078]/10 p-2">
                    <Users className="h-5 w-5 text-[#007078]" />
                  </div>
                  <h3 className="text-base font-semibold sm:text-lg">
                    Instructors
                  </h3>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    'Sheikh Nuur Hassan',
                    'Sheikh Abdulrahman Ali',
                    'Sheikh Mustafa Muse',
                  ].map((name, index) => (
                    <div key={index}>
                      <div className="text-sm font-medium text-gray-600 sm:text-base">
                        {name}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="rounded-2xl border-0 p-4 shadow-sm ring-1 ring-gray-200 sm:p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-full bg-[#007078]/10 p-2">
                    <Book className="h-5 w-5 text-[#007078]" />
                  </div>
                  <h3 className="text-base font-semibold sm:text-lg">
                    Required Materials
                  </h3>
                </div>
                <ul className="space-y-2 text-sm text-gray-600 sm:text-base">
                  <li>
                    Islamic Studies: Islamic University Minnesota curriculum
                  </li>
                  <li>Arabic: Nahw, Ta'beer and Specialized Books</li>
                </ul>
              </Card>
            </section>

            {/* Academic Calendar */}
            <section>
              <Card className="rounded-2xl border-0 p-4 shadow-sm ring-1 ring-gray-200 sm:p-6 md:p-8">
                <div className="mb-4 flex items-center gap-3 sm:mb-6">
                  <div className="rounded-full bg-[#007078]/10 p-2">
                    <Clock className="h-5 w-5 text-[#007078]" />
                  </div>
                  <h2 className="text-lg font-semibold sm:text-xl md:text-2xl">
                    Academic Calendar 2024-2025
                  </h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 md:gap-6">
                  {semesters.map((semester, i) => (
                    <div
                      key={i}
                      className="rounded-xl bg-[#007078]/5 p-4 transition-colors hover:bg-[#007078]/10"
                    >
                      <h4 className="mb-2 text-sm font-medium text-[#007078] sm:text-base">
                        {semester.name}
                      </h4>
                      <p className="text-xs text-gray-600 sm:text-sm">
                        {semester.dates}
                      </p>
                      {semester.notes && (
                        <p className="mt-2 text-xs text-gray-600 sm:text-sm">
                          {semester.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            </section>

            {/* Curriculum */}
            <section id="curriculum">
              <Card className="rounded-2xl border-0 p-4 shadow-sm ring-1 ring-gray-200 sm:p-6 md:p-8">
                <div className="mb-4 flex items-center gap-3 sm:mb-6">
                  <div className="rounded-full bg-[#007078]/10 p-2">
                    <Book className="h-5 w-5 text-[#007078]" />
                  </div>
                  <h2 className="text-lg font-semibold sm:text-xl md:text-2xl">
                    Curriculum
                  </h2>
                </div>

                {/* First Year */}
                <div className="space-y-6 sm:space-y-8">
                  <div>
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-base font-medium sm:text-lg md:text-xl">
                        First Year
                      </h3>
                      <span className="rounded-full bg-[#007078]/10 px-3 py-1 text-xs font-medium text-[#007078] sm:text-sm">
                        30 credits
                      </span>
                    </div>
                    <div className="space-y-4">
                      {firstYearCourses.map((course, i) => (
                        <div
                          key={i}
                          className="overflow-hidden rounded-xl border bg-white shadow-sm"
                        >
                          <div className="border-b p-4">
                            <div className="mb-2 flex items-center gap-3">
                              <div className="rounded-full bg-[#007078]/10 p-1.5">
                                <course.icon className="h-4 w-4 text-[#007078]" />
                              </div>
                              <h4 className="text-sm font-medium sm:text-base">
                                {course.name}
                              </h4>
                            </div>
                            <p className="text-xs text-gray-600 sm:text-sm">
                              {course.description}
                            </p>
                          </div>
                          <div className="divide-y">
                            {course.detailedCourses.map((detailed, j) => (
                              <div
                                key={j}
                                className="flex items-center justify-between p-3 transition-colors hover:bg-[#007078]/5"
                              >
                                <div className="flex-1 space-y-1">
                                  <div className="flex items-center gap-2">
                                    <code className="rounded bg-[#deb43e]/10 px-1.5 py-0.5 font-mono text-xs text-[#deb43e]">
                                      {detailed.code}
                                    </code>
                                    <span className="text-xs font-medium text-gray-600">
                                      {detailed.credits} cr
                                    </span>
                                  </div>
                                  <div className="text-xs text-gray-600 sm:text-sm">
                                    {detailed.title}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Second Year */}
                  <div>
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-base font-medium sm:text-lg md:text-xl">
                        Second Year
                      </h3>
                      <span className="rounded-full bg-[#007078]/10 px-3 py-1 text-xs font-medium text-[#007078] sm:text-sm">
                        30 credits
                      </span>
                    </div>
                    <div className="space-y-4">
                      {secondYearCourses.map((course, i) => (
                        <div
                          key={i}
                          className="overflow-hidden rounded-xl border bg-white shadow-sm"
                        >
                          <div className="border-b p-4">
                            <div className="mb-2 flex items-center gap-3">
                              <div className="rounded-full bg-[#007078]/10 p-1.5">
                                <course.icon className="h-4 w-4 text-[#007078]" />
                              </div>
                              <h4 className="text-sm font-medium sm:text-base">
                                {course.name}
                              </h4>
                            </div>
                            <p className="text-xs text-gray-600 sm:text-sm">
                              {course.description}
                            </p>
                          </div>
                          <div className="divide-y">
                            {course.detailedCourses.map((detailed, j) => (
                              <div
                                key={j}
                                className="flex items-center justify-between p-3 transition-colors hover:bg-[#007078]/5"
                              >
                                <div className="flex-1 space-y-1">
                                  <div className="flex items-center gap-2">
                                    <code className="rounded bg-[#deb43e]/10 px-1.5 py-0.5 font-mono text-xs text-[#deb43e]">
                                      {detailed.code}
                                    </code>
                                    <span className="text-xs font-medium text-gray-600">
                                      {detailed.credits} cr
                                    </span>
                                  </div>
                                  <div className="text-xs text-gray-600 sm:text-sm">
                                    {detailed.title}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            </section>

            {/* Grading & Assessment */}
            <section>
              <Card className="rounded-2xl border-0 p-4 shadow-sm ring-1 ring-gray-200 sm:p-6 md:p-8">
                <div className="mb-4 flex items-center gap-3 sm:mb-6">
                  <div className="rounded-full bg-[#007078]/10 p-2">
                    <CheckCircle className="h-5 w-5 text-[#007078]" />
                  </div>
                  <h2 className="text-lg font-semibold sm:text-xl md:text-2xl">
                    Grading & Assessment
                  </h2>
                </div>
                <div className="grid gap-6 sm:grid-cols-2 sm:gap-8">
                  <div>
                    <h3 className="mb-4 text-base font-medium sm:text-lg">
                      Grade Scale
                    </h3>
                    <div className="space-y-2">
                      {gradeScale.map((grade, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between rounded-lg bg-[#007078]/5 p-3"
                        >
                          <span className="text-sm font-medium text-[#007078] sm:text-base">
                            {grade.letter}
                          </span>
                          <span className="text-xs text-gray-600 sm:text-sm">
                            {grade.range}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="mb-4 text-base font-medium sm:text-lg">
                      Grade Components
                    </h3>
                    <div className="space-y-2">
                      {gradeComponents.map((component, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between rounded-lg bg-[#007078]/5 p-3"
                        >
                          <span className="text-xs text-gray-600 sm:text-sm">
                            {component.name}
                          </span>
                          <span className="text-sm font-medium text-[#007078] sm:text-base">
                            {component.weight}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            </section>

            {/* Student Expectations */}
            <section>
              <Card className="rounded-2xl border-0 p-4 shadow-sm ring-1 ring-gray-200 sm:p-6 md:p-8">
                <div className="mb-4 flex items-center gap-3 sm:mb-6">
                  <div className="rounded-full bg-[#007078]/10 p-2">
                    <Users className="h-5 w-5 text-[#007078]" />
                  </div>
                  <h2 className="text-lg font-semibold sm:text-xl md:text-2xl">
                    Student Expectations
                  </h2>
                </div>
                <div className="space-y-4 sm:space-y-6">
                  <p className="text-xs text-gray-600 sm:text-sm">
                    Students in the two-year Ma'had Program are expected to
                    maintain high academic and behavioral standards:
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {studentExpectations.map((category, i) => (
                      <div
                        key={i}
                        className="rounded-xl bg-[#007078]/5 p-4 sm:p-6"
                      >
                        <h3 className="mb-4 text-base font-medium text-[#007078] sm:text-lg">
                          {category.title}
                        </h3>
                        <ul className="space-y-3">
                          {category.items.map((item, j) => (
                            <li key={j} className="flex items-start gap-3">
                              <div className="mt-1 rounded-full bg-[#deb43e]/10 p-1">
                                <CheckCircle className="h-4 w-4 text-[#deb43e]" />
                              </div>
                              <span className="text-xs text-gray-600 sm:text-sm">
                                {item}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </section>

            {/* CTA */}
            <section className="mt-8 text-center sm:mt-12">
              <Button
                size="lg"
                className="h-12 w-full rounded-full bg-[#007078] px-8 text-white transition-colors hover:bg-[#007078]/90 sm:h-14 sm:w-auto"
                asChild
              >
                <Link
                  href="https://forms.gle/t38Jurtqes2pbBsVA"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2"
                >
                  Begin Your Journey
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
