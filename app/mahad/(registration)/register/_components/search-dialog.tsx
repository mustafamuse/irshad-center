'use client'

import { useState } from 'react'

import { AlertTriangle, Check } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { type SearchResult } from '@/lib/registration/schemas/registration'
import { debounce } from '@/lib/registration/utils/form-utils'
import { cn } from '@/lib/utils'

interface SiblingSearchDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onAddSibling: (sibling: SearchResult) => void
  onSearch: (query: string) => Promise<SearchResult[]>
  studentLastName?: string
  existingSiblingIds: string[]
}

export function SiblingSearchDialog({
  isOpen,
  onOpenChange,
  onAddSibling,
  onSearch,
  studentLastName,
  existingSiblingIds,
}: SiblingSearchDialogProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [selectedStudent, setSelectedStudent] = useState<SearchResult | null>(
    null
  )
  const [isSearching, setIsSearching] = useState(false)

  // Debounced search function
  const debouncedSearch = debounce(async (query: string) => {
    if (query.length >= 2) {
      setIsSearching(true)
      try {
        const results = await onSearch(query)
        // Filter out already added siblings
        const filteredResults = results.filter(
          (result) => !existingSiblingIds.includes(result.id)
        )
        setSearchResults(filteredResults)
      } catch (error) {
        console.error('Search error:', error)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    } else {
      setSearchResults([])
    }
  }, 300)

  const handleSearchChange = (value: string) => {
    setSearchTerm(value)
    debouncedSearch(value)
  }

  const handleAddSelected = () => {
    if (selectedStudent) {
      onAddSibling(selectedStudent)
      handleClose()
    }
  }

  const handleClose = () => {
    setSearchTerm('')
    setSearchResults([])
    setSelectedStudent(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="mx-4 max-w-[425px] rounded-2xl border-0 p-6 shadow-sm md:p-8">
        <DialogHeader className="space-y-3">
          <DialogTitle className="text-xl font-semibold text-[#007078]">
            Add a Sibling
          </DialogTitle>
          <DialogDescription className="text-gray-600">
            Search for siblings with last name &quot;{studentLastName}&quot;
          </DialogDescription>
          <div className="mt-2 rounded-xl border-l-4 border-[#deb43e] bg-[#deb43e]/5 p-4">
            <div className="flex items-center justify-center gap-2 text-[#deb43e]">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-semibold">Important</span>
            </div>
            <div className="mt-2 text-center text-sm text-[#deb43e]">
              <span>Please note:</span>
              <ul className="mt-1 list-none space-y-1">
                <li>• Only siblings with the same last name will appear</li>
                <li>• Your sibling must be registered at Irshād Māhad</li>
              </ul>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-6 space-y-4">
          <Input
            placeholder="Search by name..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="h-12 rounded-lg border-gray-200 text-base placeholder:text-gray-400"
          />

          <div className="max-h-[200px] overflow-y-auto rounded-xl border border-gray-200">
            {isSearching ? (
              <div className="p-4 text-center">
                <p className="text-sm font-medium text-gray-600">
                  Searching...
                </p>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-sm font-medium text-gray-600">
                  {!studentLastName
                    ? 'Please complete personal details first'
                    : searchTerm.length < 2
                      ? 'Type at least 2 characters to search'
                      : 'No siblings found with the same last name'}
                </p>
                {searchTerm.length >= 2 && (
                  <p className="mt-1 text-xs text-gray-500">
                    Make sure your sibling is registered with the same last name
                  </p>
                )}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {searchResults.map((student) => (
                  <div
                    key={student.id}
                    className={cn(
                      'flex cursor-pointer items-center justify-between p-4 transition-colors',
                      selectedStudent?.id === student.id
                        ? 'bg-[#007078]/5'
                        : 'hover:bg-[#007078]/5'
                    )}
                    onClick={() => setSelectedStudent(student)}
                  >
                    <div>
                      <p className="font-medium text-[#007078]">
                        {student.name}
                      </p>
                    </div>
                    {selectedStudent?.id === student.id && (
                      <Check className="h-4 w-4 text-[#007078]" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              className="flex-1 rounded-full border-[#deb43e] text-[#deb43e] transition-colors hover:bg-[#deb43e]/10"
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 rounded-full bg-[#007078] text-white transition-colors hover:bg-[#007078]/90"
              onClick={handleAddSelected}
              disabled={!selectedStudent}
            >
              Add Sibling
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
