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
