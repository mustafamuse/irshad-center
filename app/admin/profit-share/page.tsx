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

export default async function ProfitSharePage() {
  const batches = await prisma.batch.findMany({
    orderBy: {
      createdAt: 'desc',
    },
  })

  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Profit Sharing</h2>
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
