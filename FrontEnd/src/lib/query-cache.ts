type CacheEntry<T> = {
  data: T
  fetchedAt: number
  ttlMs: number
}

class QueryCache {
  private cache = new Map<string, CacheEntry<any>>()
  private inflight = new Map<string, Promise<any>>()

  /** Returns cached value if still fresh, null if missing or expired */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null
    if (Date.now() - entry.fetchedAt > entry.ttlMs) {
      this.cache.delete(key)
      return null
    }
    return entry.data as T
  }

  /** Store value with TTL in milliseconds */
  set<T>(key: string, data: T, ttlMs: number): void {
    this.cache.set(key, { data, fetchedAt: Date.now(), ttlMs })
  }

  /**
   * Deduplicates concurrent fetches: if a fetch for `key` is already in-flight,
   * returns the same Promise instead of starting a new network call.
   */
  async dedupe<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const existing = this.inflight.get(key)
    if (existing) return existing as Promise<T>
    const promise = fetcher().finally(() => this.inflight.delete(key))
    this.inflight.set(key, promise)
    return promise
  }

  /** Invalidate an exact key OR all keys that start with `prefix:` */
  invalidate(keyOrPrefix: string): void {
    for (const key of this.cache.keys()) {
      if (key === keyOrPrefix || key.startsWith(`${keyOrPrefix}:`)) {
        this.cache.delete(key)
      }
    }
  }

  invalidateAll(): void {
    this.cache.clear()
    this.inflight.clear()
  }
}

export const queryCache = new QueryCache()
