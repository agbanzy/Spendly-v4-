/**
 * A bounded, TTL-based in-memory idempotency cache.
 * Prevents unbounded memory growth that occurs with plain Set<string>.
 *
 * Features:
 * - Automatic expiration of entries after configurable TTL
 * - Maximum size cap with LRU eviction (oldest entries removed first)
 * - Same API surface as Set (has, add) for drop-in replacement
 * - Periodic cleanup of expired entries
 */
export class IdempotencyCache {
  private cache: Map<string, number>; // key -> expiry timestamp
  private maxSize: number;
  private ttlMs: number;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(maxSize: number = 10000, ttlMs: number = 3600000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;

    // Run cleanup every 5 minutes to remove expired entries
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    // Don't keep process alive just for cleanup
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean {
    const expiry = this.cache.get(key);
    if (expiry === undefined) return false;

    if (Date.now() > expiry) {
      // Entry expired — remove it
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Add a key to the cache with TTL
   */
  add(key: string): void {
    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, Date.now() + this.ttlMs);
  }

  /**
   * Get current cache size (including possibly expired entries)
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    this.cache.forEach((expiry, key) => {
      if (now > expiry) {
        this.cache.delete(key);
      }
    });
  }

  /**
   * Stop the cleanup interval (for graceful shutdown)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}
