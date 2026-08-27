interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class ReadinessCache<T> {
  private entry?: CacheEntry<T>;

  constructor(private readonly ttlMs: number) {
    if (!Number.isInteger(ttlMs) || ttlMs < 0 || ttlMs > 5_000) {
      throw new Error('READINESS_CACHE_TTL_INVALID');
    }
  }

  get(now = Date.now()): T | undefined {
    if (!this.entry || this.ttlMs === 0 || now >= this.entry.expiresAt) {
      this.entry = undefined;
      return undefined;
    }
    return this.entry.value;
  }

  set(value: T, now = Date.now()): void {
    if (this.ttlMs === 0) return;
    this.entry = { value, expiresAt: now + this.ttlMs };
  }

  clear(): void {
    this.entry = undefined;
  }
}
