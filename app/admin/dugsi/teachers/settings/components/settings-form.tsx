'use client'

import { useTransition, useState } from 'react'

import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { updateAttendanceConfigAction } from '../../attendance/actions'

interface Props {
  initialMorning: number
  initialAfternoon: number
}

export function SettingsForm({ initialMorning, initialAfternoon }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [morning, setMorning] = useState(initialMorning)
  const [afternoon, setAfternoon] = useState(initialAfternoon)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function handleSave() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const result = await updateAttendanceConfigAction({
        morningAutoMarkMinutes: morning,
        afternoonAutoMarkMinutes: afternoon,
      })
      if (result?.serverError) {
        setError(result.serverError)
        return
      }
      setSaved(true)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="space-y-2">
        <Label htmlFor="morning-minutes">
          Morning auto-mark delay (minutes after 9:00 AM)
        </Label>
        <Input
          id="morning-minutes"
          type="number"
          min={0}
          max={120}
          value={morning}
          onChange={(e) => setMorning(Number(e.target.value))}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="afternoon-minutes">
          Afternoon auto-mark delay (minutes after 1:30 PM)
        </Label>
        <Input
          id="afternoon-minutes"
          type="number"
          min={0}
          max={120}
          value={afternoon}
          onChange={(e) => setAfternoon(Number(e.target.value))}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-600">Settings saved.</p>}

      <Button onClick={handleSave} disabled={isPending}>
        {isPending ? 'Saving...' : 'Save'}
      </Button>
    </div>
  )
}
