'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AttendanceSession } from '@/lib/types/attendance'
import { AttendanceDialog } from './attendance-dialog'
import { Calendar, Clock, Users, CheckCircle2, AlertCircle } from 'lucide-react'

export function AttendanceManagement() {
  const [sessions, setSessions] = useState<AttendanceSession[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSession, setSelectedSession] = useState<AttendanceSession | null>(null)

  useEffect(() => {
    fetchSessions()
  }, [])

  async function fetchSessions() {
    try {
      const response = await fetch('/api/admin/attendance?weekendsOnly=true')
      if (response.ok) {
        const data = await response.json()
        setSessions(data)
      }
    } catch (error) {
      console.error('Error fetching sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  function getStatusBadge(session: any) {
    if (session.isComplete) {
      return <Badge variant="default" className="bg-green-100 text-green-800">Complete</Badge>
    }
    if (session.attendanceMarked > 0) {
      return <Badge variant="secondary">Partial</Badge>
    }
    return <Badge variant="outline">Pending</Badge>
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-6 bg-muted rounded w-48"></div>
              <div className="h-4 bg-muted rounded w-32"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded w-full"></div>
                <div className="h-4 bg-muted rounded w-3/4"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Recent Weekend Sessions</h2>
        
        {sessions.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-8">
              <div className="text-center">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No weekend sessions found</h3>
                <p className="text-muted-foreground">
                  Create a new session to start taking attendance
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          sessions.map((session) => (
            <Card key={session.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    {session.schedule.subject.name} - {session.schedule.batch.name}
                  </CardTitle>
                  {getStatusBadge(session)}
                </div>
                <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-1" />
                    {format(new Date(session.date), 'PPP')}
                  </div>
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-1" />
                    {format(new Date(session.startTime), 'p')} - {format(new Date(session.endTime), 'p')}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center">
                      <Users className="h-4 w-4 mr-1 text-muted-foreground" />
                      <span className="text-sm">
                        {session.studentsCount} students
                      </span>
                    </div>
                    <div className="flex items-center">
                      {session.isComplete ? (
                        <CheckCircle2 className="h-4 w-4 mr-1 text-green-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 mr-1 text-orange-600" />
                      )}
                      <span className="text-sm">
                        {session.attendanceMarked}/{session.studentsCount} marked
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedSession(session)}
                  >
                    {session.isComplete ? 'View Attendance' : 'Mark Attendance'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {selectedSession && (
        <AttendanceDialog
          session={selectedSession}
          open={!!selectedSession}
          onOpenChange={(open) => !open && setSelectedSession(null)}
          onAttendanceMarked={fetchSessions}
        />
      )}
    </>
  )
}