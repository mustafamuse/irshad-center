'use client'

import { useEffect, useState } from 'react'

import { animate } from 'framer-motion'

function formatWholeDollars(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

interface AnimatedStatProps {
  value: number
  format?: 'number' | 'dollars'
  duration?: number
}

export function AnimatedStat({
  value,
  format = 'number',
  duration = 1.5,
}: AnimatedStatProps) {
  const [display, setDisplay] = useState(format === 'dollars' ? '$0' : '0')

  useEffect(() => {
    const controls = animate(0, value, {
      duration,
      ease: 'easeOut',
      onUpdate(latest) {
        setDisplay(
          format === 'dollars'
            ? formatWholeDollars(latest)
            : Math.round(latest).toString()
        )
      },
    })

    return () => controls.stop()
  }, [value, format, duration])

  return <span>{display}</span>
}
