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

  it('should return correct config for "churned" status', () => {
    const config = getStatusBadgeConfig('churned')
    expect(config.label).toBe('Churned')
    expect(config.icon).toBeDefined()
    expect(config.className).toContain('gray')
  })

  it('should return correct config for "no-payment" status', () => {
    const config = getStatusBadgeConfig('no-payment')
    expect(config.label).toBe('No Payment')
    expect(config.icon).toBeDefined()
    expect(config.className).toContain('amber')
  })

  it('should return icon component for all statuses', () => {
    const activeConfig = getStatusBadgeConfig('active')
    const churnedConfig = getStatusBadgeConfig('churned')
    const noPaymentConfig = getStatusBadgeConfig('no-payment')

    expect(activeConfig.icon).toBeDefined()
    expect(churnedConfig.icon).toBeDefined()
    expect(noPaymentConfig.icon).toBeDefined()
  })

  it('should return different labels for each status', () => {
    const activeConfig = getStatusBadgeConfig('active')
    const churnedConfig = getStatusBadgeConfig('churned')
    const noPaymentConfig = getStatusBadgeConfig('no-payment')

    expect(activeConfig.label).not.toBe(churnedConfig.label)
    expect(activeConfig.label).not.toBe(noPaymentConfig.label)
    expect(churnedConfig.label).not.toBe(noPaymentConfig.label)
  })

  it('should return different class names for each status', () => {
    const activeConfig = getStatusBadgeConfig('active')
    const churnedConfig = getStatusBadgeConfig('churned')
    const noPaymentConfig = getStatusBadgeConfig('no-payment')

    expect(activeConfig.className).not.toBe(churnedConfig.className)
    expect(activeConfig.className).not.toBe(noPaymentConfig.className)
    expect(churnedConfig.className).not.toBe(noPaymentConfig.className)
  })
})
