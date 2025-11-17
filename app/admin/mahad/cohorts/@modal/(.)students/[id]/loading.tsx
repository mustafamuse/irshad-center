import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Loading state for the student detail modal route.
 *
 * Shows a skeleton loader within the modal dialog while the student
 * data is being fetched. Provides visual feedback that content is loading
 * without closing the modal.
 */
export default function StudentDetailModalLoading() {
  return (
    <Dialog open>
      <DialogContent
        className="max-h-[90vh] max-w-3xl p-0"
        aria-busy="true"
        aria-label="Loading student details"
      >
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>
            <Skeleton className="h-8 w-48" />
          </DialogTitle>
          <DialogDescription>
            <Skeleton className="mt-2 h-4 w-64" />
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 px-6 pb-6">
          {/* Basic Information Section Skeleton */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-5 w-32" />
            </div>
            <div className="space-y-3">
              <div>
                <Skeleton className="mb-1 h-4 w-16" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Skeleton className="mb-1 h-4 w-12" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div>
                  <Skeleton className="mb-1 h-4 w-12" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
              <div>
                <Skeleton className="mb-1 h-4 w-20" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          </div>

          {/* Batch Section Skeleton */}
          <div className="space-y-4 border-t pt-6">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-5 w-32" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Skeleton className="mb-1 h-4 w-12" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div>
                <Skeleton className="mb-1 h-4 w-20" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Skeleton className="mb-1 h-4 w-12" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div>
                <Skeleton className="mb-1 h-4 w-16" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          </div>

          {/* Education Section Skeleton */}
          <div className="space-y-4 border-t pt-6">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-5 w-40" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Skeleton className="mb-1 h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div>
                <Skeleton className="mb-1 h-4 w-20" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
            <div>
              <Skeleton className="mb-1 h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
