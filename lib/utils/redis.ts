/**
 * Redis Utilities (Legacy Stub)
 *
 * @deprecated Redis functionality has been removed.
 * This file exists for backward compatibility and will be removed in a future release.
 *
 * If you need caching, consider using:
 * - Next.js built-in caching
 * - In-memory caching (for dev/single-instance)
 * - External caching service
 */

/**
 * Mock Redis client for backward compatibility
 * @deprecated Redis has been removed. This is a no-op mock.
 */
const mockRedis = {
  get: async (_key: string): Promise<string | null> => null,
  set: async (
    _key: string,
    _value: string,
    _options?: { EX?: number }
  ): Promise<void> => {},
  del: async (_key: string): Promise<void> => {},
  // Add other methods as needed
}

/**
 * @deprecated Redis has been removed. This is a no-op mock.
 */
export const redis = mockRedis

/**
 * @deprecated Redis has been removed. This function is a no-op.
 */
export async function getRedisClient() {
  console.warn('Redis has been removed. getRedisClient() is a no-op.')
  return null
}

/**
 * @deprecated Redis has been removed. This function is a no-op.
 */
export async function cacheGet(_key: string): Promise<string | null> {
  return null
}

/**
 * @deprecated Redis has been removed. This function is a no-op.
 */
export async function cacheSet(
  _key: string,
  _value: string,
  _ttlSeconds?: number
): Promise<void> {
  // No-op
}

/**
 * @deprecated Redis has been removed. This function is a no-op.
 */
export async function cacheDelete(_key: string): Promise<void> {
  // No-op
}
