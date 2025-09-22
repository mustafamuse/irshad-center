'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'light' | 'dark'
}

const sizes = {
  xs: { width: 120, height: 40 },
  sm: { width: 180, height: 60 },
  md: { width: 240, height: 80 },
  lg: { width: 360, height: 120 },
  xl: { width: 480, height: 160 },
}

export function Logo({ className, size = 'sm', variant = 'dark' }: LogoProps) {
  return (
    <div className={cn('relative flex items-center justify-center', className)}>
      <Image
        src="/images/latest-irshad-mahad.png"
        alt="Irshād Mâhad"
        width={500}
        height={500}
        className={cn(
          'h-full w-auto object-contain transition-transform duration-300',
          variant === 'light' && 'brightness-0 invert'
        )}
        priority
      />
    </div>
  )
}
