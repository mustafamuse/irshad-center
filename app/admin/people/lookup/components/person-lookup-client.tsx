'use client'

import { useState } from 'react'

import { useRouter } from 'next/navigation'

import { Search, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import {
  deletePersonAction,
  lookupPersonAction,
  PersonLookupResult,
} from '../actions'
import { BillingCard } from './billing-card'
import { DeletePersonDialog } from './delete-person-dialog'
import { ParentRoleCard, StudentRoleCard, TeacherRoleCard } from './role-cards'

export function PersonLookupClient() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PersonLookupResult | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleSearch = async () => {
    if (!query.trim()) return

    setLoading(true)
    setError(null)
    setResult(null)

    const response = await lookupPersonAction(query)

    if (response.success) {
      setResult(response.data ?? null)
      if (!response.data) {
        setError('No person found matching your search')
      }
    } else {
      setError(response.error ?? 'Search failed')
    }

    setLoading(false)
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const handleDelete = async () => {
    if (!result) return

    setDeleting(true)
    const response = await deletePersonAction(result.id)

    if (response.success) {
      setResult(null)
      setQuery('')
      setShowDeleteDialog(false)
      router.refresh()
    } else {
      setError(response.error ?? 'Delete failed')
    }

    setDeleting(false)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="search" className="sr-only">
                Search
              </Label>
              <Input
                id="search"
                placeholder="Enter email, phone number, or full name..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={loading}
              />
            </div>
            <Button onClick={handleSearch} disabled={loading || !query.trim()}>
              <Search className="mr-2 h-4 w-4" />
              {loading ? 'Searching...' : 'Search'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-sm text-red-800">{error}</p>
          </CardContent>
        </Card>
      )}

      {result && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Basic Information</CardTitle>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Person
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Name</Label>
                <p className="text-lg font-semibold">{result.name}</p>
              </div>

              <div>
                <Label className="text-muted-foreground">Contact Points</Label>
                <div className="mt-2 space-y-2">
                  {result.contactPoints.map((cp) => (
                    <div
                      key={cp.id}
                      className="flex items-center justify-between rounded-md border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{cp.type}</Badge>
                        <span className="font-mono">{cp.value}</span>
                      </div>
                      {cp.isPrimary && (
                        <Badge variant="secondary">Primary</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">Created</Label>
                  <p>{new Date(result.createdAt).toLocaleDateString()}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Last Updated</Label>
                  <p>{new Date(result.updatedAt).toLocaleDateString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {result.roles.teacher && (
            <TeacherRoleCard teacher={result.roles.teacher} />
          )}

          {result.roles.student && (
            <StudentRoleCard student={result.roles.student} />
          )}

          {result.roles.parent && (
            <ParentRoleCard parent={result.roles.parent} />
          )}

          <BillingCard billingAccounts={result.billingAccounts} />

          {!result.roles.teacher &&
            !result.roles.student &&
            !result.roles.parent && (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="pt-6">
                  <p className="text-sm text-amber-800">
                    This person has no active roles (Teacher, Student, or
                    Parent)
                  </p>
                </CardContent>
              </Card>
            )}
        </div>
      )}

      <DeletePersonDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        personName={result?.name ?? ''}
        onConfirm={handleDelete}
        deleting={deleting}
      />
    </div>
  )
}
