type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export function createTtlCache<T>() {
  const cache = new Map<string, CacheEntry<T>>();

  return {
    get(key: string): T | null {
      const entry = cache.get(key);
      if (!entry) {
        return null;
      }

      if (Date.now() > entry.expiresAt) {
        cache.delete(key);
        return null;
      }

      return entry.value;
    },
    set(key: string, value: T, ttlMs: number) {
      cache.set(key, {
        value,
        expiresAt: Date.now() + ttlMs,
      });
    },
    delete(key: string) {
      cache.delete(key);
    },
    clear() {
      cache.clear();
    },
  };
}