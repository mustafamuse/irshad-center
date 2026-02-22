import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { WITHDRAWAL_REASONS } from '@/lib/constants/dugsi'

interface WithdrawalReasonFormProps {
  reason: string
  reasonNote: string
  onReasonChange: (reason: string) => void
  onReasonNoteChange: (note: string) => void
}

export function WithdrawalReasonForm({
  reason,
  reasonNote,
  onReasonChange,
  onReasonNoteChange,
}: WithdrawalReasonFormProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Reason</Label>
        <Select value={reason} onValueChange={onReasonChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select a reason" />
          </SelectTrigger>
          <SelectContent>
            {WITHDRAWAL_REASONS.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {reason && (
        <div className="space-y-1.5">
          <Label>Note (optional)</Label>
          <Textarea
            value={reasonNote}
            onChange={(e) => onReasonNoteChange(e.target.value)}
            placeholder="Additional details..."
            rows={2}
          />
        </div>
      )}
    </div>
  )
}
