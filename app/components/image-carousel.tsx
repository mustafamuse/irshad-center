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
    <div className="relative mx-auto max-w-5xl">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="-ml-4 flex">
          {images.map((image, index) => (
            <div key={index} className="relative flex-[0_0_100%] pl-4">
              <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg">
                <Image
                  src={image.src}
                  alt={image.alt}
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Optional: Add navigation dots */}
      <div className="absolute bottom-4 left-0 right-0 z-10 flex justify-center gap-2">
        {images.map((_, index) => (
          <div
            key={index}
            className="h-2 w-2 rounded-full bg-white/50 transition-all duration-300 hover:bg-white"
          />
        ))}
      </div>
    </div>
  )
}
