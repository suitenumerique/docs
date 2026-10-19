/**
 * The run: which client opens which document as whom, the ramp, the hold, the
 * storm if one is asked for, and the convergence check at the end.
 */
import type { Config } from './config.js';
import { Client } from './client.js';
import type { Manifest, Session } from './manifest.js';
import { Samples } from './stats.js';
import type { Summary } from './stats.js';

export interface Assignment {
  id: number;
  session: Session;
  room: string;
  writer: boolean;
}

export interface Report {
  config: Omit<Config, 'metricsToken'>;
  startedAt: string;
  endedAt: string;
  clients: number;
  documents: number;
  writers: number;
  connected: number;
  reconnects: number;
  edits: number;
  connect: Summary | null;
  sync: Summary | null;
  propagation: Summary | null;
  convergence: {
    documents: number;
    converged: number;
    diverged: string[];
  };
  warnings: string[];
}

/**
 * Give each virtual client a session and a document.
 *
 * Sessions are handed out in turn: with more clients than sessions a user is
 * logged in from several clients, which the report warns about, the API being
 * throttled per user. Documents:
 *   hot   everybody on `config.doc`, else the first public document
 *   wide  writers open a document they may edit, readers one they may read
 *         (or edit), picked in turn from their own list
 *   idle  like wide, and nobody writes
 */
export const assign = (
  config: Config,
  manifest: Manifest,
): { assignments: Assignment[]; warnings: string[] } => {
  const warnings: string[] = [];
  if (config.clients > manifest.sessions.length) {
    warnings.push(
      `${config.clients} clients for ${manifest.sessions.length} sessions: some users are logged in several times, and the API throttles per user`,
    );
  }
  let hotDoc: string | undefined;
  if (config.mode === 'hot') {
    hotDoc = config.doc ?? manifest.public_documents[0];
    if (!hotDoc) {
      throw new Error(
        '--mode hot needs --doc, or a public document in the manifest',
      );
    }
  }
  const writersWanted = Math.round(config.clients * config.writers);
  const assignments: Assignment[] = [];
  let skipped = 0;
  for (let id = 0; assignments.length < config.clients; id++) {
    if (id >= config.clients + skipped + manifest.sessions.length) break;
    const session = manifest.sessions[id % manifest.sessions.length];
    const writer = assignments.filter((a) => a.writer).length < writersWanted;
    let room: string | undefined;
    if (hotDoc) {
      room = hotDoc;
    } else {
      const own = writer
        ? session.editable_documents
        : [...session.readonly_documents, ...session.editable_documents];
      const pool = own.length > 0 ? own : manifest.public_documents;
      room = pool[Math.floor(id / manifest.sessions.length) % pool.length];
    }
    if (!room) {
      skipped += 1;
      continue;
    }
    assignments.push({ id: assignments.length, session, room, writer });
  }
  if (assignments.length < config.clients) {
    warnings.push(
      `only ${assignments.length} of ${config.clients} clients could be given a document: the manifest lists too few`,
    );
  }
  return { assignments, warnings };
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class Swarm {
  readonly config: Config;
  readonly manifest: Manifest;
  readonly clients: Client[] = [];
  readonly warnings: string[] = [];
  private readonly samples = {
    connect: new Samples(),
    sync: new Samples(),
    propagation: new Samples(),
  };
  private stopped = false;

  constructor(config: Config, manifest: Manifest) {
    this.config = config;
    this.manifest = manifest;
  }

  /** Ramp up, hold, storm, stop, settle. Resolves with the report. */
  async run(log: (line: string) => void = () => {}): Promise<Report> {
    const startedAt = new Date();
    const { assignments, warnings } = assign(this.config, this.manifest);
    this.warnings.push(...warnings);
    const wsBase = `${this.config.url}/collaboration/ws/v1/${this.config.org}`;
    for (const a of assignments) {
      this.clients.push(
        new Client({
          id: a.id,
          url: wsBase,
          origin: this.config.origin,
          room: a.room,
          cookie: `${this.manifest.cookie_name}=${a.session.session_key}`,
          writer: a.writer,
          editInterval: this.config.editInterval,
          editSize: this.config.editSize,
          awarenessInterval: this.config.awarenessInterval,
          samples: this.samples,
        }),
      );
    }

    const progress = setInterval(
      () => log(this.progressLine()),
      this.config.progressInterval * 1000,
    );
    try {
      // ramp: `ramp` connections per second, evenly spaced
      const interval = 1000 / this.config.ramp;
      for (const client of this.clients) {
        if (this.stopped) break;
        client.connect();
        await sleep(interval);
      }
      log(`ramp done: ${this.clients.length} clients asked to connect`);

      // hold
      const holdMs = this.config.duration * 1000;
      const stormMs = this.config.stormAt * 1000;
      if (stormMs > 0 && stormMs < holdMs) {
        await this.wait(stormMs);
        log(
          `storm: every client disconnects and reconnects within ${this.config.reconnectJitter}ms`,
        );
        for (const client of this.clients)
          client.storm(this.config.reconnectJitter);
        await this.wait(holdMs - stormMs);
      } else {
        await this.wait(holdMs);
      }
    } finally {
      clearInterval(progress);
    }

    // stop editing, let the last updates land, then compare
    for (const client of this.clients) client.stopWriting();
    log(`hold done, settling ${this.config.settle}s`);
    await sleep(this.config.settle * 1000);
    const convergence = this.convergence();
    for (const client of this.clients) client.destroy();

    const { metricsToken: _token, ...config } = this.config;
    return {
      config,
      startedAt: startedAt.toISOString(),
      endedAt: new Date().toISOString(),
      clients: this.clients.length,
      documents: new Set(assignments.map((a) => a.room)).size,
      writers: assignments.filter((a) => a.writer).length,
      connected: this.clients.filter((c) => c.connections > 0).length,
      reconnects: this.clients.reduce(
        (sum, c) => sum + Math.max(0, c.connections - 1),
        0,
      ),
      edits: this.clients.reduce((sum, c) => sum + c.edits, 0),
      connect: this.samples.connect.summary(),
      sync: this.samples.sync.summary(),
      propagation: this.samples.propagation.summary(),
      convergence,
      warnings: this.warnings,
    };
  }

  /** Ask the run to end at the next step. */
  stop(): void {
    this.stopped = true;
  }

  private async wait(ms: number): Promise<void> {
    const until = Date.now() + ms;
    while (!this.stopped && Date.now() < until) {
      await sleep(Math.min(250, until - Date.now()));
    }
  }

  /** Do all the clients of a document hold the same content? */
  convergence(): Report['convergence'] {
    const byRoom = new Map<string, Set<string>>();
    for (const client of this.clients) {
      if (client.connections === 0) continue;
      const fingerprints = byRoom.get(client.options.room) ?? new Set();
      fingerprints.add(client.fingerprint());
      byRoom.set(client.options.room, fingerprints);
    }
    const diverged = [...byRoom.entries()]
      .filter(([, f]) => f.size > 1)
      .map(([room]) => room);
    return {
      documents: byRoom.size,
      converged: byRoom.size - diverged.length,
      diverged,
    };
  }

  progressLine(): string {
    const counts = { connecting: 0, connected: 0, disconnected: 0, idle: 0 };
    for (const client of this.clients) counts[client.state] += 1;
    const propagation = this.samples.propagation.summary();
    return (
      `clients connected=${counts.connected} connecting=${counts.connecting} ` +
      `disconnected=${counts.disconnected} | edits=${this.clients.reduce((s, c) => s + c.edits, 0)} ` +
      `| propagation p50=${propagation ? (propagation.p50 * 1000).toFixed(0) : '-'}ms ` +
      `p95=${propagation ? (propagation.p95 * 1000).toFixed(0) : '-'}ms (${propagation?.count ?? 0} samples)`
    );
  }
}
