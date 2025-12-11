import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

import type { PersonLookupResult } from '../actions'

interface BillingCardProps {
  billingAccounts: PersonLookupResult['billingAccounts']
}

export function BillingCard({ billingAccounts }: BillingCardProps) {
  if (billingAccounts.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {billingAccounts.map((account) => (
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
                            sub.status === 'active' ? 'default' : 'secondary'
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
  )
}
