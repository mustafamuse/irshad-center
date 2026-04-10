'use client'

import { useEffect, useState, useTransition } from 'react'

import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { getAdminAttendanceConfig, updateAttendanceConfigAction } from '../attendance/actions'

export default function AttendanceSettingsPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [morning, setMorning] = useState(15)
  const [afternoon, setAfternoon] = useState(15)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getAdminAttendanceConfig().then((cfg) => {
      setMorning(cfg.morningAutoMarkMinutes)
      setAfternoon(cfg.afternoonAutoMarkMinutes)
    })
  }, [])

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
    <div className="max-w-sm space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Attendance Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure how many minutes after class start before absent teachers are auto-marked as Late.
        </p>
      </div>

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
    </div>
  )
}
