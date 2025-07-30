'use client'

import * as React from 'react'

import Image from 'next/image'

import Autoplay from 'embla-carousel-autoplay'
import useEmblaCarousel from 'embla-carousel-react'

const images = [
  {
    src: '/images/boy-students.jpg',
    alt: 'Male students studying',
  },
  {
    src: '/images/girls-students.jpg',
    alt: 'Female students studying',
  },
]

export function ImageCarousel() {
  const [emblaRef] = useEmblaCarousel({ loop: true }, [
    Autoplay({ delay: 2000, stopOnInteraction: false }),
  ])

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#007078]/5 via-transparent to-[#deb43e]/5 p-2 shadow-xl">
      <div className="overflow-hidden rounded-2xl" ref={emblaRef}>
        <div className="flex">
          {images.map((image, index) => (
            <div key={index} className="relative min-w-full flex-[0_0_100%]">
              <div className="relative aspect-video w-full overflow-hidden">
                <Image
                  src={image.src}
                  alt={image.alt}
                  fill
                  className="object-cover transition-transform duration-500 hover:scale-105"
                  priority
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation dots */}
      <div className="absolute bottom-4 left-0 right-0 z-10 flex justify-center gap-2">
        {images.map((_, index) => (
          <div
            key={index}
            className="h-1.5 w-12 rounded-full bg-white/80 backdrop-blur transition-all duration-300"
          />
        ))}
      </div>

      {/* Gradient overlay */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-t from-black/20 to-transparent" />
    </div>
  )
}
