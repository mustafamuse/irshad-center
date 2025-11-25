'use client'

import { useState } from 'react'

import {
  Download,
  Loader2,
  CheckCircle2,
  ExternalLink,
  Save,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { createClientLogger } from '@/lib/logger-client'

const logger = createClientLogger('BackupButton')

interface BackupProgress {
  stage:
    | 'estimating'
    | 'students'
    | 'batches'
    | 'siblings'
    | 'payers'
    | 'subscriptions'
    | 'saving'
  percent: number
  detail: string
}

interface BackupStats {
  students: number
  withBatch: number
  withSiblings: number
  withPayer: number
  subscriptions: number
  sizeKB: number
  fileName: string
}

export function BackupButton() {
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState<BackupProgress | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [backupStats, setBackupStats] = useState<BackupStats | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleViewBackup = (fileName: string) => {
    // Open backup in new tab
    window.open(`/backups/${fileName}`, '_blank')
  }

  const handleDownload = async (fileName: string) => {
    try {
      const response = await fetch(`/api/backups/${fileName}`)
      if (!response.ok) throw new Error('Failed to download backup')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName // This triggers download instead of opening in browser
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success('Download started')
    } catch (error) {
      toast.error('Download failed', {
        description:
          error instanceof Error ? error.message : 'Failed to download backup',
      })
    }
  }

  const handleBackup = async () => {
    setIsLoading(true)
    setProgress({
      stage: 'estimating',
      percent: 0,
      detail: 'Estimating backup size...',
    })

    try {
      // Start backup with progress tracking
      const response = await fetch('/api/backup', {
        headers: {
          Accept: 'text/event-stream',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        // Parse progress updates
        const text = new TextDecoder().decode(value)
        const update = JSON.parse(text)

        if (update.type === 'progress') {
          setProgress(update.progress)
        } else if (update.type === 'complete') {
          setBackupStats(update.stats)
          setShowSuccess(true)

          // Enhanced toast with view action
          toast.success('Backup completed', {
            description: `Saved ${update.stats.students} students`,
            duration: 5000,
            action: {
              label: 'Download',
              onClick: () =>
                update.stats.fileName && handleDownload(update.stats.fileName),
            },
          })
          break
        }
      }
    } catch (error) {
      logger.error('Backup error', error)
      toast.error('Backup failed', {
        description:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred',
      })
    } finally {
      setIsLoading(false)
      setProgress(null)
      setShowConfirm(false)
    }
  }

  const formatStage = (stage: string) => {
    return (
      stage.charAt(0).toUpperCase() + stage.slice(1).replace(/([A-Z])/g, ' $1')
    )
  }

  const formatSize = (sizeKB: number) => {
    return sizeKB > 1024
      ? `${(sizeKB / 1024).toFixed(2)} MB`
      : `${sizeKB.toFixed(2)} KB`
  }

  return (
    <>
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {isLoading ? 'Backing up...' : 'Backup Data'}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Backup Student Data</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a backup of all student data, including:
              <ul className="mt-2 list-disc pl-4">
                <li>Student profiles and status</li>
                <li>Batch assignments</li>
                <li>Sibling relationships</li>
                <li>Payer information</li>
              </ul>
              {progress?.stage === 'estimating' && (
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground">
                    Estimating backup size...
                  </p>
                  <Progress value={progress.percent} className="mt-2" />
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBackup} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Backing up...
                </>
              ) : (
                'Create Backup'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Progress Dialog */}
      <Dialog open={isLoading && progress !== null} modal>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Creating Backup</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span>{formatStage(progress?.stage || '')}</span>
              <span>{progress?.percent}%</span>
            </div>
            <Progress value={progress?.percent} />
            <p className="text-sm text-muted-foreground">{progress?.detail}</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Dialog with Download Option */}
      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Backup Complete
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/50 p-4">
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt>Total Students:</dt>
                  <dd>{backupStats?.students}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>With Batch:</dt>
                  <dd>{backupStats?.withBatch}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>With Siblings:</dt>
                  <dd>{backupStats?.withSiblings}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>With Payer:</dt>
                  <dd>{backupStats?.withPayer}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Subscriptions:</dt>
                  <dd>{backupStats?.subscriptions}</dd>
                </div>
                <div className="flex justify-between font-medium">
                  <dt>Backup Size:</dt>
                  <dd>
                    {backupStats ? formatSize(backupStats.sizeKB) : '0 KB'}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                onClick={() =>
                  backupStats?.fileName && handleDownload(backupStats.fileName)
                }
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                Download
              </Button>
              <Button
                onClick={() =>
                  backupStats?.fileName &&
                  handleViewBackup(backupStats.fileName)
                }
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                View Online
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Toast with Actions */}
      {backupStats &&
        toast.success('Backup completed', {
          description: `Saved ${backupStats.students} students`,
          duration: 5000,
          action: {
            label: 'Download',
            onClick: () =>
              backupStats.fileName && handleDownload(backupStats.fileName),
          },
        })}
    </>
  )
}
