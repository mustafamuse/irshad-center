'use client'

import { useReducer } from 'react'

import { Shift } from '@prisma/client'

export type SheetTab = 'overview' | 'billing' | 'history'

type PendingShift = {
  newShift: Shift
  previousShift: Shift | null
}

type SheetState = {
  editParentDialog: {
    open: boolean
    parentNumber: 1 | 2
    isAdding: boolean
  }
  editChildDialog: {
    open: boolean
    studentId: string | null
  }
  addChildDialog: boolean
  paymentLinkDialog: boolean
  deleteFamilyDialog: boolean
  consolidateSubscriptionDialog: boolean
  shiftPopover: boolean
  pendingShift: PendingShift | null
  activeTab: SheetTab
}

type SheetAction =
  | { type: 'OPEN_EDIT_PARENT'; parentNumber: 1 | 2; isAdding: boolean }
  | { type: 'CLOSE_EDIT_PARENT' }
  | { type: 'OPEN_EDIT_CHILD'; studentId: string }
  | { type: 'CLOSE_EDIT_CHILD' }
  | { type: 'SET_ADD_CHILD_DIALOG'; open: boolean }
  | { type: 'SET_PAYMENT_LINK_DIALOG'; open: boolean }
  | { type: 'SET_DELETE_FAMILY_DIALOG'; open: boolean }
  | { type: 'SET_CONSOLIDATE_SUBSCRIPTION_DIALOG'; open: boolean }
  | { type: 'SET_SHIFT_POPOVER'; open: boolean }
  | { type: 'SET_PENDING_SHIFT'; shift: PendingShift | null }
  | { type: 'SET_ACTIVE_TAB'; tab: SheetTab }
  | { type: 'RESET' }

const initialState: SheetState = {
  editParentDialog: { open: false, parentNumber: 1, isAdding: false },
  editChildDialog: { open: false, studentId: null },
  addChildDialog: false,
  paymentLinkDialog: false,
  deleteFamilyDialog: false,
  consolidateSubscriptionDialog: false,
  shiftPopover: false,
  pendingShift: null,
  activeTab: 'overview',
}

function sheetReducer(state: SheetState, action: SheetAction): SheetState {
  switch (action.type) {
    case 'OPEN_EDIT_PARENT':
      return {
        ...state,
        editParentDialog: {
          open: true,
          parentNumber: action.parentNumber,
          isAdding: action.isAdding,
        },
      }
    case 'CLOSE_EDIT_PARENT':
      return {
        ...state,
        editParentDialog: { ...state.editParentDialog, open: false },
      }
    case 'OPEN_EDIT_CHILD':
      return {
        ...state,
        editChildDialog: { open: true, studentId: action.studentId },
      }
    case 'CLOSE_EDIT_CHILD':
      return {
        ...state,
        editChildDialog: { ...state.editChildDialog, open: false },
      }
    case 'SET_ADD_CHILD_DIALOG':
      return { ...state, addChildDialog: action.open }
    case 'SET_PAYMENT_LINK_DIALOG':
      return { ...state, paymentLinkDialog: action.open }
    case 'SET_DELETE_FAMILY_DIALOG':
      return { ...state, deleteFamilyDialog: action.open }
    case 'SET_CONSOLIDATE_SUBSCRIPTION_DIALOG':
      return { ...state, consolidateSubscriptionDialog: action.open }
    case 'SET_SHIFT_POPOVER':
      return { ...state, shiftPopover: action.open }
    case 'SET_PENDING_SHIFT':
      return { ...state, pendingShift: action.shift }
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.tab }
    case 'RESET':
      return initialState
    default:
      return state
  }
}

export function useSheetState() {
  const [state, dispatch] = useReducer(sheetReducer, initialState)

  return {
    state,
    actions: {
      openEditParent: (parentNumber: 1 | 2, isAdding: boolean) =>
        dispatch({ type: 'OPEN_EDIT_PARENT', parentNumber, isAdding }),
      closeEditParent: () => dispatch({ type: 'CLOSE_EDIT_PARENT' }),
      openEditChild: (studentId: string) =>
        dispatch({ type: 'OPEN_EDIT_CHILD', studentId }),
      closeEditChild: () => dispatch({ type: 'CLOSE_EDIT_CHILD' }),
      setAddChildDialog: (open: boolean) =>
        dispatch({ type: 'SET_ADD_CHILD_DIALOG', open }),
      setPaymentLinkDialog: (open: boolean) =>
        dispatch({ type: 'SET_PAYMENT_LINK_DIALOG', open }),
      setDeleteFamilyDialog: (open: boolean) =>
        dispatch({ type: 'SET_DELETE_FAMILY_DIALOG', open }),
      setConsolidateSubscriptionDialog: (open: boolean) =>
        dispatch({ type: 'SET_CONSOLIDATE_SUBSCRIPTION_DIALOG', open }),
      setShiftPopover: (open: boolean) =>
        dispatch({ type: 'SET_SHIFT_POPOVER', open }),
      setPendingShift: (shift: PendingShift | null) =>
        dispatch({ type: 'SET_PENDING_SHIFT', shift }),
      setActiveTab: (tab: SheetTab) =>
        dispatch({ type: 'SET_ACTIVE_TAB', tab }),
      reset: () => dispatch({ type: 'RESET' }),
    },
  }
}
