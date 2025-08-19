'use client'

import { motion } from 'framer-motion'
import { Quote } from 'lucide-react'

const testimonials = [
  {
    text: "Coming to Ma'had class is honestly the highlight of my week. Each day I learn something new, and it impacts my relationship with Allah SWT immensely. I find myself leaving class and feeling spiritually uplifted each time.",
    highlight: 'Spiritual Growth',
  },
  {
    text: 'After every lesson, I realized my mistakes in salah and actively fixed them. I loved tafseer because I truly understood the meaning of what Allah was telling me. The program helped me directly apply the rulings in my life.',
    highlight: 'Practical Application',
  },
  {
    text: 'The poems about Tazkiyatul Nafs and other subjects have had the greatest impact on me spiritually. The teachers connect the lessons to our daily lives, helping us learn not just the stories but how to be better servants to Allah.',
    highlight: 'Deep Understanding',
  },
  {
    text: 'Having access to teachers and being able to ask any question was invaluable. Both instructors are very approachable and create a comfortable learning environment. The fiqh classes especially helped me address doubts and gain confidence in my practice.',
    highlight: 'Supportive Environment',
  },
  {
    text: 'For me, the most beneficial aspect was learning the correct way to perform prayers. I realized I had been doing some movements incorrectly my whole life. Once I learned the proper way, everything shifted - it helped me become more present and intentional in my salah.',
    highlight: 'Transformative Learning',
  },
]

export function Testimonials() {
  return (
    <section className="bg-white py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#007078]/10 px-4 py-2 text-sm font-medium text-[#007078]">
            Latest Student Survey Results
          </div>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-[#007078] sm:text-4xl">
            In Their Own Words
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Anonymous responses from our current students when asked:
            <span className="mt-2 block font-medium italic text-gray-900">
              "What is the most spiritually beneficial thing you've learned so
              far with us?"
            </span>
          </p>
        </div>
        <div className="mt-12 space-y-8 md:grid md:grid-cols-2 md:gap-8 md:space-y-0 lg:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="relative rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200"
            >
              <div className="absolute -top-4 left-6 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#007078]">
                <Quote className="h-4 w-4 text-white" />
              </div>
              <div className="mt-4">
                <div className="mb-2 text-sm font-medium text-[#deb43e]">
                  {testimonial.highlight}
                </div>
                <p className="text-base leading-relaxed text-gray-600">
                  "{testimonial.text}"
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
