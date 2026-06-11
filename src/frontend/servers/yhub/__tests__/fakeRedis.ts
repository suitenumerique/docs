/**
 * Minimal in-memory stand-in for the node-redis v5 client, covering only the
 * surface the gateway uses (registry keys, lock, kick pub/sub). Preferred
 * over a mocking library so SET NX / TTL semantics are real.
 */
export class FakeRedis {
  store = new Map<string, { value: string; expiresAt: number | null }>();
  published: Array<{ channel: string; message: string }> = [];

  private isExpired(key: string): boolean {
    const entry = this.store.get(key);
    return !!entry && entry.expiresAt !== null && entry.expiresAt <= Date.now();
  }

  private liveEntry(key: string) {
    if (this.isExpired(key)) {
      this.store.delete(key);
    }
    return this.store.get(key);
  }

  set(
    key: string,
    value: string,
    opts?: { EX?: number; PX?: number; NX?: boolean },
  ): Promise<string | null> {
    if (opts?.NX && this.liveEntry(key)) {
      return Promise.resolve(null);
    }
    const ttlMs = opts?.PX ?? (opts?.EX !== undefined ? opts.EX * 1000 : null);
    this.store.set(key, {
      value,
      expiresAt: ttlMs === null ? null : Date.now() + ttlMs,
    });
    return Promise.resolve('OK');
  }

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.liveEntry(key)?.value ?? null);
  }

  del(key: string): Promise<number> {
    const existed = this.liveEntry(key) ? 1 : 0;
    this.store.delete(key);
    return Promise.resolve(existed);
  }

  mGet(keys: string[]): Promise<Array<string | null>> {
    return Promise.resolve(
      keys.map((key) => this.liveEntry(key)?.value ?? null),
    );
  }

  async *scanIterator(opts: { MATCH: string; COUNT?: number }) {
    const prefix = opts.MATCH.endsWith('*')
      ? opts.MATCH.slice(0, -1)
      : opts.MATCH;
    const matches = [...this.store.keys()].filter(
      (key) => key.startsWith(prefix) && !this.isExpired(key),
    );
    // node-redis v5 iterators yield batches
    if (matches.length > 0) {
      yield matches;
    }
  }

  eval(
    script: string,
    opts: { keys: string[]; arguments: string[] },
  ): Promise<number> {
    // Only the compare-and-delete lock release script is used.
    const [key] = opts.keys;
    const [token] = opts.arguments;
    if (this.liveEntry(key)?.value === token) {
      this.store.delete(key);
      return Promise.resolve(1);
    }
    return Promise.resolve(0);
  }

  publish(channel: string, message: string): Promise<number> {
    this.published.push({ channel, message });
    return Promise.resolve(1);
  }
}
