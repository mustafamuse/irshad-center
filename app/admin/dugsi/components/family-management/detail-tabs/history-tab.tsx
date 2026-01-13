'use client'

import { Calendar, UserPlus, CreditCard, RefreshCw, Clock } from 'lucide-react'

import { Badge } from '@/components/ui/badge'

import { Family } from '../../../_types'

interface HistoryTabProps {
  family: Family
}

interface TimelineEvent {
  id: string
  type: 'registration' | 'subscription' | 'churned' | 'payment'
  title: string
  description: string
  date: Date | null
  icon: React.ReactNode
}

export function HistoryTab({ family }: HistoryTabProps) {
  const formatDate = (date: Date | null) => {
    if (!date) return 'Unknown'
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(date))
  }

  const formatRelativeDate = (date: Date | null) => {
    if (!date) return ''
    const now = new Date()
    const then = new Date(date)
    const diffMs = now.getTime() - then.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
    return `${Math.floor(diffDays / 365)} years ago`
  }

  const buildTimeline = (): TimelineEvent[] => {
    const events: TimelineEvent[] = []

    family.members.forEach((member, index) => {
      events.push({
        id: `reg-${member.id}`,
        type: 'registration',
        title: `${member.name} registered`,
        description: index === 0 ? 'Family created' : 'Added to family',
        date: member.createdAt,
        icon: <UserPlus className="h-4 w-4" />,
      })

      if (member.subscriptionStatus === 'active' && member.currentPeriodStart) {
        events.push({
          id: `sub-${member.id}`,
          type: 'subscription',
          title: 'Subscription started',
          description: member.subscriptionAmount
            ? `$${(member.subscriptionAmount / 100).toFixed(0)}/month`
            : 'Monthly subscription',
          date: member.currentPeriodStart,
          icon: <CreditCard className="h-4 w-4" />,
        })
      }

      if (member.subscriptionStatus === 'canceled') {
        events.push({
          id: `churn-${member.id}`,
          type: 'churned',
          title: 'Subscription canceled',
          description: 'Family churned',
          date: member.createdAt,
          icon: <RefreshCw className="h-4 w-4" />,
        })
      }
    })

    return events.sort((a, b) => {
      if (!a.date && !b.date) return 0
      if (!a.date) return 1
      if (!b.date) return -1
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    })
  }

  const timeline = buildTimeline()

  const getEventColor = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'registration':
        return 'bg-blue-500'
      case 'subscription':
        return 'bg-green-500'
      case 'churned':
        return 'bg-gray-500'
      case 'payment':
        return 'bg-emerald-500'
      default:
        return 'bg-gray-400'
    }
  }

  const getEventBadge = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'registration':
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700">
            Registration
          </Badge>
        )
      case 'subscription':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700">
            Subscription
          </Badge>
        )
      case 'churned':
        return (
          <Badge variant="outline" className="bg-gray-100 text-gray-700">
            Churned
          </Badge>
        )
      case 'payment':
        return (
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700">
            Payment
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="space-y-4 rounded-lg border bg-card p-5">
        <h3 className="text-base font-semibold">Summary</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Family Since</p>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {family.members[0]?.createdAt
                  ? formatDate(family.members[0].createdAt)
                  : 'Unknown'}
              </span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Children</p>
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {family.members.length}{' '}
                {family.members.length === 1 ? 'child' : 'children'}
              </span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Subscription Status</p>
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {family.hasSubscription
                  ? 'Active'
                  : family.hasChurned
                    ? 'Churned'
                    : 'None'}
              </span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Last Activity</p>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {formatRelativeDate(family.members[0]?.createdAt || null)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="space-y-4 rounded-lg border bg-card p-5">
        <h3 className="text-base font-semibold">Activity Timeline</h3>

        {timeline.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Clock className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">No Activity</p>
              <p className="text-sm text-muted-foreground">
                Activity will appear here
              </p>
            </div>
          </div>
        ) : (
          <div className="relative space-y-0">
            {timeline.map((event, index) => (
              <div
                key={event.id}
                className="relative flex gap-4 pb-6 last:pb-0"
              >
                {index !== timeline.length - 1 && (
                  <div className="absolute left-[11px] top-6 h-full w-0.5 bg-border" />
                )}
                <div
                  className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white ${getEventColor(event.type)}`}
                >
                  {event.icon}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{event.title}</p>
                    {getEventBadge(event.type)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {event.description}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(event.date)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
