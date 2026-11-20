// src/api.ts — the custom REST endpoints. What is covered here is
// `create-ydoc`, the one handler that built its stream message out of a yhub
// internal: it diffed the posted update in the compute pool's `patchYdoc`,
// which yhub 0.9.1 removed. The handler wrapped that call in a catch-all that
// answers "Invalid Yjs update", so the removal turned every document creation
// into a 400 without a type error at runtime, and with no test failing.
//
// `@y/hub` is faked down to what the module imports; `@y/y` is real, so the
// updates are genuine and the contentmap is decoded the way yhub decodes it.
// The fake instance has the compute pool of yhub 0.10 — no `patchYdoc` — and
// these tests would answer 400 again if the handler went back to it.
//
// The `ready` route is covered at the end: it must report a redis that only
// accepts reads, which a PING cannot see.

import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as Y from '@y/y';

import { makeUpdate } from './_helpers.js';

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
    createApiEndpoint: (name: string, opts: unknown) => ({ name, opts }),
    createDocumentPermissions: (x: unknown) => x,
  };
});

vi.mock('../src/backend.js', () => ({ backendPublicJwk: null }));
vi.mock('../src/authz-cache.js', () => ({ invalidateDocumentAuthz: vi.fn() }));
vi.mock('../src/migration.js', () => ({
  SOFT_MIGRATION: false,
  fullMigrate: vi.fn(),
}));

const DOCID = '00000000-0000-4000-8000-000000000000';

type Handler = (req: unknown) => Promise<Response>;

const createYdoc = async (): Promise<Handler> => {
  const { api } = await import('../src/api.js');
  const endpoint = (
    api as unknown as Array<{
      name: string;
      opts: { post: { handler: Handler } };
    }>
  ).find((e) => e.name === 'create-ydoc');
  if (endpoint == null) throw new Error('create-ydoc is not mounted');
  return endpoint.opts.post.handler;
};

// The surface of yhub 0.10 the handler reaches: the room read, the stream
// write, and a compute pool without the `patchYdoc` 0.9.1 removed.
const makeYhub = (gcDoc: Uint8Array | null = null) => ({
  getDoc: vi.fn(async () => ({ gcDoc })),
  stream: { addMessage: vi.fn(async () => {}) },
  computePool: { mergeUpdates: vi.fn() },
});

const makeReq = (
  body: Uint8Array,
  {
    yhub = makeYhub(),
    authInfo = { userid: 'system', admin: true } as Record<
      string,
      unknown
    > | null,
    headers = { 'x-user-id': 'user-1' } as Record<string, string>,
  } = {},
) => ({
  org: 'docs',
  docid: DOCID,
  branch: 'main',
  docRef: { org: 'docs', docid: DOCID, branch: 'main' },
  // uws hands the body over as a Node Buffer, which the handler re-views
  bytes: async () => Buffer.from(body),
  headers,
  authInfo,
  permissions: {},
  query: {},
  yhub,
});

// Every attribute the contentmap puts on the inserted ids, by name.
const insertAttributes = (contentmap: Uint8Array) => {
  const attrs = new Map<string, unknown>();
  Y.decodeContentMap(contentmap).inserts.clients.forEach((ranges) =>
    ranges
      .getIds()
      .forEach((range) =>
        range.attrs.forEach((attr) => attrs.set(attr.name, attr.val)),
      ),
  );
  return attrs;
};

beforeEach(() => {
  vi.resetModules();
});

describe('create-ydoc', () => {
  it('creates the document without the compute pool’s removed patchYdoc', async () => {
    const handler = await createYdoc();
    const yhub = makeYhub();
    const update = makeUpdate('hello world');

    const res = await handler(makeReq(update, { yhub }));

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ message: 'Document created' });
    expect(yhub.computePool.mergeUpdates).not.toHaveBeenCalled();
    expect(yhub.stream.addMessage).toHaveBeenCalledTimes(1);
  });

  it('appends the update as posted, as yhub’s own PATCH does since 0.9.1', async () => {
    const handler = await createYdoc();
    const yhub = makeYhub();
    const update = makeUpdate('hello world');

    await handler(makeReq(update, { yhub }));

    const [docRef, message] = yhub.stream.addMessage.mock
      .calls[0] as unknown as [
      unknown,
      { type: string; update: Uint8Array; contentmap: Uint8Array },
    ];
    expect(docRef).toEqual({ org: 'docs', docid: DOCID, branch: 'main' });
    expect(message.type).toBe('ydoc:update:v1');
    // an exact Uint8Array, not the Buffer `req.bytes()` resolved to: the
    // stream-message schema compares constructors
    expect(message.update.constructor).toBe(Uint8Array);
    expect(Array.from(message.update)).toEqual(Array.from(update));
    // and it is a document yhub can read back
    const doc = new Y.Doc();
    Y.applyUpdate(doc, message.update);
    expect(doc.get('t', 'text').toString()).toBe('hello world');
  });

  it('attributes every inserted id to the user the admin token names, now', async () => {
    const handler = await createYdoc();
    const yhub = makeYhub();
    const update = makeUpdate('hello world');
    const before = Date.now();

    await handler(makeReq(update, { yhub }));

    const [, { contentmap }] = yhub.stream.addMessage.mock
      .calls[0] as unknown as [unknown, { contentmap: Uint8Array }];
    // the contentmap covers exactly the ids the update inserts
    const covered = Y.createContentIdsFromContentMap(
      Y.decodeContentMap(contentmap),
    );
    const posted = Y.createContentIdsFromUpdate(update);
    expect(Y.excludeContentIds(posted, covered).inserts.clients.size).toBe(0);
    expect(Y.excludeContentIds(covered, posted).inserts.clients.size).toBe(0);
    // with the author and the timestamp the activity timeline reads
    const attrs = insertAttributes(contentmap);
    expect(attrs.get('insert')).toBe('user-1');
    expect(attrs.get('insertAt')).toBeGreaterThanOrEqual(before);
    expect(attrs.get('insertAt')).toBeLessThanOrEqual(Date.now());
  });

  it('attributes a user’s own create to them, whatever X-User-Id says', async () => {
    const handler = await createYdoc();
    const yhub = makeYhub();

    await handler(
      makeReq(makeUpdate(), {
        yhub,
        authInfo: { userid: 'user-2' },
        headers: { 'x-user-id': 'someone-else' },
      }),
    );

    const [, { contentmap }] = yhub.stream.addMessage.mock
      .calls[0] as unknown as [unknown, { contentmap: Uint8Array }];
    expect(insertAttributes(contentmap).get('insert')).toBe('user-2');
  });

  it('falls back to the admin identity when no X-User-Id is sent', async () => {
    const handler = await createYdoc();
    const yhub = makeYhub();

    await handler(makeReq(makeUpdate(), { yhub, headers: {} }));

    const [, { contentmap }] = yhub.stream.addMessage.mock
      .calls[0] as unknown as [unknown, { contentmap: Uint8Array }];
    expect(insertAttributes(contentmap).get('insert')).toBe('system');
  });

  it.each([
    ['truncated', makeUpdate('hello world').slice(0, -5)],
    ['garbage', new Uint8Array([7, 7, 7, 7, 7, 7, 7, 7, 7, 7])],
    [
      'corrupted',
      (() => {
        const update = makeUpdate('hello world');
        update[5] ^= 0xff;
        update[10] ^= 0xff;
        return update;
      })(),
    ],
  ])('refuses a %s update with 400 and writes nothing', async (_, update) => {
    const handler = await createYdoc();
    const yhub = makeYhub();

    const res = await handler(makeReq(update, { yhub }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid Yjs update' });
    expect(yhub.stream.addMessage).not.toHaveBeenCalled();
  });

  it('refuses an update that inserts nothing, which would create no room', async () => {
    // a delete set alone is a valid update of more than three bytes
    const doc = new Y.Doc();
    doc.get('t', 'text').insert(0, 'abc');
    const stateVector = Y.encodeStateVector(doc);
    doc.get('t', 'text').delete(0, 3);
    const deleteOnly = Y.encodeStateAsUpdate(doc, stateVector);
    expect(deleteOnly.byteLength).toBeGreaterThan(3);
    const handler = await createYdoc();
    const yhub = makeYhub();

    const res = await handler(makeReq(deleteOnly, { yhub }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Empty update' });
    expect(yhub.stream.addMessage).not.toHaveBeenCalled();
  });

  it('refuses an empty body before reading the room', async () => {
    const handler = await createYdoc();
    const yhub = makeYhub();

    const res = await handler(makeReq(new Uint8Array([0, 0]), { yhub }));

    expect(res.status).toBe(400);
    expect(yhub.getDoc).not.toHaveBeenCalled();
  });

  it('answers 409 on a room that already has content, and writes nothing', async () => {
    const handler = await createYdoc();
    const yhub = makeYhub(makeUpdate('already here'));

    const res = await handler(makeReq(makeUpdate(), { yhub }));

    expect(res.status).toBe(409);
    expect(yhub.stream.addMessage).not.toHaveBeenCalled();
  });

  it('refuses an anonymous caller', async () => {
    const handler = await createYdoc();
    const yhub = makeYhub();

    const res = await handler(makeReq(makeUpdate(), { yhub, authInfo: null }));

    expect(res.status).toBe(401);
    expect(yhub.stream.addMessage).not.toHaveBeenCalled();
  });
});

describe('append-ydoc', () => {
  const appendYdoc = async (): Promise<Handler | undefined> => {
    const { api } = await import('../src/api.js');
    return (
      api as unknown as Array<{
        name: string;
        opts: { post: { handler: Handler } };
      }>
    ).find((e) => e.name === 'append-ydoc')?.opts.post.handler;
  };

  const enabledAppendYdoc = async (): Promise<Handler> => {
    vi.stubEnv('YHUB_APPEND_YDOC_ENABLED', 'true');
    const handler = await appendYdoc();
    vi.unstubAllEnvs();
    if (handler == null) throw new Error('append-ydoc is not mounted');
    return handler;
  };

  it('is not mounted unless the QA flag asks for it', async () => {
    vi.stubEnv('YHUB_APPEND_YDOC_ENABLED', '');
    expect(await appendYdoc()).toBeUndefined();
    vi.unstubAllEnvs();
  });

  it('appends to a document that has content, in the name of X-User-Id', async () => {
    const handler = await enabledAppendYdoc();
    const yhub = makeYhub(makeUpdate('already here'));
    const update = makeUpdate('hello world');

    const res = await handler(makeReq(update, { yhub }));

    expect(res.status).toBe(200);
    const [, message] = yhub.stream.addMessage.mock.calls[0] as unknown as [
      unknown,
      { update: Uint8Array; contentmap: Uint8Array },
    ];
    expect(Array.from(message.update)).toEqual(Array.from(update));
    const attrs = insertAttributes(message.contentmap);
    expect(attrs.get('insert')).toBe('user-1');
    expect(attrs.get('insertAt')).toEqual(expect.any(Number));
  });

  it('attributes an update that only deletes', async () => {
    const doc = new Y.Doc();
    doc.get('t', 'text').insert(0, 'abc');
    const stateVector = Y.encodeStateVector(doc);
    doc.get('t', 'text').delete(0, 3);
    const deleteOnly = Y.encodeStateAsUpdate(doc, stateVector);
    const handler = await enabledAppendYdoc();
    const yhub = makeYhub();

    const res = await handler(makeReq(deleteOnly, { yhub }));

    expect(res.status).toBe(200);
    const [, { contentmap }] = yhub.stream.addMessage.mock
      .calls[0] as unknown as [unknown, { contentmap: Uint8Array }];
    const deletes = Y.decodeContentMap(contentmap).deletes;
    expect(deletes.clients.size).toBe(1);
  });

  it('refuses any caller but the admin token', async () => {
    const handler = await enabledAppendYdoc();
    const yhub = makeYhub();

    const res = await handler(
      makeReq(makeUpdate(), { yhub, authInfo: { userid: 'user-2' } }),
    );

    expect(res.status).toBe(403);
    expect(yhub.stream.addMessage).not.toHaveBeenCalled();
  });

  it('refuses an update without the user to attribute it to', async () => {
    const handler = await enabledAppendYdoc();
    const yhub = makeYhub();

    const res = await handler(makeReq(makeUpdate(), { yhub, headers: {} }));

    expect(res.status).toBe(400);
    expect(yhub.stream.addMessage).not.toHaveBeenCalled();
  });

  it('refuses an invalid update', async () => {
    const handler = await enabledAppendYdoc();
    const yhub = makeYhub();

    const res = await handler(
      makeReq(new Uint8Array([7, 7, 7, 7, 7, 7, 7, 7]), { yhub }),
    );

    expect(res.status).toBe(400);
    expect(yhub.stream.addMessage).not.toHaveBeenCalled();
  });
});

// `ready` probes redis with a write: a replica left behind by a failover
// answers PING, so only a write tells that the updates can no longer land.
describe('ready', () => {
  const readyHandler = async (): Promise<Handler> => {
    const { api } = await import('../src/api.js');
    const endpoint = (
      api as unknown as Array<{
        name: string;
        opts: { get: { handler: Handler } };
      }>
    ).find((e) => e.name === 'ready');
    if (endpoint == null) throw new Error('ready is not mounted');
    return endpoint.opts.get.handler;
  };

  const probe = async (set: () => Promise<unknown>) => {
    const handler = await readyHandler();
    const res = await handler({
      yhub: {
        persistence: { sql: vi.fn(async () => [{ '?column?': 1 }]) },
        stream: { prefix: 'yhub', redis: { set: vi.fn(set) } },
      },
    });
    const body = (await res.json()) as {
      status: string;
      checks: Record<string, string>;
    };
    return { status: res.status, body };
  };

  it('is ready when both stores answer', async () => {
    expect(await probe(async () => 'OK')).toEqual({
      status: 200,
      body: { status: 'ready', checks: { postgres: 'ok', redis: 'ok' } },
    });
  });

  it('is not ready when redis only accepts reads', async () => {
    const result = await probe(async () => {
      throw new Error("READONLY You can't write against a read only replica.");
    });

    expect(result).toEqual({
      status: 503,
      body: {
        status: 'unready',
        checks: { postgres: 'ok', redis: 'readonly' },
      },
    });
  });

  it('is not ready when redis cannot be reached, and hides the error', async () => {
    const result = await probe(async () => {
      throw new Error('connect ECONNREFUSED redis://user:secret@valkey:6379');
    });

    expect(result.status).toBe(503);
    expect(result.body.checks.redis).toBe('unreachable');
    expect(JSON.stringify(result.body)).not.toContain('secret');
  });
});
