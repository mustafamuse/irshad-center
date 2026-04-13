'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'

import {
  type AttendanceHistoryResult,
  getTeacherAttendanceHistory,
} from '../actions'

interface UseTeacherHistoryParams {
  teacherId: string | null
  sessionToken: string | null
}

interface UseTeacherHistoryResult {
  history: AttendanceHistoryResult | null
  hasLoaded: boolean
  error: string | null
  isOpen: boolean
  excuseOpenId: string | null
  isPending: boolean
  setExcuseOpenId: (id: string | null) => void
  handleOpenChange: (open: boolean) => void
  handleExcuseSuccess: () => void
}

export function useTeacherHistory({
  teacherId,
  sessionToken,
}: UseTeacherHistoryParams): UseTeacherHistoryResult {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [history, setHistory] = useState<AttendanceHistoryResult | null>(null)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [excuseOpenId, setExcuseOpenId] = useState<string | null>(null)
  const currentTeacherRef = useRef(teacherId)

  useEffect(() => {
    currentTeacherRef.current = teacherId
    setHistory(null)
    setHasLoaded(false)
    setIsOpen(false)
    setError(null)
    setExcuseOpenId(null)
  }, [teacherId])

  const fetchHistory = useCallback((id: string, token: string) => {
    startTransition(async () => {
      try {
        const result = await getTeacherAttendanceHistory({
          teacherId: id,
          token,
        })
        if (currentTeacherRef.current !== id) return
        if (result?.serverError) throw new Error(result.serverError)
        if (result?.data) {
          setHistory(result.data)
          setError(null)
        }
      } catch (err) {
        if (currentTeacherRef.current !== id) return
        setError(err instanceof Error ? err.message : 'Failed to load history')
      }
      setHasLoaded(true)
    })
  }, [])

  const loadHistory = useCallback(() => {
    if (!teacherId || !sessionToken || (hasLoaded && !error)) return
    fetchHistory(teacherId, sessionToken)
  }, [teacherId, sessionToken, hasLoaded, error, fetchHistory])

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setIsOpen(open)
      if (open && (!hasLoaded || error)) loadHistory()
    },
    [hasLoaded, error, loadHistory]
  )

  const handleExcuseSuccess = useCallback(() => {
    setExcuseOpenId(null)
    if (teacherId && sessionToken) fetchHistory(teacherId, sessionToken)
  }, [teacherId, sessionToken, fetchHistory])

  return {
    history,
    hasLoaded,
    error,
    isOpen,
    excuseOpenId,
    isPending,
    setExcuseOpenId,
    handleOpenChange,
    handleExcuseSuccess,
  }
}
