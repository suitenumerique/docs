// src/permissions.ts — Docs' access policy as yhub permission objects.
//
// The assertions run yhub's real permission pipeline (`@y/hub/permissions`, a
// subpath export that pulls in neither redis nor postgres) and are phrased as
// the questions yhub's gates ask (`hasPermissions`) rather than as a snapshot
// of the tables — a mask may be respelled, but it may not start answering
// differently.

import { describe, expect, it } from 'vitest';

import type { DocumentPermissionsV1Normalized } from '@y/hub/permissions';
import {
  createDocumentPermissions,
  createGlobalPermissions,
  hasPermissions,
  normalizePermissions,
} from '@y/hub/permissions';

import {
  adminDocumentPermissions,
  browserDocumentPermissions,
  publicGlobalPermissions,
  resolveHistoryFrom,
} from '../src/permissions.js';

const ACCESS_SINCE = 1_700_000_000_000;

const norm = (p: Parameters<typeof normalizePermissions>[0]) =>
  normalizePermissions(p) as DocumentPermissionsV1Normalized;

const reader = norm(browserDocumentPermissions(false, ACCESS_SINCE));
const editor = norm(browserDocumentPermissions(true, ACCESS_SINCE));
const linkReader = norm(browserDocumentPermissions(false));
const linkEditor = norm(browserDocumentPermissions(true));
const admin = norm(adminDocumentPermissions);

const grants = (
  permissions: DocumentPermissionsV1Normalized,
  required: Parameters<typeof createDocumentPermissions>[0],
) => hasPermissions(permissions, createDocumentPermissions(required));

describe('presence', () => {
  it('lets a reader receive presence but never broadcast it', () => {
    expect(grants(reader, { awareness: '-r--' })).toBe(true);
    expect(grants(reader, { awareness: '--u-' })).toBe(false);
  });

  it('lets an editor broadcast presence', () => {
    expect(grants(editor, { awareness: '--u-' })).toBe(true);
  });
});

describe('the document and its transports', () => {
  it('lets a reader read but not write, on either transport', () => {
    expect(grants(reader, { ydoc: '-r--' })).toBe(true);
    expect(grants(reader, { ydoc: '--u-' })).toBe(false);
    expect(grants(reader, { endpoint: { ws: '-r--' } })).toBe(true);
    expect(grants(reader, { endpoint: { ws: '--u-' } })).toBe(false);
    expect(grants(reader, { endpoint: { ydoc: '--u-' } })).toBe(false);
  });

  it('lets an editor write over the socket and PATCH over http', () => {
    expect(grants(editor, { ydoc: '--u-' })).toBe(true);
    expect(grants(editor, { endpoint: { ws: '--u-' } })).toBe(true);
    expect(grants(editor, { endpoint: { ydoc: '--u-' } })).toBe(true);
  });

  it('never lets a browser DELETE the document', () => {
    expect(grants(editor, { endpoint: { ydoc: '---d' } })).toBe(false);
    expect(grants(editor, { delete: ['soft'] })).toBe(false);
  });

  it('withholds create — populating initial content is the admin token', () => {
    expect(grants(editor, { ydoc: 'c---' })).toBe(false);
  });
});

describe('the history a user may read', () => {
  it('starts the ray where the user got access and no earlier', () => {
    for (const who of [reader, editor]) {
      expect(grants(who, { history: { from: ACCESS_SINCE } })).toBe(true);
      expect(grants(who, { history: { from: ACCESS_SINCE - 1 } })).toBe(false);
      expect(grants(who, { history: { from: 0 } })).toBe(false);
    }
  });

  it('opens the timeline read-only for reader and editor alike', () => {
    for (const who of [reader, editor]) {
      for (const name of ['activity', 'changeset']) {
        expect(grants(who, { endpoint: { [name]: '-r--' } })).toBe(true);
        expect(grants(who, { endpoint: { [name]: '--u-' } })).toBe(false);
      }
    }
  });

  it('never grants the full ray that would unlock gc=false', () => {
    for (const who of [reader, editor]) {
      const history = who.history;
      expect(history).not.toBe(false);
      expect(history === false ? -1 : history.from).toBeGreaterThan(0);
    }
  });

  it('never grants prune', () => {
    for (const who of [reader, editor]) {
      expect(grants(who, { history: { from: ACCESS_SINCE, prune: true } })).toBe(
        false,
      );
      expect(grants(who, { endpoint: { prune: 'c---' } })).toBe(false);
    }
  });
});

describe('rollback', () => {
  it('lets an editor undo a window inside its own ray', () => {
    expect(
      grants(editor, { history: { from: ACCESS_SINCE, rollback: true } }),
    ).toBe(true);
    expect(grants(editor, { endpoint: { rollback: 'c---' } })).toBe(true);
  });

  it('refuses an editor a window wider than its ray, or unbounded', () => {
    expect(grants(editor, { history: { from: 0, rollback: true } })).toBe(false);
    expect(
      grants(editor, { history: { from: ACCESS_SINCE - 1, rollback: true } }),
    ).toBe(false);
  });

  it('never lets a reader roll back anything', () => {
    expect(
      grants(reader, { history: { from: ACCESS_SINCE, rollback: true } }),
    ).toBe(false);
    expect(grants(reader, { endpoint: { rollback: 'c---' } })).toBe(false);
  });

  it('is a dead grant without the write it rides on', () => {
    const readerWithRollback = norm({
      ...browserDocumentPermissions(false, ACCESS_SINCE),
      history: { from: ACCESS_SINCE, rollback: true },
    });
    const history = readerWithRollback.history;
    expect(history === false ? null : history.rollback).toBe(false);
  });

  it('is withheld from the admin token', () => {
    expect(grants(admin, { history: { from: 0, rollback: true } })).toBe(false);
  });
});

describe('a reader who holds only the link', () => {
  it('gets no history and cannot reach the timeline', () => {
    for (const who of [linkReader, linkEditor]) {
      expect(who.history).toBe(false);
      expect(grants(who, { history: { from: ACCESS_SINCE } })).toBe(false);
      for (const name of ['activity', 'changeset']) {
        expect(grants(who, { endpoint: { [name]: '-r--' } })).toBe(false);
      }
    }
  });

  it('still reads and syncs the document like anyone else', () => {
    expect(grants(linkReader, { ydoc: '-r--' })).toBe(true);
    expect(grants(linkEditor, { ydoc: '--u-' })).toBe(true);
    expect(grants(linkEditor, { endpoint: { ws: '--u-' } })).toBe(true);
  });
});

describe('everything the browser must not reach', () => {
  it.each([
    'prune',
    'create-ydoc',
    'migrate',
    'reset-connections',
    'restore-ydoc',
    'reset-ydoc',
    'some-endpoint-added-later',
  ])('refuses %s to an editor — there is no "*" fallback', (name) => {
    expect(grants(editor, { endpoint: { [name]: '-r--' } })).toBe(false);
    expect(grants(editor, { endpoint: { [name]: 'c---' } })).toBe(false);
  });
});

describe('the admin token', () => {
  it('reaches every endpoint, named or not', () => {
    expect(
      grants(admin, { endpoint: { 'create-ydoc': 'crud', migrate: 'crud' } }),
    ).toBe(true);
  });

  it('reads and writes the document with its full history', () => {
    expect(grants(admin, { ydoc: '-ru-' })).toBe(true);
    expect(grants(admin, { history: { from: 0 } })).toBe(true);
  });

  it('soft-deletes but never hard-deletes over REST, and is not granted prune', () => {
    expect(grants(admin, { delete: ['soft'] })).toBe(true);
    expect(grants(admin, { delete: ['hard'] })).toBe(false);
    expect(grants(admin, { history: { from: 0, prune: true } })).toBe(false);
  });
});

describe('the public global routes', () => {
  const globalPerms = normalizePermissions(publicGlobalPermissions);
  const globalGrants = (
    required: Parameters<typeof createGlobalPermissions>[0],
  ) => hasPermissions(globalPerms, createGlobalPermissions(required));

  it.each(['ping', 'ready', 'jwks'])('serves %s to anyone, read only', (name) => {
    expect(globalGrants({ endpoint: { [name]: '-r--' } })).toBe(true);
    expect(globalGrants({ endpoint: { [name]: '--u-' } })).toBe(false);
  });

  it('refuses a global endpoint it does not name', () => {
    expect(globalGrants({ endpoint: { anything: '-r--' } })).toBe(false);
  });
});

describe('resolveHistoryFrom', () => {
  const httpError = (status: number) =>
    Object.assign(new Error(`HTTP ${status}`), { status });
  const never = () => {
    throw new Error('the access must not be fetched');
  };

  it('does not fetch an access the caller has no history to bound', async () => {
    expect(await resolveHistoryFrom({ versions_list: false }, never)).toBe(null);
    expect(await resolveHistoryFrom({}, never)).toBe(null);
    expect(await resolveHistoryFrom(undefined, never)).toBe(null);
  });

  it('turns the access date into unix milliseconds', async () => {
    const from = await resolveHistoryFrom({ versions_list: true }, async () => ({
      created_at: '2023-11-14T22:13:20Z',
    }));
    expect(from).toBe(Date.parse('2023-11-14T22:13:20Z'));
  });

  it('grants no history when the backend refuses the access', async () => {
    for (const status of [401, 403, 404]) {
      expect(
        await resolveHistoryFrom({ versions_list: true }, async () => {
          throw httpError(status);
        }),
      ).toBe(null);
    }
  });

  it('rethrows when the backend does not answer at all', async () => {
    for (const status of [500, 502, 503]) {
      await expect(
        resolveHistoryFrom({ versions_list: true }, async () => {
          throw httpError(status);
        }),
      ).rejects.toMatchObject({ status });
    }
    await expect(
      resolveHistoryFrom({ versions_list: true }, async () => {
        throw new TypeError('fetch failed');
      }),
    ).rejects.toBeInstanceOf(TypeError);
  });

  it('grants no history rather than all of it on an unusable date', async () => {
    for (const created_at of [undefined, null, '', 'not a date']) {
      expect(
        await resolveHistoryFrom({ versions_list: true }, async () => ({
          created_at,
        })),
      ).toBe(null);
    }
    expect(
      await resolveHistoryFrom({ versions_list: true }, async () => undefined),
    ).toBe(null);
  });

  it('refuses the epoch, which would unlock a gc=false socket', async () => {
    expect(
      await resolveHistoryFrom({ versions_list: true }, async () => ({
        created_at: '1970-01-01T00:00:00Z',
      })),
    ).toBe(null);
  });
});
