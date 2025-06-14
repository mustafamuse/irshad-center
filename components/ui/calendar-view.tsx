'use client'

import * as React from 'react'
import { addDays, format, startOfWeek } from 'date-fns'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

interface CalendarViewProps {
  schedules: Array<{
    id: string
    subject: string
    teacher: string
    startTime: string
    endTime: string
    dayOfWeek: number
  }>
  currentDate?: Date
}

export function CalendarView({
  schedules,
  currentDate = new Date(),
}: CalendarViewProps) {
  const weekStart = startOfWeek(currentDate)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const [isSmallScreen, setIsSmallScreen] = React.useState(false)

  React.useEffect(() => {
    const checkScreenSize = () => {
      setIsSmallScreen(window.innerWidth < 768)
    }

    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)

    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  const visibleDays = isSmallScreen ? weekDays.slice(0, 3) : weekDays

  return (
    <Card className="p-2 sm:p-4">
      <div
        className={cn(
          'grid gap-2 sm:gap-4',
          isSmallScreen ? 'grid-cols-4' : 'grid-cols-8'
        )}
      >
        <div className="col-span-1 hidden sm:block" /> {/* Time column */}
        {visibleDays.map((day) => (
          <div key={day.toString()} className="text-center">
            <div className="text-xs font-medium sm:text-sm">
              {format(day, 'EEE')}
            </div>
            <div className="hidden text-xs text-muted-foreground sm:block">
              {format(day, 'MMM d')}
            </div>
          </div>
        ))}
        <ScrollArea
          className={cn(
            'col-span-full h-[500px] sm:h-[600px]',
            isSmallScreen ? 'mt-2' : ''
          )}
        >
          <div
            className={cn(
              'grid gap-2 sm:gap-4',
              isSmallScreen ? 'grid-cols-4' : 'grid-cols-8'
            )}
          >
            {Array.from({ length: 24 }, (_, hour) => (
              <React.Fragment key={hour}>
                <div className="pr-1 text-right text-xs text-muted-foreground sm:pr-2 sm:text-sm">
                  {format(
                    new Date().setHours(hour, 0),
                    isSmallScreen ? 'ha' : 'h:mm a'
                  )}
                </div>
                {visibleDays.map((day) => (
                  <div
                    key={`${day}-${hour}`}
                    className="relative min-h-[50px] border-l border-t sm:min-h-[60px]"
                  >
                    {schedules
                      .filter((schedule) => {
                        const scheduleHour = parseInt(
                          schedule.startTime.split(':')[0]
                        )
                        return (
                          scheduleHour === hour &&
                          schedule.dayOfWeek === day.getDay()
                        )
                      })
                      .map((schedule) => (
                        <div
                          key={schedule.id}
                          className="absolute inset-x-0 m-0.5 rounded-md bg-primary/10 p-1 sm:m-1 sm:p-2"
                          style={{
                            top: '0%',
                            height: 'calc(100% - 2px)',
                          }}
                        >
                          <div className="truncate text-[10px] font-medium sm:text-xs">
                            {schedule.subject}
                          </div>
                          <div className="hidden truncate text-[10px] text-muted-foreground sm:block sm:text-xs">
                            {schedule.teacher}
                          </div>
                          <div className="truncate text-[10px] sm:text-xs">
                            {schedule.startTime} - {schedule.endTime}
                          </div>
                        </div>
                      ))}
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>
        </ScrollArea>
      </div>
    </Card>
  )
}
