import { useState } from 'react'

import { toast } from 'sonner'

import { searchStudents } from '@/app/mahad/(registration)/register/_actions'

export interface SearchResult {
  id: string
  name: string
  lastName: string
}

export function useSiblingSearch(studentLastName?: string) {
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])

  const searchSiblings = async (query: string): Promise<SearchResult[]> => {
    if (!studentLastName) {
      toast.error('Complete your details first', {
        description:
          'Please fill in your personal information before searching for siblings',
      })
      return []
    }

    if (query.trim().length < 2) {
      setSearchResults([])
      return []
    }

    try {
      const results = await searchStudents(query, studentLastName)

      setSearchResults(results)
      return results
    } catch (error) {
      console.error('Error searching siblings:', error)
      toast.error('Unable to search for siblings', {
        description:
          'Please try again or contact support if the issue persists',
      })
      setSearchResults([])
      return []
    }
  }

  return {
    searchSiblings,
    searchResults,
    setSearchResults,
  }
}
