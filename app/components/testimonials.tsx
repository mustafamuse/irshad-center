'use client'

import { useEffect, useState } from 'react'

import { motion, AnimatePresence } from 'framer-motion'
import { Quote } from 'lucide-react'

const testimonials = [
  {
    id: 1,
    quote:
      'The program has deepened my understanding of Islamic principles while maintaining a modern approach to learning.',
    author: 'Abdullah M.',
    role: 'Current Student',
  },
  {
    id: 2,
    quote:
      'The instructors are highly knowledgeable and create an engaging learning environment that encourages questions and discussion.',
    author: 'Aisha R.',
    role: 'Graduate',
  },
  {
    id: 3,
    quote:
      'The combination of traditional Islamic education with contemporary teaching methods has been invaluable for my growth.',
    author: 'Omar S.',
    role: 'Current Student',
  },
]

export function Testimonials() {
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % testimonials.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="relative overflow-hidden rounded-xl bg-[#007078]/5 p-6">
      <div className="absolute right-0 top-0 -z-10 h-32 w-32 opacity-10">
        <Quote className="h-full w-full" />
      </div>

      <div className="min-h-[200px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="space-y-4"
          >
            <p className="text-lg text-gray-600">
              "{testimonials[currentIndex].quote}"
            </p>
            <div>
              <div className="font-medium text-[#007078]">
                {testimonials[currentIndex].author}
              </div>
              <div className="text-sm text-gray-500">
                {testimonials[currentIndex].role}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation Dots */}
      <div className="mt-6 flex justify-center gap-2">
        {testimonials.map((_, index) => (
          <button
            key={index}
            className={`h-2 w-2 rounded-full transition-colors ${
              index === currentIndex ? 'bg-[#007078]' : 'bg-[#007078]/20'
            }`}
            onClick={() => setCurrentIndex(index)}
          />
        ))}
      </div>
    </div>
  )
}
