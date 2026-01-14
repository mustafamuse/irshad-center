'use client'

import { useState, useCallback } from 'react'

import { Shift } from '@prisma/client'

export type SheetTab = 'overview' | 'billing' | 'history'

type PendingShift = {
  newShift: Shift
  previousShift: Shift | null
}

type EditParentState = {
  open: boolean
  parentNumber: 1 | 2
  isAdding: boolean
}

type EditChildState = {
  open: boolean
  studentId: string | null
}

export function useSheetState() {
  const [editParentDialog, setEditParentDialog] = useState<EditParentState>({
    open: false,
    parentNumber: 1,
    isAdding: false,
  })
  const [editChildDialog, setEditChildDialog] = useState<EditChildState>({
    open: false,
    studentId: null,
  })
  const [addChildDialog, setAddChildDialog] = useState(false)
  const [paymentLinkDialog, setPaymentLinkDialog] = useState(false)
  const [deleteFamilyDialog, setDeleteFamilyDialog] = useState(false)
  const [consolidateSubscriptionDialog, setConsolidateSubscriptionDialog] =
    useState(false)
  const [shiftPopover, setShiftPopover] = useState(false)
  const [pendingShift, setPendingShift] = useState<PendingShift | null>(null)
  const [activeTab, setActiveTab] = useState<SheetTab>('overview')

  const openEditParent = useCallback(
    (parentNumber: 1 | 2, isAdding: boolean) => {
      setEditParentDialog({ open: true, parentNumber, isAdding })
    },
    []
  )

  const closeEditParent = useCallback(() => {
    setEditParentDialog((prev) => ({ ...prev, open: false }))
  }, [])

  const openEditChild = useCallback((studentId: string) => {
    setEditChildDialog({ open: true, studentId })
  }, [])

  const closeEditChild = useCallback(() => {
    setEditChildDialog((prev) => ({ ...prev, open: false }))
  }, [])

  const reset = useCallback(() => {
    setEditParentDialog({ open: false, parentNumber: 1, isAdding: false })
    setEditChildDialog({ open: false, studentId: null })
    setAddChildDialog(false)
    setPaymentLinkDialog(false)
    setDeleteFamilyDialog(false)
    setConsolidateSubscriptionDialog(false)
    setShiftPopover(false)
    setPendingShift(null)
    setActiveTab('overview')
  }, [])

  return {
    state: {
      editParentDialog,
      editChildDialog,
      addChildDialog,
      paymentLinkDialog,
      deleteFamilyDialog,
      consolidateSubscriptionDialog,
      shiftPopover,
      pendingShift,
      activeTab,
    },
    actions: {
      openEditParent,
      closeEditParent,
      openEditChild,
      closeEditChild,
      setAddChildDialog,
      setPaymentLinkDialog,
      setDeleteFamilyDialog,
      setConsolidateSubscriptionDialog,
      setShiftPopover,
      setPendingShift,
      setActiveTab,
      reset,
    },
  }
}
