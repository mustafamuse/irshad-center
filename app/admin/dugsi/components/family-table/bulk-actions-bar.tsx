'use client'

import { useState } from 'react'

import * as Sentry from '@sentry/nextjs'
import { AnimatePresence, motion } from 'framer-motion'
import { Link2, Loader2, X, CheckCircle2, XCircle } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

import { Family, BulkPaymentLinkResult } from '../../_types'
import { bulkGeneratePaymentLinksAction } from '../../actions'
import { useDugsiUIStore } from '../../store'

interface BulkActionsBarProps {
  selectedFamilies: Family[]
}

export function BulkActionsBar({ selectedFamilies }: BulkActionsBarProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const clearSelection = useDugsiUIStore((state) => state.clearSelection)

  const selectedCount = selectedFamilies.length

  const eligibleFamilies = selectedFamilies.filter((f) => {
    const member = f.members[0]
    return member?.familyReferenceId && !f.hasSubscription
  })

  const handleBulkGenerateLinks = async () => {
    if (eligibleFamilies.length === 0) {
      toast.error('No eligible families selected', {
        description:
          'Selected families must have a family ID and no active subscription',
      })
      return
    }

    setIsGenerating(true)

    try {
      const familyIds = eligibleFamilies
        .map((f) => f.members[0]?.familyReferenceId)
        .filter((id): id is string => !!id)

      const result = await bulkGeneratePaymentLinksAction({ familyIds })

      if (result.success && result.data) {
        const { links, failed } = result.data as BulkPaymentLinkResult

        if (links.length > 0) {
          const linksText = links
            .map((l) => `${l.familyName}: ${l.paymentUrl}`)
            .join('\n')

          await navigator.clipboard.writeText(linksText)

          toast.success(`${links.length} payment links copied`, {
            description: 'Payment links have been copied to your clipboard',
            icon: <CheckCircle2 className="h-4 w-4" />,
          })
        }

        if (failed.length > 0) {
          toast.warning(`${failed.length} links failed to generate`, {
            description: failed.map((f) => f.familyName).join(', '),
            icon: <XCircle className="h-4 w-4" />,
          })
        }

        clearSelection()
      } else {
        toast.error('Failed to generate payment links', {
          description: result.error,
        })
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'BulkActionsBar',
          operation: 'bulkGeneratePaymentLinks',
        },
        extra: { familyCount: eligibleFamilies.length },
      })
      toast.error('Failed to generate payment links', {
        description:
          error instanceof Error ? error.message : 'An error occurred',
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="sticky bottom-4 z-50 mx-auto mt-4 w-fit"
        >
          <Card className="border-primary/20 bg-background/95 px-4 py-2 shadow-lg backdrop-blur">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">
                {selectedCount} {selectedCount === 1 ? 'family' : 'families'}{' '}
                selected
              </span>
              <Button
                size="sm"
                onClick={handleBulkGenerateLinks}
                disabled={isGenerating || eligibleFamilies.length === 0}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Link2 className="mr-2 h-4 w-4" />
                    Send Payment Links
                    {eligibleFamilies.length < selectedCount && (
                      <span className="ml-1 text-xs opacity-75">
                        ({eligibleFamilies.length})
                      </span>
                    )}
                  </>
                )}
              </Button>
              <Button size="sm" variant="ghost" onClick={clearSelection}>
                <X className="mr-1 h-4 w-4" />
                Clear
              </Button>
            </div>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
