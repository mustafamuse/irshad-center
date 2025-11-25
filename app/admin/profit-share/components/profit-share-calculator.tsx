'use client'

import { useState, useEffect, type Dispatch, type SetStateAction } from 'react'

import type { Batch } from '@prisma/client'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  InfoIcon,
  CheckCircle2,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { createClientLogger } from '@/lib/logger-client'

const logger = createClientLogger('ProfitShareCalculator')

// Constants
const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: new Date(0, i).toLocaleString('default', { month: 'long' }),
}))

const YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)

// Types
interface ExcludedCharge {
  studentName: string
  studentEmail: string
  customerEmail: string
  chargeAmount: number
  chargeId: string
  invoiceId: string | null
  payoutId: string
  customerId?: string
}

interface StudentInfo {
  studentName: string
  studentEmail: string
  customerEmail: string
  chargesFound: number
  batchId: string
  customerId?: string
}

interface CalculationResult {
  totalPayoutAmount: number
  totalDeductions: number
  finalAdjustedPayout: number
  payoutsFound: number
  excludedCharges: ExcludedCharge[]
  exclusionSummary: StudentInfo[]
}

interface ProfitShareCalculatorProps {
  batches: Batch[]
}

interface DateState {
  month: number
  year: number
}

interface MonthYearSelectorProps {
  date: DateState
  setDate: Dispatch<SetStateAction<DateState>>
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
}

// Helper functions
function filterAndSortBatches(batches: Batch[]): Batch[] {
  return batches
    .filter((batch) => !batch.name.toLowerCase().includes('test'))
    .sort((a, b) => a.name.localeCompare(b.name))
}

function formatCurrency(amount: number): string {
  return (amount / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function getCurrentMonthYear() {
  return {
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  }
}

// Components
function MonthYearSelector({
  date,
  setDate,
  isOpen,
  setIsOpen,
}: MonthYearSelectorProps) {
  const handlePreviousMonth = () => {
    setDate((prev) => ({
      month: prev.month === 1 ? 12 : prev.month - 1,
      year: prev.month === 1 ? prev.year - 1 : prev.year,
    }))
  }

  const handleNextMonth = () => {
    setDate((prev) => ({
      month: prev.month === 12 ? 1 : prev.month + 1,
      year: prev.month === 12 ? prev.year + 1 : prev.year,
    }))
  }

  const isNextMonthDisabled =
    date.year === new Date().getFullYear() &&
    date.month >= new Date().getMonth() + 1

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          className="w-full justify-between py-6 text-lg"
        >
          <span>
            {MONTHS[date.month - 1]?.label} {date.year}
          </span>
          <ChevronDown className="ml-2 h-5 w-5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <div className="grid">
          <div className="sticky top-0 flex items-center justify-between border-b bg-background p-4">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              onClick={handlePreviousMonth}
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <span className="text-base font-medium">
              {MONTHS[date.month - 1]?.label} {date.year}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              onClick={handleNextMonth}
              disabled={isNextMonthDisabled}
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          </div>
          <ScrollArea className="h-[min(70vh,400px)]">
            <div className="grid grid-cols-1 p-4">
              {YEARS.map((year) => (
                <div key={year} className="mb-6">
                  <div className="sticky top-0 mb-2 bg-background px-2 py-1 text-base font-medium">
                    {year}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {MONTHS.map((month) => (
                      <Button
                        key={`${year}-${month.value}`}
                        variant={
                          date.month === month.value && date.year === year
                            ? 'default'
                            : 'ghost'
                        }
                        className="w-full justify-start py-6 text-base"
                        disabled={
                          year === new Date().getFullYear() &&
                          month.value > new Date().getMonth() + 1
                        }
                        onClick={() => {
                          setDate({ month: month.value, year })
                          setIsOpen(false)
                        }}
                      >
                        {month.label}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function StatCard({
  title,
  amount,
  subtitle,
  color = 'blue',
}: {
  title: string
  amount: number
  subtitle: string
  color?: 'blue' | 'red' | 'green'
}) {
  const colorMap = {
    blue: {
      background: 'bg-blue-500/10 dark:bg-blue-500/20',
      text: 'text-blue-700 dark:text-blue-300',
      border: 'border-blue-500/20 dark:border-blue-500/30',
      accent: 'bg-blue-500 dark:bg-blue-400',
    },
    red: {
      background: 'bg-red-500/10 dark:bg-red-500/20',
      text: 'text-red-700 dark:text-red-300',
      border: 'border-red-500/20 dark:border-red-500/30',
      accent: 'bg-red-500 dark:bg-red-400',
    },
    green: {
      background: 'bg-emerald-500/10 dark:bg-emerald-500/20',
      text: 'text-emerald-700 dark:text-emerald-300',
      border: 'border-emerald-500/20 dark:border-emerald-500/30',
      accent: 'bg-emerald-500 dark:bg-emerald-400',
    },
  }

  const colors = colorMap[color]

  return (
    <Card
      className={`relative overflow-hidden border ${colors.border} ${colors.background}`}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold sm:text-3xl ${colors.text}`}>
          {formatCurrency(amount)}
        </div>
        <div className="text-sm text-muted-foreground">{subtitle}</div>
        <div
          className={`absolute right-0 top-0 h-full w-[4px] ${colors.accent}`}
        />
      </CardContent>
    </Card>
  )
}

// Main component
export function ProfitShareCalculator({ batches }: ProfitShareCalculatorProps) {
  const [date, setDate] = useState(getCurrentMonthYear())
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<CalculationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<string>('')
  const [isMonthSelectorOpen, setIsMonthSelectorOpen] = useState(false)

  const filteredBatches = filterAndSortBatches(batches)

  const handleBatchToggle = (batchId: string) => {
    setSelectedBatchIds((prev) =>
      prev.includes(batchId)
        ? prev.filter((id) => id !== batchId)
        : [...prev, batchId]
    )
  }

  const handleCalculate = async () => {
    setIsLoading(true)
    setResult(null)
    setError(null)

    try {
      const response = await fetch('/api/admin/profit-share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: date.year,
          month: date.month,
          batchIds: selectedBatchIds,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong')
      }

      setResult(data)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred'
      logger.error('Calculation failed', errorMessage)
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  // Group charges by batch
  const chargesByBatch = batches
    .filter((batch) => selectedBatchIds.includes(batch.id))
    .reduce(
      (acc, batch) => {
        const batchStudents =
          result?.exclusionSummary?.filter(
            (student) => student.batchId === batch.id
          ) || []

        acc[batch.name] = batchStudents.map((student) => {
          const studentCharges =
            result?.excludedCharges.filter(
              (charge) => charge.studentEmail === student.studentEmail
            ) || []

          return studentCharges.length > 0
            ? studentCharges[0]
            : {
                studentName: student.studentName,
                studentEmail: student.studentEmail,
                customerEmail: student.customerEmail,
                chargeAmount: 0,
                chargeId: '',
                invoiceId: null,
                payoutId: '',
                customerId: student.customerId,
              }
        })

        return acc
      },
      {} as Record<string, ExcludedCharge[]>
    )

  // Set initial active tab
  useEffect(() => {
    if (result && Object.keys(chargesByBatch).length > 0) {
      setActiveTab(Object.keys(chargesByBatch)[0])
    }
  }, [result, chargesByBatch])

  return (
    <div className="space-y-6">
      {/* Selection Controls */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Month Selection Card */}
        <Card className="md:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-sm font-medium">
              Select Month
              <Badge variant="secondary" className="font-normal">
                {selectedBatchIds.length} batches selected
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MonthYearSelector
              date={date}
              setDate={setDate}
              isOpen={isMonthSelectorOpen}
              setIsOpen={setIsMonthSelectorOpen}
            />
          </CardContent>
        </Card>

        {/* Batch Selection Card */}
        <Card className="md:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">
                Select Batches
              </CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <InfoIcon className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Select the batches to include in the profit share
                    calculation
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[min(50vh,300px)] pr-4">
              <div className="space-y-4">
                {filteredBatches.map((batch) => (
                  <div
                    key={batch.id}
                    className="flex items-center space-x-3 rounded-lg border p-4 transition-colors hover:bg-muted/50"
                  >
                    <Checkbox
                      id={batch.id}
                      checked={selectedBatchIds.includes(batch.id)}
                      onCheckedChange={() => handleBatchToggle(batch.id)}
                      className="h-5 w-5"
                    />
                    <Label
                      htmlFor={batch.id}
                      className="flex flex-1 cursor-pointer items-center justify-between text-base"
                    >
                      {batch.name}
                      {selectedBatchIds.includes(batch.id) && (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      )}
                    </Label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={handleCalculate}
          disabled={isLoading || selectedBatchIds.length === 0}
          className="w-full py-6 text-lg md:w-auto"
          size="lg"
        >
          {isLoading ? (
            <>
              <div className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Calculating...
            </>
          ) : (
            'Calculate Profit Share'
          )}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-base text-red-600">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard
              title="Total Gross Payouts"
              amount={result.totalPayoutAmount}
              subtitle={`Based on ${result.payoutsFound} payouts`}
              color="blue"
            />
            <StatCard
              title="Total Deductions"
              amount={-result.totalDeductions}
              subtitle="From selected batches"
              color="red"
            />
            <StatCard
              title="Final Adjusted Payout"
              amount={result.finalAdjustedPayout}
              subtitle="Net profit share amount"
              color="green"
            />
          </div>

          {/* Batch Details */}
          {Object.keys(chargesByBatch).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Batch Details</CardTitle>
              </CardHeader>
              <CardContent className="px-0 sm:px-6">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <ScrollArea className="w-full">
                    <TabsList className="inline-flex w-auto space-x-2 p-2 sm:w-full">
                      {Object.entries(chargesByBatch).map(
                        ([batchName, students]) => (
                          <TabsTrigger
                            key={batchName}
                            value={batchName}
                            className="min-w-[150px] flex-none sm:flex-1"
                          >
                            <span className="truncate">{batchName}</span>
                            <Badge variant="secondary" className="ml-2">
                              {students.length}
                            </Badge>
                          </TabsTrigger>
                        )
                      )}
                    </TabsList>
                  </ScrollArea>
                  {Object.entries(chargesByBatch).map(
                    ([batchName, students]) => (
                      <TabsContent key={batchName} value={batchName}>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="min-w-[200px]">
                                  Student
                                </TableHead>
                                <TableHead className="min-w-[200px]">
                                  Customer Email
                                </TableHead>
                                <TableHead className="min-w-[120px] text-right">
                                  Charge Amount
                                </TableHead>
                                <TableHead className="min-w-[200px]">
                                  Payment Details
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {students.map((student, studentIndex) => (
                                <TableRow
                                  key={`${student.studentEmail}-${studentIndex}`}
                                  className={
                                    student.chargeAmount === 0
                                      ? 'bg-muted/30'
                                      : undefined
                                  }
                                >
                                  <TableCell className="min-w-[200px]">
                                    <div>
                                      <div className="font-medium">
                                        {student.studentName}
                                      </div>
                                      <div className="text-sm text-muted-foreground">
                                        {student.studentEmail}
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="min-w-[200px]">
                                    <div>
                                      <div className="break-all">
                                        {student.customerEmail}
                                      </div>
                                      {student.customerId && (
                                        <a
                                          href={`https://dashboard.stripe.com/customers/${student.customerId}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
                                        >
                                          View Profile{' '}
                                          <ExternalLink className="h-4 w-4" />
                                        </a>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="min-w-[120px] text-right font-mono">
                                    {student.chargeAmount > 0 ? (
                                      <span className="font-semibold text-red-600">
                                        {formatCurrency(-student.chargeAmount)}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground">
                                        No charges
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell className="min-w-[200px]">
                                    {student.chargeAmount > 0 && (
                                      <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-2">
                                          <span className="font-mono text-sm">
                                            Payout
                                          </span>
                                          <a
                                            href={`https://dashboard.stripe.com/payouts/${student.payoutId}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
                                          >
                                            {student.payoutId.slice(-8)}{' '}
                                            <ExternalLink className="h-4 w-4" />
                                          </a>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className="font-mono text-sm">
                                            Charge
                                          </span>
                                          <a
                                            href={`https://dashboard.stripe.com/payments/${student.chargeId}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
                                          >
                                            {student.chargeId.slice(-8)}{' '}
                                            <ExternalLink className="h-4 w-4" />
                                          </a>
                                        </div>
                                        {student.invoiceId && (
                                          <div className="flex items-center gap-2">
                                            <span className="font-mono text-sm">
                                              Invoice
                                            </span>
                                            <a
                                              href={`https://dashboard.stripe.com/invoices/${student.invoiceId}`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
                                            >
                                              {student.invoiceId.slice(-8)}{' '}
                                              <ExternalLink className="h-4 w-4" />
                                            </a>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </TabsContent>
                    )
                  )}
                </Tabs>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
