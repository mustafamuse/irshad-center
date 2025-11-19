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
    description: 'Deep dive into Quranic interpretation and memorization.',
    icon: BookOpenCheck,
    detailedCourses: [
      { code: 'ISE220', title: 'Introduction to Quranic Exegesis', credits: 3 },
    ],
  },
  {
    id: 2,
    name: 'Advanced Jurisprudence',
    description: 'Study complex Islamic legal rulings and principles.',
    icon: Scroll,
    detailedCourses: [
      { code: 'ISE210', title: 'Fiqh of Worship 2', credits: 3 },
      { code: 'ISE211', title: 'Fiqh of Transactions 1', credits: 3 },
      { code: 'ISE212', title: 'Fiqh of Transactions 2', credits: 3 },
      {
        code: 'ISE213',
        title: 'Contemporary Islamic Jurisprudence Issues',
        credits: 3,
      },
    ],
  },
  {
    id: 3,
    name: 'Islamic History & Civilization',
    description: 'Explore Islamic historical developments and contributions.',
    icon: History,
    detailedCourses: [
      {
        code: 'ISE240',
        title: 'Prophetic Biography Medina Period',
        credits: 3,
      },
      {
        code: 'ISE241',
        title: 'History of Rightly Guided Caliphs',
        credits: 3,
      },
    ],
  },
  {
    id: 4,
    name: 'Hadith Studies',
    description:
      'Advanced study of prophetic traditions and their application.',
    icon: Book,
    detailedCourses: [
      { code: 'ISE230', title: 'Collection of Hadith 1', credits: 3 },
      { code: 'ISE231', title: 'Collection of Hadith 2', credits: 3 },
    ],
  },
  {
    id: 5,
    name: 'Islamic Ethics & Spirituality',
    description: 'Advanced spiritual development and ethical principles.',
    icon: Heart,
    detailedCourses: [
      { code: 'ISE232', title: 'Purification of the Soul 2', credits: 3 },
    ],
  },
]

const gradingScale = [
  { grade: 'A', points: 4.0, range: '95-100%', description: 'Excellent' },
  { grade: 'A-', points: 3.7, range: '90-94%', description: 'Excellent' },
  { grade: 'B+', points: 3.3, range: '87-89%', description: 'Good' },
  { grade: 'B', points: 3.0, range: '83-86%', description: 'Good' },
  { grade: 'B-', points: 2.7, range: '80-82%', description: 'Good' },
  { grade: 'C+', points: 2.3, range: '77-79%', description: 'Satisfactory' },
  { grade: 'C', points: 2.0, range: '73-76%', description: 'Satisfactory' },
  { grade: 'C-', points: 1.7, range: '70-72%', description: 'Satisfactory' },
  { grade: 'D+', points: 1.3, range: '67-69%', description: 'Poor' },
  { grade: 'D', points: 1.0, range: '63-66%', description: 'Poor' },
  { grade: 'D-', points: 0.7, range: '60-62%', description: 'Poor' },
  { grade: 'F', points: 0.0, range: '0-59%', description: 'Failing' },
]

const expectations = [
  {
    title: 'Academic Excellence',
    items: [
      'Complete all assigned readings',
      'Participate actively in class discussions',
      'Submit assignments on time',
      'Maintain minimum 2.0 GPA',
    ],
  },
  {
    title: 'Attendance',
    items: [
      'Regular attendance is mandatory',
      'Notify administration of absences',
      'Make up missed work within one week',
      'Excessive absences may affect enrollment',
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

export function ProgramsContent() {
  return (
    <div className="relative min-h-screen bg-white">
      {/* Background decoration */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -inset-[10px] animate-gradient-slow opacity-20">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-secondary/20 to-primary/20 blur-3xl" />
        </div>
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-12"
        >
          <div className="flex items-center justify-between">
            <Button
              asChild
              variant="ghost"
              className="flex items-center gap-2 text-[#007078] transition-colors hover:bg-[#007078]/5"
            >
              <Link href="/mahad">
                <ArrowLeft className="h-4 w-4" />
                Back to Home
              </Link>
            </Button>
            <Logo size="sm" />
          </div>

          <div className="mt-12 text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              Academic Programs
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              Comprehensive 2-year Islamic education curriculum
            </p>
          </div>
        </motion.div>

        {/* Program Overview */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-16"
        >
          <Card className="border-none bg-gradient-to-br from-[#007078]/5 to-transparent p-8 shadow-lg">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-[#007078]/10 p-3">
                <GraduationCap className="h-6 w-6 text-[#007078]" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-semibold text-gray-900">
                  Program Overview
                </h2>
                <p className="mt-4 text-gray-600">
                  Our program offers a comprehensive Islamic education covering
                  essential religious sciences. Designed for late high school
                  through college-age students, the curriculum provides a solid
                  foundation in Islamic knowledge.
                </p>
                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-[#007078]" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Duration
                      </p>
                      <p className="text-sm text-gray-600">2 Years</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-[#007078]" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Class Size
                      </p>
                      <p className="text-sm text-gray-600">Small Groups</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Lightbulb className="h-5 w-5 text-[#007078]" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Format
                      </p>
                      <p className="text-sm text-gray-600">In-Person</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </motion.section>

        {/* Academic Calendar */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-16"
        >
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-bold text-gray-900">
              Academic Calendar
            </h2>
            <p className="mt-2 text-gray-600">
              Three semesters per academic year
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {semesters.map((semester, index) => (
              <motion.div
                key={semester.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
              >
                <Card className="h-full border-[#007078]/20 p-6 transition-all hover:shadow-lg">
                  <h3 className="font-semibold text-[#007078]">
                    {semester.name}
                  </h3>
                  <p className="mt-2 text-sm text-gray-600">{semester.dates}</p>
                  <p className="mt-2 text-sm font-medium text-gray-900">
                    {semester.notes}
                  </p>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* First Year Curriculum */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mb-16"
        >
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-bold text-gray-900">
              First Year Curriculum
            </h2>
            <p className="mt-2 text-gray-600">
              Foundation courses in Islamic studies
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {firstYearCourses.map((course, index) => (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5 + index * 0.1 }}
              >
                <Card className="h-full border-none bg-white p-6 shadow-lg transition-all hover:shadow-xl">
                  <div className="flex items-start gap-4">
                    <div className="rounded-lg bg-[#007078]/10 p-3">
                      <course.icon className="h-6 w-6 text-[#007078]" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-900">
                        {course.name}
                      </h3>
                      <p className="mt-2 text-sm text-gray-600">
                        {course.description}
                      </p>
                      <div className="mt-4 space-y-2">
                        {course.detailedCourses.map((detailed) => (
                          <div
                            key={detailed.code}
                            className="flex items-center justify-between rounded-lg bg-gray-50 p-3"
                          >
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {detailed.code}
                              </p>
                              <p className="text-xs text-gray-600">
                                {detailed.title}
                              </p>
                            </div>
                            <span className="text-sm text-gray-500">
                              {detailed.credits} credits
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Second Year Curriculum */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mb-16"
        >
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-bold text-gray-900">
              Second Year Curriculum
            </h2>
            <p className="mt-2 text-gray-600">
              Advanced Islamic studies and specialization
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {secondYearCourses.map((course, index) => (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.7 + index * 0.1 }}
              >
                <Card className="h-full border-none bg-white p-6 shadow-lg transition-all hover:shadow-xl">
                  <div className="flex items-start gap-4">
                    <div className="rounded-lg bg-[#deb43e]/10 p-3">
                      <course.icon className="h-6 w-6 text-[#deb43e]" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-900">
                        {course.name}
                      </h3>
                      <p className="mt-2 text-sm text-gray-600">
                        {course.description}
                      </p>
                      <div className="mt-4 space-y-2">
                        {course.detailedCourses.map((detailed) => (
                          <div
                            key={detailed.code}
                            className="flex items-center justify-between rounded-lg bg-gray-50 p-3"
                          >
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {detailed.code}
                              </p>
                              <p className="text-xs text-gray-600">
                                {detailed.title}
                              </p>
                            </div>
                            <span className="text-sm text-gray-500">
                              {detailed.credits} credits
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Grading System */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="mb-16"
        >
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-bold text-gray-900">Grading System</h2>
            <p className="mt-2 text-gray-600">
              Standard 4.0 GPA scale with Islamic perspective on learning
            </p>
          </div>
          <Card className="overflow-hidden border-none shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#007078]/5">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                      Letter Grade
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                      Grade Points
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                      Percentage
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {gradingScale.map((grade, index) => (
                    <tr
                      key={grade.grade}
                      className={`transition-colors hover:bg-gray-50 ${
                        index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                      }`}
                    >
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {grade.grade}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {grade.points}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {grade.range}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {grade.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.section>

        {/* Student Expectations */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.9 }}
          className="mb-16"
        >
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-bold text-gray-900">
              Student Expectations
            </h2>
            <p className="mt-2 text-gray-600">
              Requirements for academic and personal success
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {expectations.map((expectation, index) => (
              <motion.div
                key={expectation.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 1.0 + index * 0.1 }}
              >
                <Card className="h-full border-none bg-white p-6 shadow-lg">
                  <div className="mb-4 flex items-center gap-3">
                    <Compass className="h-6 w-6 text-[#007078]" />
                    <h3 className="text-lg font-semibold text-gray-900">
                      {expectation.title}
                    </h3>
                  </div>
                  <ul className="space-y-3">
                    {expectation.items.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#007078]" />
                        <span className="text-sm text-gray-600">{item}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* CTA */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.1 }}
          className="text-center"
        >
          <Card className="border-none bg-gradient-to-br from-[#007078] to-[#007078]/80 p-12 text-white shadow-2xl">
            <h2 className="text-3xl font-bold">Ready to Begin Your Journey?</h2>
            <p className="mt-4 text-lg text-white/90">
              Join us in this comprehensive Islamic education program
            </p>
            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="bg-white text-[#007078] hover:bg-white/90"
              >
                <Link
                  href="https://forms.gle/t38Jurtqes2pbBsVA"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Apply Now
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white bg-transparent text-white hover:bg-white/10"
              >
                <Link href="/mahad">Learn More</Link>
              </Button>
            </div>
          </Card>
        </motion.section>
      </div>
    </div>
  )
}
