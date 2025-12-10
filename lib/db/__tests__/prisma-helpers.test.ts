import type { PrismaClient } from '@prisma/client'
import { describe, it, expect, vi } from 'vitest'

import { executeInTransaction } from '../prisma-helpers'
import type { TransactionClient } from '../types'

describe('executeInTransaction', () => {
  it('should execute callback directly when client is already a transaction', async () => {
    const mockTx = {
      person: { create: vi.fn() },
    } as unknown as TransactionClient
    const callback = vi.fn().mockResolvedValue('result')

    const result = await executeInTransaction(mockTx, callback)

    expect(callback).toHaveBeenCalledWith(mockTx)
    expect(result).toBe('result')
  })

  it('should wrap in $transaction when client is PrismaClient', async () => {
    const mockClient = {
      $transaction: vi.fn((cb) => cb({ person: {} })),
    } as unknown as PrismaClient
    const callback = vi.fn().mockResolvedValue('result')

    await executeInTransaction(mockClient, callback)

    expect(mockClient.$transaction).toHaveBeenCalled()
    expect(callback).toHaveBeenCalled()
  })

  it('should return the result from callback', async () => {
    const mockClient = {
      $transaction: vi.fn((cb) => cb({ person: {} })),
    } as unknown as PrismaClient
    const expectedResult = { id: '123', name: 'Test' }
    const callback = vi.fn().mockResolvedValue(expectedResult)

    const result = await executeInTransaction(mockClient, callback)

    expect(result).toEqual(expectedResult)
  })

  it('should propagate errors from callback', async () => {
    const mockClient = {
      $transaction: vi.fn((cb) => cb({ person: {} })),
    } as unknown as PrismaClient
    const callback = vi.fn().mockRejectedValue(new Error('Database error'))

    await expect(executeInTransaction(mockClient, callback)).rejects.toThrow(
      'Database error'
    )
  })
})
