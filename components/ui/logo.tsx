'use client'

import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'light' | 'dark'
}

export function Logo({ className, size = 'sm', variant = 'dark' }: LogoProps) {
  const pathname = usePathname()

  // Determine which logo to show based on route
  const getLogoPath = () => {
    if (pathname.startsWith('/mahad')) {
      return '/images/Mahad.svg'
    } else if (pathname.startsWith('/dugsi')) {
      return '/images/Dugsi.svg'
    } else {
      return '/images/Mosque.svg'
    }
  }

  const getLogoAlt = () => {
    if (pathname.startsWith('/mahad')) {
      return 'Irshād Māhad'
    } else if (pathname.startsWith('/dugsi')) {
      return 'Irshād Dugsi'
    } else {
      return 'Irshād Center'
    }
  }

  return (
    <div className={cn('relative flex items-center justify-center', className)}>
      <Image
        src={getLogoPath()}
        alt={getLogoAlt()}
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
