import { Suspense } from 'react'

import { Metadata } from 'next'

import { AppErrorBoundary } from '@/components/error-boundary'
import { getDugsiInsights } from '@/lib/services/dugsi/insights-service'

import { EnrollmentDistribution } from './components/enrollment-distribution'
import { ProgramHealthCards } from './components/program-health-cards'
import { RegistrationTrend } from './components/registration-trend'
import { RevenueAnalytics } from './components/revenue-analytics'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Dugsi Insights',
  description: 'Dugsi program analytics and insights',
}

function Loading() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-lg bg-muted" />
        ))}
      </div>
      <div className="h-3 rounded-full bg-muted" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-64 rounded-lg bg-muted" />
        <div className="h-64 rounded-lg bg-muted" />
      </div>
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
      <ProgramHealthCards data={data.health} />
      <RevenueAnalytics data={data.revenue} />
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
        <h1 className="text-2xl font-bold tracking-tight">
          Dugsi Program Insights
        </h1>
        <p className="text-sm text-muted-foreground">
          Analytics and program health overview
        </p>
      </div>

      <AppErrorBoundary
        context="Dugsi insights"
        variant="card"
        fallbackUrl="/admin/dugsi/insights"
        fallbackLabel="Reload Insights"
      >
        <Suspense fallback={<Loading />}>
          <InsightsContent />
        </Suspense>
      </AppErrorBoundary>
    </main>
  )
}
