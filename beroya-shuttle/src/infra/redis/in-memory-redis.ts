type StoredValue = {
  value: string;
  expiresAt?: number;
};

export class InMemoryRedis {
  private readonly store = new Map<string, StoredValue>();
  private readonly sets = new Map<string, Set<string>>();
  private readonly timers = new Map<string, NodeJS.Timeout>();

  ping(): Promise<string> {
    return Promise.resolve('PONG');
  }

  get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) {
      return Promise.resolve(null);
    }
    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      this.deleteKey(key);
      return Promise.resolve(null);
    }
    return Promise.resolve(entry.value);
  }

  set(
    key: string,
    value: string,
    mode?: string,
    ttlSeconds?: number,
    extra?: string,
  ): Promise<'OK' | null> {
    const nx = extra === 'NX' || mode === 'NX';
    if (nx && this.store.has(key)) {
      const existing = this.store.get(key);
      if (
        existing &&
        (!existing.expiresAt || existing.expiresAt > Date.now())
      ) {
        return Promise.resolve(null);
      }
    }

    const ttl = typeof ttlSeconds === 'number' ? ttlSeconds : undefined;
    const useTtl = mode === 'EX' && ttl !== undefined;
    this.clearTimer(key);
    const expiresAt =
      useTtl && ttl !== undefined ? Date.now() + ttl * 1000 : undefined;
    this.store.set(key, { value, expiresAt });
    if (expiresAt && ttl !== undefined) {
      const timer = setTimeout(() => this.deleteKey(key), ttl * 1000);
      timer.unref?.();
      this.timers.set(key, timer);
    }
    return Promise.resolve('OK');
  }

  incr(key: string): Promise<number> {
    const current = Number(this.store.get(key)?.value ?? '0');
    const next = Number.isFinite(current) ? current + 1 : 1;
    const expiresAt = this.store.get(key)?.expiresAt;
    this.store.set(key, { value: String(next), expiresAt });
    return Promise.resolve(next);
  }

  expire(key: string, ttlSeconds: number): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) {
      return Promise.resolve(0);
    }
    this.clearTimer(key);
    entry.expiresAt = Date.now() + ttlSeconds * 1000;
    const timer = setTimeout(() => this.deleteKey(key), ttlSeconds * 1000);
    timer.unref?.();
    this.timers.set(key, timer);
    return Promise.resolve(1);
  }

  del(key: string): Promise<number> {
    return Promise.resolve(this.deleteKey(key) ? 1 : 0);
  }

  sadd(key: string, ...members: string[]): Promise<number> {
    const set = this.sets.get(key) ?? new Set<string>();
    let added = 0;
    for (const member of members) {
      if (!set.has(member)) {
        set.add(member);
        added += 1;
      }
    }
    this.sets.set(key, set);
    return Promise.resolve(added);
  }

  srem(key: string, ...members: string[]): Promise<number> {
    const set = this.sets.get(key);
    if (!set) {
      return Promise.resolve(0);
    }
    let removed = 0;
    for (const member of members) {
      if (set.delete(member)) {
        removed += 1;
      }
    }
    if (set.size === 0) {
      this.sets.delete(key);
    }
    return Promise.resolve(removed);
  }

  smembers(key: string): Promise<string[]> {
    return Promise.resolve([...(this.sets.get(key) ?? [])]);
  }

  sismember(key: string, member: string): Promise<number> {
    return Promise.resolve(this.sets.get(key)?.has(member) ? 1 : 0);
  }

  quit(): Promise<'OK'> {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.store.clear();
    this.sets.clear();
    return Promise.resolve('OK');
  }

  private deleteKey(key: string): boolean {
    this.clearTimer(key);
    this.sets.delete(key);
    return this.store.delete(key);
  }

  private clearTimer(key: string): void {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }
}
