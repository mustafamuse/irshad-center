/**
 * Swipeable Card Component
 * Enables iOS-style swipe actions on mobile devices
 */
'use client'

import React, { useRef, useState } from 'react'

import { motion, PanInfo, useMotionValue, useTransform } from 'framer-motion'
import { LucideIcon } from 'lucide-react'

export interface SwipeAction {
  icon: LucideIcon
  label: string
  color: 'blue' | 'green' | 'yellow' | 'red'
  onAction: () => void
}

interface SwipeableCardProps {
  children: React.ReactNode
  leftActions?: SwipeAction[]
  rightActions?: SwipeAction[]
  disabled?: boolean
}

const colorClasses = {
  blue: 'bg-blue-500 hover:bg-blue-600 text-white',
  green: 'bg-green-500 hover:bg-green-600 text-white',
  yellow: 'bg-yellow-500 hover:bg-yellow-600 text-white',
  red: 'bg-red-500 hover:bg-red-600 text-white',
}

export function SwipeableCard({
  children,
  leftActions = [],
  rightActions = [],
  disabled = false,
}: SwipeableCardProps) {
  const [isSwiping, setIsSwiping] = useState(false)
  const x = useMotionValue(0)
  const cardRef = useRef<HTMLDivElement>(null)

  // Calculate action button widths
  const actionWidth = 80
  const maxLeftSwipe = leftActions.length * actionWidth
  const maxRightSwipe = rightActions.length * actionWidth

  // Transform for action buttons visibility
  const leftActionsOpacity = useTransform(x, [0, maxLeftSwipe], [0, 1])
  const rightActionsOpacity = useTransform(x, [-maxRightSwipe, 0], [1, 0])

  const handleDragEnd = (
    _: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    setIsSwiping(false)

    const threshold = 50
    const offset = info.offset.x
    const velocity = info.velocity.x

    // Determine if swipe should reveal actions
    if (offset > threshold || velocity > 500) {
      // Swipe right - reveal left actions
      if (leftActions.length > 0) {
        x.set(maxLeftSwipe)
      } else {
        x.set(0)
      }
    } else if (offset < -threshold || velocity < -500) {
      // Swipe left - reveal right actions
      if (rightActions.length > 0) {
        x.set(-maxRightSwipe)
      } else {
        x.set(0)
      }
    } else {
      // Return to center
      x.set(0)
    }
  }

  const handleDragStart = () => {
    setIsSwiping(true)
  }

  const handleActionClick = (action: SwipeAction) => {
    action.onAction()
    // Reset card position after action
    x.set(0)
  }

  // If disabled, render children without swipe wrapper to maintain consistent structure
  if (disabled) {
    return (
      <div ref={cardRef} className="h-full">
        {children}
      </div>
    )
  }

  return (
    <div
      className="relative h-full overflow-hidden md:overflow-visible"
      ref={cardRef}
    >
      {/* Left actions (revealed when swiping right) */}
      {leftActions.length > 0 && (
        <motion.div
          className="absolute bottom-0 left-0 top-0 flex items-center"
          style={{ opacity: leftActionsOpacity }}
        >
          {leftActions.map((action, index) => {
            const Icon = action.icon
            return (
              <button
                key={`left-${index}`}
                onClick={() => handleActionClick(action)}
                className={`flex h-full flex-col items-center justify-center gap-1 px-6 ${colorClasses[action.color]} transition-colors`}
                style={{ width: actionWidth }}
                aria-label={action.label}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs font-medium">{action.label}</span>
              </button>
            )
          })}
        </motion.div>
      )}

      {/* Right actions (revealed when swiping left) */}
      {rightActions.length > 0 && (
        <motion.div
          className="absolute bottom-0 right-0 top-0 flex items-center"
          style={{ opacity: rightActionsOpacity }}
        >
          {rightActions.map((action, index) => {
            const Icon = action.icon
            return (
              <button
                key={`right-${index}`}
                onClick={() => handleActionClick(action)}
                className={`flex h-full flex-col items-center justify-center gap-1 px-6 ${colorClasses[action.color]} transition-colors`}
                style={{ width: actionWidth }}
                aria-label={action.label}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs font-medium">{action.label}</span>
              </button>
            )
          })}
        </motion.div>
      )}

      {/* Swipeable card content */}
      <motion.div
        drag="x"
        dragConstraints={{
          left: -maxRightSwipe,
          right: maxLeftSwipe,
        }}
        dragElastic={0.1}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className={`relative bg-background ${isSwiping ? 'cursor-grabbing' : 'cursor-grab touch-pan-y'}`}
      >
        {children}
      </motion.div>
    </div>
  )
}
