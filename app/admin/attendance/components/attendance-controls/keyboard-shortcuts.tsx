'use client'

import { Card } from '@/components/ui/card'

const shortcuts = [
  { key: 'P', description: 'Mark Present' },
  { key: 'A', description: 'Mark Absent' },
  { key: 'L', description: 'Mark Late' },
  { key: 'E', description: 'Mark Excused' },
  { key: '↑/↓', description: 'Navigate' },
  { key: '/', description: 'Search' },
]

export function KeyboardShortcuts() {
  return (
    <Card className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
      <div className="text-sm text-muted-foreground">
        <p className="mb-2 font-medium">Keyboard Shortcuts</p>
        <div className="xs:grid-cols-2 grid grid-cols-1 gap-2">
          {shortcuts.map(({ key, description }) => (
            <div key={key} className="flex items-center">
              <kbd className="min-w-[32px] rounded bg-muted px-2 py-1 text-center font-mono">
                {key}
              </kbd>
              <span className="ml-2">{description}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
