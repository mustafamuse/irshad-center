'use client'

import {
  Send,
  Link,
  Download,
  Mail,
  Trash2,
  X,
  CheckSquare,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface QuickActionsBarProps {
  selectedCount: number
  onAction: (action: string) => void
  onClearSelection: () => void
}

export function QuickActionsBar({
  selectedCount,
  onAction,
  onClearSelection,
}: QuickActionsBarProps) {
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <CheckSquare className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium">
            {selectedCount} {selectedCount === 1 ? 'family' : 'families'}{' '}
            selected
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Primary Actions */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAction('send-payment-link')}
            className="gap-2"
          >
            <Send className="h-4 w-4" />
            Send Payment Link
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => onAction('link-subscription')}
            className="gap-2"
          >
            <Link className="h-4 w-4" />
            Link Subscription
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => onAction('send-email')}
            className="gap-2"
          >
            <Mail className="h-4 w-4" />
            Send Email
          </Button>

          {/* More Actions Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                More Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Bulk Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onAction('export')}>
                <Download className="mr-2 h-4 w-4" />
                Export to CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction('export-pdf')}>
                <Download className="mr-2 h-4 w-4" />
                Export to PDF
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onAction('send-reminder')}>
                <Mail className="mr-2 h-4 w-4" />
                Send Reminder
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction('send-invoice')}>
                <Mail className="mr-2 h-4 w-4" />
                Send Invoice
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onAction('delete')}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Selected
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Clear Selection */}
          <Button
            size="sm"
            variant="ghost"
            onClick={onClearSelection}
            className="gap-1"
          >
            <X className="h-4 w-4" />
            Clear
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
