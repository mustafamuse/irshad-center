'use client'

import { motion } from 'framer-motion'

import { Progress } from '@/components/ui/progress'

interface ProgressIndicatorProps {
  isLoading: boolean
  progress: number
}

export function ProgressIndicator({
  isLoading,
  progress,
}: ProgressIndicatorProps) {
  if (!isLoading) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-2 md:space-y-3"
    >
      <Progress value={progress} className="h-1.5 md:h-2 lg:h-2.5" />
      <p className="text-center text-xs text-muted-foreground md:text-sm lg:text-base">
        {progress === 100 ? 'Complete!' : 'Processing your enrollment...'}
      </p>
    </motion.div>
  )
}
