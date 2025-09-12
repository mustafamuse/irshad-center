'use client'

import * as React from 'react'

import Image from 'next/image'

import Autoplay from 'embla-carousel-autoplay'
import useEmblaCarousel from 'embla-carousel-react'

const images = [
  {
    src: '/images/grad-1.JPG',
    alt: 'Graduation ceremony',
  },
  {
    src: '/images/grad-2.jpeg',
    alt: 'Graduation celebration',
  },
  {
    src: '/images/grad-3.jpeg',
    alt: 'Graduates',
  },
  {
    src: '/images/grad-4.png',
    alt: 'Graduation moment',
  },
  {
    src: '/images/grad-5.JPG',
    alt: 'Graduation group',
  },
  {
    src: '/images/grad-6.JPG',
    alt: 'Graduation class',
  },
  {
    src: '/images/grad-7.JPG',
    alt: 'Graduation ceremony',
  },
  {
    src: '/images/grad-8.png',
    alt: 'Graduation celebration',
  },
  {
    src: '/images/grad-9.png',
    alt: 'Graduation moment',
  },
  {
    src: '/images/grad-10.png',
    alt: 'Graduation group photo',
  },
  {
    src: '/images/grad-11.png',
    alt: 'Graduation ceremony',
  },
  {
    src: '/images/grad-12.png',
    alt: 'Graduation celebration',
  },
]

export function ImageCarousel() {
  const [emblaRef] = useEmblaCarousel(
    {
      loop: true,
      dragFree: true,
      containScroll: 'trimSnaps',
      skipSnaps: false,
      startIndex: 0,
    },
    [Autoplay({ delay: 3500, stopOnInteraction: false })]
  )

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#007078]/5 via-transparent to-[#deb43e]/5 p-2 shadow-xl">
      <div className="overflow-hidden rounded-2xl" ref={emblaRef}>
        <div className="flex">
          {images.map((image, index) => (
            <div
              key={index}
              className="relative min-w-full flex-[0_0_100%] transition-transform duration-500 hover:scale-[1.02]"
            >
              <div className="relative w-full">
                {/* Container with max height */}
                <div className="relative h-[300px] w-full sm:h-[400px] md:h-[500px] lg:h-[600px]">
                  <Image
                    src={image.src}
                    alt={image.alt}
                    fill
                    className="object-contain" // Changed from object-cover to object-contain
                    priority={index === 0}
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 70vw"
                  />
                </div>
                {/* Dark gradient background to ensure text readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation dots */}
      <div className="absolute bottom-4 left-0 right-0 z-10 flex justify-center">
        <div className="scrollbar-hide flex max-w-[90%] gap-2 overflow-x-auto px-4 pb-2">
          {images.map((_, index) => (
            <div
              key={index}
              className="h-1.5 w-6 flex-shrink-0 rounded-full bg-white/80 backdrop-blur transition-all duration-300 sm:w-8"
            />
          ))}
        </div>
      </div>
    </div>
  )
}
