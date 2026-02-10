import { Suspense } from 'react'

import type { Metadata } from 'next'

import { AppErrorBoundary } from '@/components/error-boundary'
import { getDugsiInsights } from '@/lib/services/dugsi/insights-service'

import { AtRiskFamiliesTable } from './components/at-risk-families-table'
import { EnrollmentDistribution } from './components/enrollment-distribution'
import { FinancialKPICards } from './components/financial-kpi-cards'
import { RegistrationTrend } from './components/registration-trend'
import { RevenueAnalytics } from './components/revenue-analytics'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Dugsi Insights',
  description: 'Dugsi program financial analytics and insights',
}

function Loading() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-lg bg-muted" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-64 rounded-lg bg-muted" />
        <div className="h-64 rounded-lg bg-muted" />
      </div>
      <div className="h-48 rounded-lg bg-muted" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-64 rounded-lg bg-muted" />
        <div className="h-64 rounded-lg bg-muted" />
      </div>
      <div className="h-64 rounded-lg bg-muted" />
    </div>
  )
}

async function InsightsContent() {
  const data = await getDugsiInsights()

  return (
    <div className="space-y-8">
      <FinancialKPICards data={data.financialKPIs} />
      <RevenueAnalytics data={data.revenue} />
      <AtRiskFamiliesTable data={data.atRisk} />
      <EnrollmentDistribution
        enrollment={data.enrollment}
        health={data.health}
      />
      <RegistrationTrend data={data.registrationTrend} />
    </div>
  )
}

export default function DugsiInsightsPage() {
  return (
    <main className="container mx-auto space-y-6 p-4 sm:space-y-8 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-balance text-2xl font-bold tracking-tight">
          Dugsi Financial Analytics
        </h1>
        <p className="text-sm text-muted-foreground">
          Revenue, collections, and program health overview
        </p>
      </div>

      <AppErrorBoundary
        context="Dugsi insights"
        variant="card"
        fallbackUrl="/admin/dugsi"
        fallbackLabel="Back to Dashboard"
      >
        <Suspense fallback={<Loading />}>
          <InsightsContent />
        </Suspense>
      </AppErrorBoundary>
    </main>
  )
}
