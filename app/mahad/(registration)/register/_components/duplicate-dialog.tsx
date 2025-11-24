'use client'

import * as React from 'react'

import { useRouter } from 'next/navigation'

import { AlertCircle, MessageCircle, Camera } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ExistingPersonData } from '@/lib/types/registration-errors'

interface DuplicateRegistrationDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  duplicateField?: 'email' | 'phone' | 'both'
  existingPerson?: ExistingPersonData
  onExit: () => void
}

export function DuplicateRegistrationDialog({
  isOpen,
  onOpenChange,
  duplicateField,
  existingPerson,
  onExit,
}: DuplicateRegistrationDialogProps) {
  const router = useRouter()

  const getFieldMessage = () => {
    switch (duplicateField) {
      case 'email':
        return 'email address'
      case 'phone':
        return 'phone number'
      case 'both':
        return 'email address and phone number'
      default:
        return 'contact information'
    }
  }

  const createWhatsAppMessage = () => {
    if (!existingPerson) return ''

    const message = `As-salāmu ʿalaykum Ustādh Mustafa, I've already registered for the Mahad program.
Name: ${existingPerson.name}
Email: ${existingPerson.email}
${existingPerson.phone ? `Phone: ${existingPerson.phone}` : ''}
Registration Date: ${existingPerson.registeredDate}
Status: ${existingPerson.enrollmentStatus}
Program: ${existingPerson.program}
`
    return encodeURIComponent(message)
  }

  const handleWhatsAppClick = () => {
    const message = createWhatsAppMessage()
    const whatsappUrl = `https://wa.me/16125177466?text=${message}`
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
    onExit()
    onOpenChange(false)
    router.push('/mahad')
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="mx-auto w-[calc(100vw-2rem)] max-w-lg rounded-2xl border border-gray-100 bg-white/95 p-5 shadow-2xl backdrop-blur sm:w-[calc(100vw-4rem)] sm:p-7">
        <DialogHeader className="space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 ring-8 ring-amber-100/80">
            <AlertCircle className="h-8 w-8 text-amber-600" />
          </div>

          <DialogTitle className="text-center text-xl font-bold text-gray-900 sm:text-2xl">
            Already Registered
          </DialogTitle>

          <DialogDescription className="mx-auto max-w-md text-center text-sm leading-relaxed text-gray-600 sm:text-base">
            {existingPerson ? (
              <>
                <span className="font-semibold text-gray-900">
                  {existingPerson.name}
                </span>{' '}
                is already registered for the{' '}
                <span className="font-semibold text-gray-900">
                  {existingPerson.program}
                </span>{' '}
                program.
              </>
            ) : (
              <>
                This {getFieldMessage()} is already registered for the Mahad
                program.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {existingPerson && (
          <section className="mt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Registration details
            </h3>
            <div className="overflow-hidden rounded-xl border border-gray-100 bg-gray-50/80 p-4 text-sm text-gray-700 sm:p-5 sm:text-base">
              <div className="space-y-3 divide-y divide-gray-200/80">
                <div className="flex items-start justify-between gap-4 pb-3">
                  <span className="text-gray-500">Email</span>
                  <span className="max-w-[60%] break-all text-right font-medium text-gray-900">
                    {existingPerson.email}
                  </span>
                </div>

                {existingPerson.phone && (
                  <div className="flex items-start justify-between gap-4 py-3">
                    <span className="text-gray-500">Phone</span>
                    <span className="max-w-[60%] text-right font-medium text-gray-900">
                      {existingPerson.phone}
                    </span>
                  </div>
                )}

                <div className="flex items-start justify-between gap-4 py-3">
                  <span className="text-gray-500">Registered</span>
                  <span className="max-w-[60%] text-right font-medium text-gray-900">
                    {existingPerson.registeredDate}
                  </span>
                </div>

                <div className="flex items-start justify-between gap-4 pt-3">
                  <span className="text-gray-500">Status</span>
                  <span className="max-w-[60%] text-right font-semibold text-emerald-700">
                    {existingPerson.enrollmentStatus}
                  </span>
                </div>
              </div>
            </div>
          </section>
        )}

        <div className="mt-5 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/90 px-4 py-3 text-xs text-blue-900 sm:text-sm">
          <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-blue-100">
            <Camera className="h-4 w-4" />
          </div>
          <p className="leading-relaxed">
            <span className="font-semibold">
              Having trouble completing your registration?
            </span>{' '}
            Please screenshot this information and send it to Ustadh Mustafa for
            assistance.
          </p>
        </div>

        <DialogFooter className="mt-6 flex w-full flex-col gap-2 sm:mt-7 sm:flex-col">
          {existingPerson && (
            <Button
              className="h-11 w-full rounded-xl bg-[#25D366] text-sm font-medium text-white shadow-sm hover:bg-[#20BA5A] sm:h-12 sm:text-base"
              onClick={handleWhatsAppClick}
            >
              <MessageCircle className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
              Send to Ustadh Mustafa on WhatsApp
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
