'use client'

import { useState, useMemo } from 'react'

import {
  Users,
  AlertCircle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Search,
  Filter,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { AdvancedFilters } from './advanced-filters'
import { DugsiRegistrationsTable } from './dugsi-registrations-table'
import { DugsiStats } from './dugsi-stats'
import { FamilyGridView } from './family-grid-view'
import { QuickActionsBar } from './quick-actions-bar'

interface DugsiRegistration {
  id: string
  name: string
  gender: 'MALE' | 'FEMALE' | null
  dateOfBirth: Date | string | null
  educationLevel: string | null
  gradeLevel: string | null
  schoolName: string | null
  healthInfo: string | null
  createdAt: Date | string
  parentFirstName: string | null
  parentLastName: string | null
  parentEmail: string | null
  parentPhone: string | null
  parent2FirstName: string | null
  parent2LastName: string | null
  parent2Email: string | null
  parent2Phone: string | null
  paymentMethodCaptured: boolean
  paymentMethodCapturedAt: Date | string | null
  stripeCustomerIdDugsi: string | null
  stripeSubscriptionIdDugsi: string | null
  subscriptionStatus: string | null
  paidUntil: Date | string | null
  familyReferenceId: string | null
  stripeAccountType: string | null
}

interface DugsiDashboardProps {
  registrations: DugsiRegistration[]
}

type TabValue = 'overview' | 'active' | 'pending' | 'needs-attention' | 'all'
type ViewMode = 'grid' | 'table'

export function DugsiDashboard({ registrations }: DugsiDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabValue>('overview')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedFamilies, setSelectedFamilies] = useState<Set<string>>(
    new Set()
  )
  const [filters, setFilters] = useState({
    dateRange: null as { start: Date; end: Date } | null,
    schools: [] as string[],
    grades: [] as string[],
    hasHealthInfo: false,
  })

  // Group registrations by family
  const familyGroups = useMemo(() => {
    const groups = new Map<string, DugsiRegistration[]>()

    registrations.forEach((reg) => {
      // Use family reference ID or parent email as the grouping key
      const familyKey = reg.familyReferenceId || reg.parentEmail || reg.id

      if (!groups.has(familyKey)) {
        groups.set(familyKey, [])
      }
      groups.get(familyKey)!.push(reg)
    })

    return Array.from(groups.entries()).map(([key, members]) => ({
      familyKey: key,
      members: members.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ),
      hasPayment: members.some((m) => m.paymentMethodCaptured),
      hasSubscription: members.some(
        (m) => m.stripeSubscriptionIdDugsi && m.subscriptionStatus === 'active'
      ),
      parentEmail: members[0]?.parentEmail,
      parentPhone: members[0]?.parentPhone,
    }))
  }, [registrations])

  // Filter families based on tab
  const filteredFamilies = useMemo(() => {
    let filtered = familyGroups

    // Apply tab filter
    switch (activeTab) {
      case 'active':
        filtered = filtered.filter((f) => f.hasSubscription)
        break
      case 'pending':
        filtered = filtered.filter((f) => f.hasPayment && !f.hasSubscription)
        break
      case 'needs-attention':
        filtered = filtered.filter((f) => !f.hasPayment)
        break
      case 'all':
        // Show all families
        break
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((family) => {
        return family.members.some(
          (member) =>
            member.name?.toLowerCase().includes(query) ||
            member.parentEmail?.toLowerCase().includes(query) ||
            member.parentPhone?.includes(searchQuery) ||
            member.schoolName?.toLowerCase().includes(query)
        )
      })
    }

    // Apply advanced filters
    if (filters.dateRange) {
      filtered = filtered.filter((family) => {
        return family.members.some((member) => {
          const date = new Date(member.createdAt)
          return (
            date >= filters.dateRange!.start && date <= filters.dateRange!.end
          )
        })
      })
    }

    if (filters.schools.length > 0) {
      filtered = filtered.filter((family) => {
        return family.members.some((member) =>
          filters.schools.includes(member.schoolName || '')
        )
      })
    }

    if (filters.grades.length > 0) {
      filtered = filtered.filter((family) => {
        return family.members.some((member) =>
          filters.grades.includes(member.gradeLevel || '')
        )
      })
    }

    if (filters.hasHealthInfo) {
      filtered = filtered.filter((family) => {
        return family.members.some(
          (member) =>
            member.healthInfo && member.healthInfo.toLowerCase() !== 'none'
        )
      })
    }

    return filtered
  }, [familyGroups, activeTab, searchQuery, filters])

  // Calculate stats for tabs
  const tabStats = useMemo(
    () => ({
      all: familyGroups.length,
      active: familyGroups.filter((f) => f.hasSubscription).length,
      pending: familyGroups.filter((f) => f.hasPayment && !f.hasSubscription)
        .length,
      needsAttention: familyGroups.filter((f) => !f.hasPayment).length,
    }),
    [familyGroups]
  )

  const handleBulkAction = (action: string) => {
    console.log(`Performing ${action} on ${selectedFamilies.size} families`)
    // Implement bulk actions here
  }

  return (
    <div className="container mx-auto space-y-6 p-4 sm:space-y-8 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Dugsi Program Management
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Manage student registrations and family subscriptions
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            Grid View
          </Button>
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('table')}
          >
            Table View
          </Button>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by name, email, phone, or school..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          Advanced Filters
          {(filters.dateRange ||
            filters.schools.length > 0 ||
            filters.grades.length > 0 ||
            filters.hasHealthInfo) && (
            <Badge variant="secondary" className="ml-1">
              Active
            </Badge>
          )}
        </Button>
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <AdvancedFilters
          filters={filters}
          onFiltersChange={setFilters}
          registrations={registrations}
        />
      )}

      {/* Quick Actions Bar */}
      {selectedFamilies.size > 0 && (
        <QuickActionsBar
          selectedCount={selectedFamilies.size}
          onAction={handleBulkAction}
          onClearSelection={() => setSelectedFamilies(new Set())}
        />
      )}

      {/* Main Content Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabValue)}
      >
        <TabsList className="flex h-auto flex-wrap justify-start sm:grid sm:grid-cols-5">
          <TabsTrigger
            value="overview"
            className="flex-1 gap-1 px-2 py-2 text-xs sm:gap-2 sm:px-3 sm:text-sm"
          >
            <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Overview</span>
            <span className="sm:hidden">Stats</span>
          </TabsTrigger>
          <TabsTrigger
            value="active"
            className="flex-1 gap-1 px-2 py-2 text-xs sm:gap-2 sm:px-3 sm:text-sm"
          >
            <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Active</span>
            <Badge
              variant="secondary"
              className="ml-1 px-1 text-[10px] sm:px-1.5 sm:text-xs"
            >
              {tabStats.active}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="pending"
            className="flex-1 gap-1 px-2 py-2 text-xs sm:gap-2 sm:px-3 sm:text-sm"
          >
            <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Pending</span>
            <Badge
              variant="secondary"
              className="ml-1 px-1 text-[10px] sm:px-1.5 sm:text-xs"
            >
              {tabStats.pending}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="needs-attention"
            className="flex-1 gap-1 px-2 py-2 text-xs sm:gap-2 sm:px-3 sm:text-sm"
          >
            <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Needs Action</span>
            <span className="sm:hidden">Action</span>
            <Badge
              variant="secondary"
              className="ml-1 px-1 text-[10px] sm:px-1.5 sm:text-xs"
            >
              {tabStats.needsAttention}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="all"
            className="flex-1 gap-1 px-2 py-2 text-xs sm:gap-2 sm:px-3 sm:text-sm"
          >
            <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">All</span>
            <Badge
              variant="secondary"
              className="ml-1 px-1 text-[10px] sm:px-1.5 sm:text-xs"
            >
              {tabStats.all}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <DugsiStats registrations={registrations} />

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Registrations</CardTitle>
            </CardHeader>
            <CardContent>
              <FamilyGridView
                families={familyGroups.slice(0, 6)}
                selectedFamilies={selectedFamilies}
                onSelectionChange={setSelectedFamilies}
                viewMode="compact"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="active" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Active Subscriptions ({filteredFamilies.length} families)
            </h2>
          </div>
          {viewMode === 'grid' ? (
            <FamilyGridView
              families={filteredFamilies}
              selectedFamilies={selectedFamilies}
              onSelectionChange={setSelectedFamilies}
            />
          ) : (
            <DugsiRegistrationsTable
              registrations={filteredFamilies.flatMap((f) => f.members)}
            />
          )}
        </TabsContent>

        <TabsContent value="pending" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Pending Setup ({filteredFamilies.length} families)
            </h2>
            <Button
              size="sm"
              onClick={() => handleBulkAction('send-reminders')}
            >
              Send Setup Reminders
            </Button>
          </div>
          {viewMode === 'grid' ? (
            <FamilyGridView
              families={filteredFamilies}
              selectedFamilies={selectedFamilies}
              onSelectionChange={setSelectedFamilies}
            />
          ) : (
            <DugsiRegistrationsTable
              registrations={filteredFamilies.flatMap((f) => f.members)}
            />
          )}
        </TabsContent>

        <TabsContent value="needs-attention" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Needs Attention ({filteredFamilies.length} families)
            </h2>
            <Button
              size="sm"
              onClick={() => handleBulkAction('send-payment-links')}
            >
              Send Payment Links
            </Button>
          </div>
          {viewMode === 'grid' ? (
            <FamilyGridView
              families={filteredFamilies}
              selectedFamilies={selectedFamilies}
              onSelectionChange={setSelectedFamilies}
            />
          ) : (
            <DugsiRegistrationsTable
              registrations={filteredFamilies.flatMap((f) => f.members)}
            />
          )}
        </TabsContent>

        <TabsContent value="all" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              All Families ({filteredFamilies.length} families)
            </h2>
          </div>
          {viewMode === 'grid' ? (
            <FamilyGridView
              families={filteredFamilies}
              selectedFamilies={selectedFamilies}
              onSelectionChange={setSelectedFamilies}
            />
          ) : (
            <DugsiRegistrationsTable
              registrations={filteredFamilies.flatMap((f) => f.members)}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
