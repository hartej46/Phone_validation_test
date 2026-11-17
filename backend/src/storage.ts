import type { StorageAdapter } from "angelos";

export interface IKeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { EX?: number; NX?: boolean }): Promise<any>;
  del(key: string | string[]): Promise<any>;
  keys?(pattern?: string): Promise<string[]> | string[];
}

interface CacheEntry {
  value: string;
  expiresAt: number;
}

/**
 * In-memory key-value store with TTL and NX (set if not exists) support.
 * Replaces external Redis for standalone, zero-dependency deployment.
 */
export class InMemoryKeyValueStore implements IKeyValueStore {
  private store = new Map<string, CacheEntry>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(
    key: string,
    value: string,
    options?: { EX?: number; NX?: boolean }
  ): Promise<boolean | string> {
    if (options?.NX) {
      const existing = await this.get(key);
      if (existing !== null) {
        return false;
      }
    }
    const ttlSeconds = options?.EX ?? 86400; // default 24h
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    return "OK";
  }

  async del(keys: string | string[]): Promise<number> {
    const keyArray = Array.isArray(keys) ? keys : [keys];
    let count = 0;
    for (const key of keyArray) {
      if (this.store.delete(key)) {
        count++;
      }
    }
    return count;
  }

  clear(): void {
    this.store.clear();
  }

  keys(pattern?: string): string[] {
    const now = Date.now();
    const result: string[] = [];
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt <= now) {
        this.store.delete(key);
        continue;
      }
      if (!pattern) {
        result.push(key);
      } else if (pattern.endsWith("*")) {
        const prefix = pattern.slice(0, -1);
        if (key.startsWith(prefix)) {
          result.push(key);
        }
      } else if (key === pattern) {
        result.push(key);
      }
    }
    return result;
  }
}

/**
 * In-memory implementation of Angelos StorageAdapter.
 */
export class InMemoryStorageAdapter implements StorageAdapter {
  constructor(private store: InMemoryKeyValueStore = new InMemoryKeyValueStore()) {}

  async get(key: string): Promise<string | null> {
    return this.store.get(key);
  }

  async setIfAbsent(key: string, value: string, expiresInSeconds: number): Promise<boolean> {
    const res = await this.store.set(key, value, {
      NX: true,
      EX: expiresInSeconds,
    });
    return Boolean(res);
  }

  async delete(key: string): Promise<boolean> {
    const count = await this.store.del(key);
    return count > 0;
  }

  getStore(): InMemoryKeyValueStore {
    return this.store;
  }
}
