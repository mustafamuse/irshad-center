import Image from 'next/image'
import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'light' | 'dark'
}

const sizes = {
  xs: { width: 120, height: 120 },
  sm: { width: 160, height: 160 },
  md: { width: 200, height: 200 },
  lg: { width: 300, height: 300 },
  xl: { width: 400, height: 400 },
}

export function Logo({ className, size = 'sm', variant = 'dark' }: LogoProps) {
  const dimensions = sizes[size]

  return (
    <div
      className={cn(
        'relative flex w-full items-center justify-center',
        className
      )}
    >
      <Image
        src="/images/Latest Irshad Mahad.png"
        alt="Irshād Mâhad"
        width={600}
        height={400}
        className={cn(
          'object-contain transition-transform duration-300 hover:scale-105',
          variant === 'light' && 'brightness-0 invert'
        )}
        priority
        style={{
          color: 'transparent',
          width: '100%',
          height: 'auto',
          background: 'transparent',
        }}
      />
    </div>
  )
}
