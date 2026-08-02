'use client'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { LookupByEmailForm } from './lookup-by-email-form'
import { LookupByNameForm } from './lookup-by-name-form'

export function LookupCard() {
  return (
    <Card className="overflow-hidden rounded-2xl border-0 bg-white p-6 shadow-sm ring-1 ring-gray-200 md:p-8">
      <CardHeader className="space-y-1 px-0 pb-6">
        <CardTitle className="text-xl font-semibold text-brand">
          Look up your registration
        </CardTitle>
        <CardDescription className="text-gray-600">
          Search by the email you registered with, or by your legal name and
          date of birth.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <Tabs defaultValue="email" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="email">By email</TabsTrigger>
            <TabsTrigger value="name">By name + date of birth</TabsTrigger>
          </TabsList>
          <TabsContent value="email" className="mt-6">
            <LookupByEmailForm />
          </TabsContent>
          <TabsContent value="name" className="mt-6">
            <LookupByNameForm />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
