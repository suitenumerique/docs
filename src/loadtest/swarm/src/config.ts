/**
 * Everything the swarm is told, from the command line, validated once here.
 *
 *   swarm --manifest m.json --url wss://docs.example.com --clients 500 \
 *         --mode wide --duration 300 --ramp 20 --writers 0.3
 */
import { parseArgs } from 'node:util';

export type Mode = 'idle' | 'hot' | 'wide';

export interface Config {
  manifest: string;
  /** Base of the websocket url, `wss://host` — the room path is appended. */
  url: string;
  /** The `Origin` header, which yhub checks against its allowlist. */
  origin: string;
  org: string;
  clients: number;
  /** Connections opened per second while ramping up. */
  ramp: number;
  /** Seconds to hold once every client is connected. */
  duration: number;
  mode: Mode;
  /** `hot`: the one document everybody opens. Defaults to the first public one. */
  doc?: string;
  /** Share of the clients that edit, the rest only read. */
  writers: number;
  /** Milliseconds between two edits of a writer. */
  editInterval: number;
  /** Characters typed per edit. */
  editSize: number;
  /** Milliseconds between two awareness updates of a writer, 0 for none. */
  awarenessInterval: number;
  /** Second of the hold at which every client disconnects and reconnects, 0 for never. */
  stormAt: number;
  /** Maximum jitter, in milliseconds, before a client reconnects in a storm. */
  reconnectJitter: number;
  /** Seconds to wait for the documents to converge once the edits stop. */
  settle: number;
  metricsPort: number;
  /** Bearer token the metrics listener requires, empty for none. */
  metricsToken: string;
  /** Where the final report is written, `-` for stdout. */
  report: string;
  /** Seconds between two progress lines on stderr. */
  progressInterval: number;
}

const MODES: Mode[] = ['idle', 'hot', 'wide'];

const number = (
  name: string,
  raw: string | undefined,
  dflt: number,
  min: number,
  max = Infinity,
): number => {
  if (raw === undefined || raw === '') return dflt;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(
      `--${name} must be a number between ${min} and ${max} (got "${raw}")`,
    );
  }
  return value;
};

export const parseConfig = (argv: string[]): Config => {
  const { values } = parseArgs({
    args: argv,
    options: {
      manifest: { type: 'string' },
      url: { type: 'string' },
      origin: { type: 'string' },
      org: { type: 'string', default: 'docs' },
      clients: { type: 'string' },
      ramp: { type: 'string' },
      duration: { type: 'string' },
      mode: { type: 'string', default: 'wide' },
      doc: { type: 'string' },
      writers: { type: 'string' },
      'edit-interval': { type: 'string' },
      'edit-size': { type: 'string' },
      'awareness-interval': { type: 'string' },
      'storm-at': { type: 'string' },
      'reconnect-jitter': { type: 'string' },
      settle: { type: 'string' },
      'metrics-port': { type: 'string' },
      'metrics-token': { type: 'string', default: '' },
      report: { type: 'string', default: '-' },
      'progress-interval': { type: 'string' },
    },
    strict: true,
  });
  if (!values.manifest) throw new Error('--manifest is required');
  if (!values.url) throw new Error('--url is required (wss://host)');
  let url: URL;
  try {
    url = new URL(values.url);
  } catch {
    throw new Error(`--url is not a url (got "${values.url}")`);
  }
  if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
    throw new Error(`--url must be ws:// or wss:// (got "${values.url}")`);
  }
  const mode = values.mode as Mode;
  if (!MODES.includes(mode)) {
    throw new Error(
      `--mode must be one of ${MODES.join(', ')} (got "${values.mode}")`,
    );
  }
  // what a browser on the application would send: the same host, over http(s)
  const origin =
    values.origin ??
    `${url.protocol === 'wss:' ? 'https' : 'http'}://${url.host}`;
  return {
    manifest: values.manifest,
    url: values.url.replace(/\/+$/, ''),
    origin,
    org: values.org ?? 'docs',
    clients: number('clients', values.clients, 10, 1),
    ramp: number('ramp', values.ramp, 10, 0.1),
    duration: number('duration', values.duration, 60, 0),
    mode,
    doc: values.doc,
    writers: number('writers', values.writers, mode === 'idle' ? 0 : 0.3, 0, 1),
    editInterval: number('edit-interval', values['edit-interval'], 2000, 10),
    editSize: number('edit-size', values['edit-size'], 12, 1, 100000),
    awarenessInterval: number(
      'awareness-interval',
      values['awareness-interval'],
      5000,
      0,
    ),
    stormAt: number('storm-at', values['storm-at'], 0, 0),
    reconnectJitter: number(
      'reconnect-jitter',
      values['reconnect-jitter'],
      3000,
      0,
    ),
    settle: number('settle', values.settle, 15, 0),
    metricsPort: number('metrics-port', values['metrics-port'], 9465, 0, 65535),
    metricsToken: values['metrics-token'] ?? '',
    report: values.report ?? '-',
    progressInterval: number(
      'progress-interval',
      values['progress-interval'],
      10,
      1,
    ),
  };
};
