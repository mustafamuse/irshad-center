/**
 * useSheetState Hook Tests
 *
 * Tests for the sheet state management hook
 */

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { useSheetState } from '../use-sheet-state'

describe('useSheetState', () => {
  describe('initial state', () => {
    it('should have correct initial values', () => {
      const { result } = renderHook(() => useSheetState())

      expect(result.current.state.editParentDialog).toEqual({
        open: false,
        parentNumber: 1,
        isAdding: false,
      })
      expect(result.current.state.editChildDialog).toEqual({
        open: false,
        studentId: null,
      })
      expect(result.current.state.addChildDialog).toBe(false)
      expect(result.current.state.paymentLinkDialog).toBe(false)
      expect(result.current.state.withdrawFamilyDialog).toBe(false)
      expect(result.current.state.consolidateSubscriptionDialog).toBe(false)
      expect(result.current.state.shiftPopover).toBe(false)
      expect(result.current.state.pendingShift).toBe(null)
      expect(result.current.state.activeTab).toBe('overview')
    })
  })

  describe('openEditParent', () => {
    it('should open edit parent dialog for parent 1', () => {
      const { result } = renderHook(() => useSheetState())

      act(() => {
        result.current.actions.openEditParent(1, false)
      })

      expect(result.current.state.editParentDialog).toEqual({
        open: true,
        parentNumber: 1,
        isAdding: false,
      })
    })

    it('should open edit parent dialog for parent 2 in add mode', () => {
      const { result } = renderHook(() => useSheetState())

      act(() => {
        result.current.actions.openEditParent(2, true)
      })

      expect(result.current.state.editParentDialog).toEqual({
        open: true,
        parentNumber: 2,
        isAdding: true,
      })
    })
  })

  describe('closeEditParent', () => {
    it('should close edit parent dialog while preserving other fields', () => {
      const { result } = renderHook(() => useSheetState())

      act(() => {
        result.current.actions.openEditParent(2, true)
      })

      act(() => {
        result.current.actions.closeEditParent()
      })

      expect(result.current.state.editParentDialog.open).toBe(false)
      expect(result.current.state.editParentDialog.parentNumber).toBe(2)
      expect(result.current.state.editParentDialog.isAdding).toBe(true)
    })
  })

  describe('openEditChild', () => {
    it('should open edit child dialog with student ID', () => {
      const { result } = renderHook(() => useSheetState())

      act(() => {
        result.current.actions.openEditChild('student-123')
      })

      expect(result.current.state.editChildDialog).toEqual({
        open: true,
        studentId: 'student-123',
      })
    })
  })

  describe('closeEditChild', () => {
    it('should close edit child dialog while preserving studentId', () => {
      const { result } = renderHook(() => useSheetState())

      act(() => {
        result.current.actions.openEditChild('student-456')
      })

      act(() => {
        result.current.actions.closeEditChild()
      })

      expect(result.current.state.editChildDialog.open).toBe(false)
      expect(result.current.state.editChildDialog.studentId).toBe('student-456')
    })
  })

  describe('setActiveTab', () => {
    it('should change active tab to billing', () => {
      const { result } = renderHook(() => useSheetState())

      act(() => {
        result.current.actions.setActiveTab('billing')
      })

      expect(result.current.state.activeTab).toBe('billing')
    })

    it('should change active tab to history', () => {
      const { result } = renderHook(() => useSheetState())

      act(() => {
        result.current.actions.setActiveTab('history')
      })

      expect(result.current.state.activeTab).toBe('history')
    })
  })

  describe('setPendingShift', () => {
    it('should set pending shift with both values', () => {
      const { result } = renderHook(() => useSheetState())

      act(() => {
        result.current.actions.setPendingShift({
          newShift: 'AFTERNOON',
          previousShift: 'MORNING',
        })
      })

      expect(result.current.state.pendingShift).toEqual({
        newShift: 'AFTERNOON',
        previousShift: 'MORNING',
      })
    })

    it('should clear pending shift when set to null', () => {
      const { result } = renderHook(() => useSheetState())

      act(() => {
        result.current.actions.setPendingShift({
          newShift: 'MORNING',
          previousShift: 'AFTERNOON',
        })
      })

      act(() => {
        result.current.actions.setPendingShift(null)
      })

      expect(result.current.state.pendingShift).toBe(null)
    })
  })

  describe('reset', () => {
    it('should reset all state to initial values', () => {
      const { result } = renderHook(() => useSheetState())

      act(() => {
        result.current.actions.openEditParent(2, true)
        result.current.actions.openEditChild('student-789')
        result.current.actions.setAddChildDialog(true)
        result.current.actions.setPaymentLinkDialog(true)
        result.current.actions.setWithdrawFamilyDialog(true)
        result.current.actions.setConsolidateSubscriptionDialog(true)
        result.current.actions.setShiftPopover(true)
        result.current.actions.setPendingShift({
          newShift: 'AFTERNOON',
          previousShift: 'MORNING',
        })
        result.current.actions.setActiveTab('billing')
      })

      act(() => {
        result.current.actions.reset()
      })

      expect(result.current.state.editParentDialog).toEqual({
        open: false,
        parentNumber: 1,
        isAdding: false,
      })
      expect(result.current.state.editChildDialog).toEqual({
        open: false,
        studentId: null,
      })
      expect(result.current.state.addChildDialog).toBe(false)
      expect(result.current.state.paymentLinkDialog).toBe(false)
      expect(result.current.state.withdrawFamilyDialog).toBe(false)
      expect(result.current.state.consolidateSubscriptionDialog).toBe(false)
      expect(result.current.state.shiftPopover).toBe(false)
      expect(result.current.state.pendingShift).toBe(null)
      expect(result.current.state.activeTab).toBe('overview')
    })
  })

  describe('boolean dialog setters', () => {
    it('should toggle addChildDialog', () => {
      const { result } = renderHook(() => useSheetState())

      act(() => {
        result.current.actions.setAddChildDialog(true)
      })
      expect(result.current.state.addChildDialog).toBe(true)

      act(() => {
        result.current.actions.setAddChildDialog(false)
      })
      expect(result.current.state.addChildDialog).toBe(false)
    })

    it('should toggle paymentLinkDialog', () => {
      const { result } = renderHook(() => useSheetState())

      act(() => {
        result.current.actions.setPaymentLinkDialog(true)
      })
      expect(result.current.state.paymentLinkDialog).toBe(true)
    })

    it('should toggle withdrawFamilyDialog', () => {
      const { result } = renderHook(() => useSheetState())

      act(() => {
        result.current.actions.setWithdrawFamilyDialog(true)
      })
      expect(result.current.state.withdrawFamilyDialog).toBe(true)
    })

    it('should toggle consolidateSubscriptionDialog', () => {
      const { result } = renderHook(() => useSheetState())

      act(() => {
        result.current.actions.setConsolidateSubscriptionDialog(true)
      })
      expect(result.current.state.consolidateSubscriptionDialog).toBe(true)
    })

    it('should toggle shiftPopover', () => {
      const { result } = renderHook(() => useSheetState())

      act(() => {
        result.current.actions.setShiftPopover(true)
      })
      expect(result.current.state.shiftPopover).toBe(true)
    })
  })
})
