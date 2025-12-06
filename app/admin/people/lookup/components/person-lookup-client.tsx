'use client'

import { useState } from 'react'

import { useRouter } from 'next/navigation'

import { AlertTriangle, Search, Trash2 } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
            <Card>
              <CardHeader>
                <CardTitle>Teacher Role</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">Programs</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {result.roles.teacher.programs.map((program) => (
                      <Badge key={program} variant="default">
                        {program.replace('_PROGRAM', '')}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Student Count</Label>
                  <p className="text-2xl font-bold">
                    {result.roles.teacher.studentCount}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {result.roles.student && (
            <Card>
              <CardHeader>
                <CardTitle>Student Role</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {result.roles.student.profiles.map((profile) => (
                    <div
                      key={profile.id}
                      className="rounded-md border bg-muted/50 p-4"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <Badge variant="default">
                          {profile.program.replace('_PROGRAM', '')}
                        </Badge>
                        <Badge
                          variant={
                            profile.status === 'ENROLLED'
                              ? 'default'
                              : 'secondary'
                          }
                        >
                          {profile.status}
                        </Badge>
                      </div>
                      <div className="space-y-1 text-sm">
                        {profile.levelGroup && (
                          <div>
                            <span className="text-muted-foreground">
                              Level:{' '}
                            </span>
                            {profile.levelGroup}
                          </div>
                        )}
                        {profile.shift && (
                          <div>
                            <span className="text-muted-foreground">
                              Shift:{' '}
                            </span>
                            {profile.shift}
                          </div>
                        )}
                        {profile.teacherName && (
                          <div>
                            <span className="text-muted-foreground">
                              Teacher:{' '}
                            </span>
                            {profile.teacherName}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {result.roles.parent && (
            <Card>
              <CardHeader>
                <CardTitle>Parent Role</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {result.roles.parent.children.map((child) => (
                    <div
                      key={child.id}
                      className="rounded-md border bg-muted/50 p-4"
                    >
                      <div className="mb-2 font-semibold">{child.name}</div>
                      <div className="flex flex-wrap gap-2">
                        {child.programs.map((prog, idx) => (
                          <Badge
                            key={idx}
                            variant={
                              prog.status === 'ENROLLED' ? 'default' : 'outline'
                            }
                          >
                            {prog.program.replace('_PROGRAM', '')} -{' '}
                            {prog.status}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {result.billingAccounts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Billing</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {result.billingAccounts.map((account) => (
                    <div key={account.id}>
                      {account.stripeCustomerId && (
                        <div className="mb-3 text-sm text-muted-foreground">
                          Stripe Customer: {account.stripeCustomerId}
                        </div>
                      )}
                      {account.subscriptions.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-muted-foreground">
                            Active Subscriptions
                          </Label>
                          {account.subscriptions.map((sub) => (
                            <div
                              key={sub.id}
                              className="flex items-center justify-between rounded-md border p-3"
                            >
                              <div className="flex items-center gap-3">
                                <Badge variant="outline">
                                  {sub.program.replace('_PROGRAM', '')}
                                </Badge>
                                <Badge
                                  variant={
                                    sub.status === 'active'
                                      ? 'default'
                                      : 'secondary'
                                  }
                                >
                                  {sub.status}
                                </Badge>
                              </div>
                              <div className="font-semibold">
                                ${(sub.amount / 100).toFixed(2)}/mo
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

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

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Delete Person Entirely?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  This will <strong>permanently delete</strong> {result?.name}{' '}
                  and all associated data:
                </p>
                <ul className="list-inside list-disc space-y-1 text-sm">
                  <li>All contact information</li>
                  <li>Teacher role and student assignments</li>
                  <li>Student enrollments and program profiles</li>
                  <li>Parent relationships with children</li>
                  <li>Billing accounts and subscriptions</li>
                </ul>
                <p className="font-semibold text-red-600">
                  This action cannot be undone.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Deleting...' : 'Delete Permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
