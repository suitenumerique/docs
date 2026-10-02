// api.ts — the custom REST endpoints. Only the readiness route is exercised
// here: its handler is called directly with a faked `req.yhub`, the way
// server.spec.ts reaches the wiring without booting a server.
//
// `@y/hub` is faked for its logger and endpoint factory; `./backend.ts` and
// `./migration.ts` are faked so neither keys nor S3 settings are needed;
// `./config.ts` runs for real against the stubbed env.

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@y/hub', () => {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: () => logger,
  };
  return {
    logger,
    checkPermissions: vi.fn(),
    // the real one spreads: { name, ...opts } — keep the mock faithful
    createApiEndpoint: (name: string, opts: unknown) => ({ name, ...(opts as object) }),
    createDocumentPermissions: (x: unknown) => x,
  };
});

vi.mock('../src/backend.js', () => ({ backendPublicJwk: null }));

vi.mock('../src/migration.js', () => ({
  SOFT_MIGRATION: false,
  fullMigrate: vi.fn(),
}));

import { EXPECTED_SCHEMA } from '../src/schema.js';

const completeRows = () =>
  Object.entries(EXPECTED_SCHEMA).flatMap(([table, columns]) =>
    columns.map((column) => ({ table_name: table, column_name: column })),
  );

interface Endpoint {
  name: string;
  get: { handler: (req: unknown) => Promise<Response> };
}

const readyHandler = async () => {
  const { api } = await import('../src/api.js');
  const ready = (api as unknown as Endpoint[]).find((e) => e.name === 'ready');
  if (ready == null) throw new Error('the ready endpoint is not wired');
  return ready.get.handler;
};

interface ReadyBody {
  status: string;
  checks: Record<string, string>;
}

// A req.yhub whose persistence.sql answers `SELECT 1` fine and serves the
// given catalog rows to the schema query.
const reqWith = (
  rows: { table_name: string; column_name: string }[],
  { schemaFails = false }: { schemaFails?: boolean } = {},
) => ({
  yhub: {
    persistence: {
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        if (String(strings).includes('to_regclass')) {
          if (schemaFails) throw new Error('connection reset');
          return rows;
        }
        return [{ '?column?': 1 }];
      }),
    },
    stream: { redis: { ping: vi.fn(async () => 'PONG') } },
  },
});

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('GET /collaboration/ready/v1', () => {
  it('is ready when both stores answer and the schema is complete', async () => {
    const handler = await readyHandler();
    const res = await handler(reqWith(completeRows()));

    expect(res.status).toBe(200);
    const body = (await res.json()) as ReadyBody;
    expect(body).toEqual({
      status: 'ready',
      checks: { postgres: 'ok', redis: 'ok', schema: 'ok' },
    });
  });

  it('is unready with schema "incomplete" when init-db is behind, stores or not', async () => {
    // connectivity is fine, the catalog is not: this is the pod a bare
    // `SELECT 1` would have kept in rotation while every document read failed
    const handler = await readyHandler();
    const res = await handler(reqWith([]));

    expect(res.status).toBe(503);
    const body = (await res.json()) as ReadyBody;
    expect(body.checks).toEqual({
      postgres: 'ok',
      redis: 'ok',
      schema: 'incomplete',
    });
  });

  it('reads a failed schema query as "unreachable", not as drift', async () => {
    // a connection that dies mid-probe is a store problem with a store
    // answer — reporting it as 'incomplete' would send the operator to run
    // init-db against a database that is simply down
    const handler = await readyHandler();
    const res = await handler(reqWith([], { schemaFails: true }));

    expect(res.status).toBe(503);
    const body = (await res.json()) as ReadyBody;
    expect(body.checks.schema).toBe('unreachable');
  });
});
