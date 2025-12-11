import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'

interface DialogSubmitFooterProps {
  onCancel: () => void
  isSubmitting: boolean
  submitLabel?: string
  submittingLabel?: string
}

export function DialogSubmitFooter({
  onCancel,
  isSubmitting,
  submitLabel = 'Save',
  submittingLabel = 'Saving...',
}: DialogSubmitFooterProps) {
  return (
    <DialogFooter>
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={isSubmitting}
      >
        Cancel
      </Button>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? submittingLabel : submitLabel}
      </Button>
    </DialogFooter>
  )
}
