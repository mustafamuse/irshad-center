'use client'

import { useQuery } from '@tanstack/react-query'

import { getEligibleStudentsForAutopay } from '@/lib/actions/get-students'

export function useEligibleStudents() {
  return useQuery({
    queryKey: ['eligible-students-autopay'],
    queryFn: async () => {
      console.log('🎯 Fetching eligible students for autopay')
      const students = await getEligibleStudentsForAutopay()
      if (!students) throw new Error('Failed to load students')
      return students
    },
    staleTime: 30 * 1000, // Consider data fresh for 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
    // Add these to reduce unnecessary fetches
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  })
}
