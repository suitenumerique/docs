import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
} from '@y/protocols/awareness';
import * as Y from '@y/y';
import { decodeAny, encodeAny } from 'lib0/buffer';

const POLL_INTERVAL_MS = 10_000;
const REQUEST_TIMEOUT_MS = 30_000;

/** HTTP transport for Yjs 14 while the socket cannot reach yhub. */
export class HttpFallback {
  private timer?: ReturnType<typeof setTimeout>;
  private abort?: AbortController;
  private pending: Uint8Array[] = [];
  private seeded = false;
  private active = false;
  private destroyed = false;
  private failures = 0;
  synced = false;

  constructor(
    private doc: Y.Doc,
    private url: string,
    private awareness: Awareness | undefined,
    private onSync: () => void,
    private onRefused: () => void,
    private readOnly = awareness === undefined,
    private pollInterval = POLL_INTERVAL_MS,
    private send: typeof fetch = fetch,
  ) {
    doc.on('update', this.onUpdate);
  }

  private onUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin !== this && !this.readOnly) {
      this.pending.push(update);
      if (this.active && !this.abort) {
        this.schedule(1000);
      }
    }
  };

  private schedule(delay: number) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.round(), delay);
  }

  private async request(method: 'GET' | 'PATCH', body?: Uint8Array) {
    const response = await this.send(this.url, {
      method,
      credentials: 'include',
      signal: this.abort?.signal,
      ...(body && {
        headers: { 'content-type': 'application/octet-stream' },
        body: new Uint8Array(body),
      }),
    });
    if (!response.ok) {
      if ([401, 403, 404].includes(response.status)) {
        this.disconnect();
        this.onRefused();
      }
      throw new Error(
        `Collaboration HTTP ${method} failed: ${response.status}`,
      );
    }
    return response;
  }

  private async round() {
    if (!this.active || this.abort) {
      return;
    }
    const controller = new AbortController();
    this.abort = controller;
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    if (!this.seeded) {
      this.pending.unshift(Y.encodeStateAsUpdate(this.doc));
      this.seeded = true;
    }
    const updates = this.pending.splice(0);
    try {
      // Readers cannot PATCH; the websocket and backend enforce their rights.
      if (!this.readOnly && this.active) {
        const update = updates.length
          ? Y.mergeUpdates(updates.map((item) => new Uint8Array(item)))
          : undefined;
        const body = encodeAny({
          ...(update && update.byteLength > 2 && { update }),
          ...(this.awareness && {
            awareness: encodeAwarenessUpdate(this.awareness, [
              this.doc.clientID,
            ]),
          }),
        });
        await this.request('PATCH', body);
      }
      const response = await this.request('GET');
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (!this.active || !bytes.length) {
        return;
      }
      const remote = decodeAny(bytes) as {
        doc?: Uint8Array;
        awareness?: Uint8Array;
      };
      if (remote.doc instanceof Uint8Array) {
        Y.applyUpdate(this.doc, remote.doc, this);
      }
      if (this.awareness && remote.awareness instanceof Uint8Array) {
        applyAwarenessUpdate(this.awareness, remote.awareness, this);
      }
      this.failures = 0;
      this.synced = true;
      this.onSync();
    } catch (error) {
      this.pending.unshift(...updates);
      if (this.active) {
        console.error('Collaboration HTTP fallback failed', error);
        this.failures++;
      }
    } finally {
      clearTimeout(timeout);
      if (this.abort === controller) {
        this.abort = undefined;
      }
      if (this.active && !this.abort) {
        this.schedule(
          this.failures
            ? Math.min(this.pollInterval * 2 ** (this.failures - 1), 60_000)
            : this.pending.length
              ? 1000
              : this.pollInterval,
        );
      }
    }
  }

  connect() {
    if (this.active || this.destroyed) {
      return;
    }
    this.active = true;
    this.schedule(0);
  }

  disconnect() {
    this.active = false;
    this.synced = false;
    clearTimeout(this.timer);
    this.abort?.abort();
    this.abort = undefined;
  }

  destroy() {
    this.destroyed = true;
    this.disconnect();
    this.doc.off('update', this.onUpdate);
  }
}
