import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { prisma } from '@/lib/db'
import { ProfitShareCalculator } from './components/profit-share-calculator'

// Force dynamic rendering to avoid static build issues
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Profit Share | Billing',
  description: 'Calculate profit sharing distributions',
}

export default async function ProfitSharePage() {
  const batches = await prisma.batch.findMany({
    orderBy: {
      createdAt: 'desc',
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Profit Sharing Calculator
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Calculate monthly payouts and profit distributions
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Monthly Payout Calculator</CardTitle>
          <CardDescription>
            Calculate the adjusted payout for profit sharing by selecting a
            month and excluding specific student batches.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfitShareCalculator batches={batches} />
        </CardContent>
      </Card>
    </div>
  )
}