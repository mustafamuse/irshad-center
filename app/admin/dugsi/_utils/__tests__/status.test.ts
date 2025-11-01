/**
 * Status Utilities Tests
 *
 * Tests for status badge utilities
 */

import { describe, it, expect } from 'vitest'

import { getStatusBadgeConfig } from '../status'

describe('getStatusBadgeConfig', () => {
  it('should return correct config for "active" status', () => {
    const config = getStatusBadgeConfig('active')
    expect(config.label).toBe('Active')
    expect(config.icon).toBeDefined()
    expect(config.className).toContain('green')
  })

  it('should return correct config for "pending" status', () => {
    const config = getStatusBadgeConfig('pending')
    expect(config.label).toBe('Pending Setup')
    expect(config.icon).toBeDefined()
    expect(config.className).toContain('yellow')
  })

  it('should return correct config for "no-payment" status', () => {
    const config = getStatusBadgeConfig('no-payment')
    expect(config.label).toBe('No Payment')
    expect(config.icon).toBeDefined()
    expect(config.className).toContain('gray')
  })

  it('should return icon component for all statuses', () => {
    const activeConfig = getStatusBadgeConfig('active')
    const pendingConfig = getStatusBadgeConfig('pending')
    const noPaymentConfig = getStatusBadgeConfig('no-payment')

    expect(activeConfig.icon).toBeDefined()
    expect(pendingConfig.icon).toBeDefined()
    expect(noPaymentConfig.icon).toBeDefined()
  })

  it('should return different labels for each status', () => {
    const activeConfig = getStatusBadgeConfig('active')
    const pendingConfig = getStatusBadgeConfig('pending')
    const noPaymentConfig = getStatusBadgeConfig('no-payment')

    expect(activeConfig.label).not.toBe(pendingConfig.label)
    expect(activeConfig.label).not.toBe(noPaymentConfig.label)
    expect(pendingConfig.label).not.toBe(noPaymentConfig.label)
  })

  it('should return different class names for each status', () => {
    const activeConfig = getStatusBadgeConfig('active')
    const pendingConfig = getStatusBadgeConfig('pending')
    const noPaymentConfig = getStatusBadgeConfig('no-payment')

    expect(activeConfig.className).not.toBe(pendingConfig.className)
    expect(activeConfig.className).not.toBe(noPaymentConfig.className)
    expect(pendingConfig.className).not.toBe(noPaymentConfig.className)
  })
})
