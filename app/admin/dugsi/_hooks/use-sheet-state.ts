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

type WithdrawChildState = { open: boolean; studentId: string | null }
type ReEnrollChildState = {
  open: boolean
  studentId: string | null
  childName: string | null
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
  const [withdrawChildDialog, setWithdrawChildDialog] =
    useState<WithdrawChildState>({ open: false, studentId: null })
  const [reEnrollChildDialog, setReEnrollChildDialog] =
    useState<ReEnrollChildState>({
      open: false,
      studentId: null,
      childName: null,
    })
  const [addChildDialog, setAddChildDialog] = useState(false)
  const [paymentLinkDialog, setPaymentLinkDialog] = useState(false)
  const [withdrawFamilyDialog, setWithdrawFamilyDialog] = useState(false)
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

  const openWithdrawChild = useCallback((studentId: string) => {
    setWithdrawChildDialog({ open: true, studentId })
  }, [])

  const closeWithdrawChild = useCallback(() => {
    setWithdrawChildDialog({ open: false, studentId: null })
  }, [])

  const openReEnrollChild = useCallback(
    (studentId: string, childName: string) => {
      setReEnrollChildDialog({ open: true, studentId, childName })
    },
    []
  )

  const closeReEnrollChild = useCallback(() => {
    setReEnrollChildDialog({ open: false, studentId: null, childName: null })
  }, [])

  const reset = useCallback(() => {
    setEditParentDialog({ open: false, parentNumber: 1, isAdding: false })
    setEditChildDialog({ open: false, studentId: null })
    setAddChildDialog(false)
    setPaymentLinkDialog(false)
    setWithdrawFamilyDialog(false)
    setConsolidateSubscriptionDialog(false)
    setWithdrawChildDialog({ open: false, studentId: null })
    setReEnrollChildDialog({ open: false, studentId: null, childName: null })
    setShiftPopover(false)
    setPendingShift(null)
    setActiveTab('overview')
  }, [])

  return {
    state: {
      editParentDialog,
      editChildDialog,
      withdrawChildDialog,
      reEnrollChildDialog,
      addChildDialog,
      paymentLinkDialog,
      withdrawFamilyDialog,
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
      openWithdrawChild,
      closeWithdrawChild,
      openReEnrollChild,
      closeReEnrollChild,
      setAddChildDialog,
      setPaymentLinkDialog,
      setWithdrawFamilyDialog,
      setConsolidateSubscriptionDialog,
      setShiftPopover,
      setPendingShift,
      setActiveTab,
      reset,
    },
  }
}
