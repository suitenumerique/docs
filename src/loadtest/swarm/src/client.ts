/**
 * One virtual client: a Y.Doc and the very provider the frontend uses
 * (`y-websocket`'s WebsocketProvider, same options), over a `ws` socket that
 * carries the session cookie and the origin a browser would send.
 *
 * Edits go into a Y.Text and a Y.Map of the document that the editor does not
 * render (`loadtest-text`, `loadtest-stamps`): the server persists and fans them
 * out like any content, without the swarm having to build BlockNote blocks. A
 * document a swarm wrote to keeps those types in its history — only run this
 * on anonymised data.
 */
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';
import WebSocket from 'ws';
import type { ClientOptions as SocketOptions } from 'ws';

import * as metrics from './metrics.js';
import type { Samples } from './stats.js';

export interface ClientOptions {
  id: number;
  url: string;
  origin: string;
  room: string;
  cookie: string;
  writer: boolean;
  editInterval: number;
  editSize: number;
  awarenessInterval: number;
  samples: {
    connect: Samples;
    sync: Samples;
    propagation: Samples;
  };
}

const STAMPS = 'loadtest-stamps';
const TEXT = 'loadtest-text';
const TYPED = 'abcdefghijklmnopqrstuvwxyz     ';

// The polyfill y-websocket instantiates with `(url, protocols)`: the headers
// ride in through the class, one per client since each has its own cookie.
const socketClass = (
  cookie: string,
  origin: string,
  onUpgradeFailure: (status: number) => void,
) =>
  class SwarmSocket extends WebSocket {
    constructor(url: string, protocols?: string | string[]) {
      const options: SocketOptions = {
        headers: { cookie, origin },
        // a bad certificate on preprod is not what is being tested
        rejectUnauthorized: false,
      };
      super(url, protocols, options);
      this.on('unexpected-response', (_req, res) => {
        onUpgradeFailure(res.statusCode ?? 0);
        res.resume();
      });
    }
  };

export class Client {
  readonly doc = new Y.Doc();
  readonly options: ClientOptions;
  provider: WebsocketProvider | null = null;
  state: 'idle' | 'connecting' | 'connected' | 'disconnected' = 'idle';
  connections = 0;
  edits = 0;
  private editTimer: NodeJS.Timeout | null = null;
  private awarenessTimer: NodeJS.Timeout | null = null;
  private connectAskedAt = 0;
  private connectedAt = 0;
  private synced = false;
  private seq = 0;
  private seen = new Map<string, number>();

  constructor(options: ClientOptions) {
    this.options = options;
    this.doc.getMap<{ seq: number; ts: number }>(STAMPS).observe((event) => {
      // every key the event carries was set by another client (own changes
      // arrive here too, but with this doc as their origin)
      if (event.transaction.origin === this) return;
      const now = Date.now();
      for (const key of event.keysChanged) {
        const stamp = event.target.get(key);
        if (!stamp || key === `w${this.options.id}`) continue;
        // a stamp written before this client synced is history, not latency
        if ((this.seen.get(key) ?? -1) >= stamp.seq) continue;
        if (this.seen.has(key) || this.synced) {
          const latency = (now - stamp.ts) / 1000;
          if (latency >= 0 && latency < 3600) {
            metrics.propagationLatency.observe(latency);
            this.options.samples.propagation.add(latency);
          }
        }
        this.seen.set(key, stamp.seq);
      }
    });
    this.doc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin !== this) metrics.updatesReceivedTotal.inc();
      void update;
    });
  }

  connect(): void {
    if (this.provider) return;
    this.setState('connecting');
    this.connectAskedAt = Date.now();
    this.synced = false;
    const provider = new WebsocketProvider(
      this.options.url,
      this.options.room,
      this.doc,
      {
        WebSocketPolyfill: socketClass(
          this.options.cookie,
          this.options.origin,
          (status) => {
            metrics.upgradeFailuresTotal.inc({ status: String(status) });
          },
        ) as unknown as typeof globalThis.WebSocket,
        // the frontend's options, see useProviderStore.tsx
        disableBc: true,
        maxBackoffTime: 30000,
        resyncInterval: 20000,
      },
    );
    provider.on('status', ({ status }) => {
      if (status === 'connected') {
        this.connectedAt = Date.now();
        this.connections += 1;
        if (this.connections > 1) metrics.reconnectsTotal.inc();
        else {
          const seconds = (this.connectedAt - this.connectAskedAt) / 1000;
          metrics.connectDuration.observe(seconds);
          this.options.samples.connect.add(seconds);
        }
        this.setState('connected');
        this.watchSocket(provider);
      } else if (status === 'disconnected') {
        this.setState('disconnected');
        this.synced = false;
        // the provider reconnects on its own: what is measured is the next open
        this.connectAskedAt = Date.now();
      } else {
        this.setState('connecting');
      }
    });
    provider.on('sync', (isSynced: boolean) => {
      if (!isSynced || this.synced) return;
      this.synced = true;
      const seconds = (Date.now() - this.connectedAt) / 1000;
      metrics.syncDuration.observe(seconds);
      this.options.samples.sync.add(seconds);
      if (this.options.writer) this.startWriting();
    });
    provider.on('connection-close', (event) => {
      metrics.closesTotal.inc({ code: String(event?.code ?? 'none') });
    });
    provider.on('connection-error', () => {
      metrics.errorsTotal.inc({ kind: 'connection' });
    });
    this.provider = provider;
  }

  private watchSocket(provider: WebsocketProvider): void {
    const ws = provider.ws as unknown as WebSocket | null;
    if (!ws || (ws as unknown as { swarmWatched?: boolean }).swarmWatched)
      return;
    (ws as unknown as { swarmWatched?: boolean }).swarmWatched = true;
    ws.on('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
      metrics.messagesTotal.inc({ direction: 'in' });
      metrics.bytesTotal.inc({ direction: 'in' }, byteLength(data));
    });
    const send = ws.send.bind(ws);
    (ws as unknown as { send: typeof ws.send }).send = ((
      data: Parameters<typeof ws.send>[0],
      ...rest: unknown[]
    ) => {
      metrics.messagesTotal.inc({ direction: 'out' });
      metrics.bytesTotal.inc({ direction: 'out' }, byteLength(data as Buffer));
      return (send as (...args: unknown[]) => void)(data, ...rest);
    }) as typeof ws.send;
  }

  private startWriting(): void {
    if (this.editTimer) return;
    const { editInterval, awarenessInterval } = this.options;
    // spread the writers over the interval rather than firing them together
    const first = Math.random() * editInterval;
    this.editTimer = setTimeout(() => {
      this.edit();
      this.editTimer = setInterval(() => this.edit(), editInterval);
    }, first);
    if (awarenessInterval > 0) {
      this.awarenessTimer = setInterval(
        () => this.awareness(),
        awarenessInterval,
      );
    }
  }

  private edit(): void {
    if (this.state !== 'connected') return;
    this.seq += 1;
    const text = this.doc.getText(TEXT);
    const chunk = Array.from(
      { length: this.options.editSize },
      () => TYPED[Math.floor(Math.random() * TYPED.length)],
    ).join('');
    this.doc.transact(() => {
      text.insert(text.length, chunk);
      this.doc
        .getMap(STAMPS)
        .set(`w${this.options.id}`, { seq: this.seq, ts: Date.now() });
    }, this);
    this.edits += 1;
    metrics.editsTotal.inc();
  }

  private awareness(): void {
    if (this.state !== 'connected' || !this.provider) return;
    this.provider.awareness.setLocalStateField('cursor', {
      // what the editor broadcasts, roughly: a position that moves
      anchor: this.doc.getText(TEXT).length,
      head: this.doc.getText(TEXT).length,
      ts: Date.now(),
    });
  }

  /** Drop the socket and let the provider reconnect, after `jitter` ms. */
  storm(jitter: number): void {
    const provider = this.provider;
    if (!provider) return;
    provider.disconnect();
    this.setState('disconnected');
    this.synced = false;
    setTimeout(() => {
      this.connectAskedAt = Date.now();
      provider.connect();
    }, Math.random() * jitter);
  }

  /** Stop editing; the connection stays, so that the last updates land. */
  stopWriting(): void {
    // one handle covers both the initial timeout and the interval that
    // replaces it: clearing it as both is harmless
    if (this.editTimer) {
      clearTimeout(this.editTimer);
      clearInterval(this.editTimer);
    }
    if (this.awarenessTimer) clearInterval(this.awarenessTimer);
    this.editTimer = null;
    this.awarenessTimer = null;
    this.options.writer = false;
  }

  /** Close for good. */
  destroy(): void {
    this.stopWriting();
    this.provider?.destroy();
    this.provider = null;
    this.setState('idle');
  }

  /** What this client holds, for the convergence check. */
  fingerprint(): string {
    const stamps = this.doc.getMap<{ seq: number }>(STAMPS);
    const entries = [...stamps.entries()]
      .map(([key, value]) => `${key}=${value.seq}`)
      .sort()
      .join(',');
    return `${this.doc.getText(TEXT).length}|${entries}`;
  }

  private setState(state: Client['state']): void {
    if (state === this.state) return;
    if (this.state !== 'idle')
      metrics.clientsByState.dec({ state: this.state });
    this.state = state;
    if (state !== 'idle') metrics.clientsByState.inc({ state });
  }
}

const byteLength = (data: Buffer | ArrayBuffer | Buffer[] | string): number => {
  if (typeof data === 'string') return Buffer.byteLength(data);
  if (Array.isArray(data))
    return data.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  return data.byteLength;
};
