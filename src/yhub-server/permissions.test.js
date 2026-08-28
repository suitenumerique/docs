import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// Reached by path rather than by name on purpose. `@y/hub`'s export map exposes
// only the package index, which pulls in uws, redis and postgres — and the two
// functions this test needs to run yhub's real pipeline (normalize the plugin's
// answer, then ask it the gate's question) are not on it. Importing the module
// directly keeps the test to plain objects, and if yhub ever moves the file the
// failure is loud rather than silently vacuous.
import {
  createDocumentPermissions,
  hasPermissions,
  normalizePermissions,
} from './node_modules/@y/hub/src/permissions.js';

import {
  adminDocumentPermissions,
  browserDocumentPermissions,
  publicGlobalPermissions,
} from './permissions.js';

/**
 * These tables are Docs' entire access policy, and yhub reads them literally —
 * a wrong character in a mask is a silent grant. So the assertions below are
 * written as the questions yhub itself asks at each gate (`hasPermissions`),
 * not as a snapshot of the objects: a table may be respelled freely, but it may
 * not start answering a question differently.
 */
const reader = normalizePermissions(browserDocumentPermissions(false));
const editor = normalizePermissions(browserDocumentPermissions(true));
const admin = normalizePermissions(adminDocumentPermissions);

const grants = (permissions, required) =>
  hasPermissions(permissions, createDocumentPermissions(required));

describe('read-only users and presence (suitenumerique/docs#2544)', () => {
  it('lets a reader receive presence', () => {
    assert.equal(grants(reader, { awareness: '-r--' }), true);
  });

  it('never lets a reader broadcast presence', () => {
    // the requirement this migration exists for. yhub's own default grants a
    // reader '-ru-' here; Docs deliberately does not.
    assert.equal(grants(reader, { awareness: '--u-' }), false);
  });

  it('lets an editor broadcast presence', () => {
    assert.equal(grants(editor, { awareness: '--u-' }), true);
  });
});

describe('the document itself', () => {
  it('lets a reader read but not write', () => {
    assert.equal(grants(reader, { ydoc: '-r--' }), true);
    assert.equal(grants(reader, { ydoc: '--u-' }), false);
  });

  it('lets an editor write', () => {
    assert.equal(grants(editor, { ydoc: '--u-' }), true);
  });

  it('opens the socket to a reader but admits no update over it', () => {
    assert.equal(grants(reader, { endpoint: { ws: '-r--' } }), true);
    assert.equal(grants(reader, { endpoint: { ws: '--u-' } }), false);
  });

  it('lets an editor send updates over the socket', () => {
    assert.equal(grants(editor, { endpoint: { ws: '--u-' } }), true);
  });
});

describe('the http fallback route', () => {
  it('lets a reader GET the document and no more', () => {
    assert.equal(grants(reader, { endpoint: { ydoc: '-r--' } }), true);
    assert.equal(grants(reader, { endpoint: { ydoc: '--u-' } }), false);
  });

  it('lets an editor GET and PATCH', () => {
    assert.equal(grants(editor, { endpoint: { ydoc: '-r--' } }), true);
    assert.equal(grants(editor, { endpoint: { ydoc: '--u-' } }), true);
  });

  it('never lets a browser DELETE the document', () => {
    // deletion is Django's, through the admin token
    assert.equal(grants(editor, { endpoint: { ydoc: '---d' } }), false);
    assert.equal(grants(editor, { delete: ['soft'] }), false);
  });
});

describe('everything the browser must not reach', () => {
  // there is no '*' fallback in the browser grant, so an endpoint yhub adds in
  // a future release is denied until it is named — this is the property that
  // replaced 0.7's `purpose != null` check
  for (const name of [
    'activity',
    'changeset',
    'rollback',
    'prune',
    'create-ydoc',
    'migrate',
    'reset-connections',
    'restore-ydoc',
    'reset-ydoc',
    'some-endpoint-added-later',
  ]) {
    it(`refuses ${name} to an editor`, () => {
      assert.equal(grants(editor, { endpoint: { [name]: '-r--' } }), false);
      assert.equal(grants(editor, { endpoint: { [name]: 'c---' } }), false);
    });
  }

  it('withholds history, which is what refuses a gc=false connection', () => {
    assert.equal(grants(editor, { history: { from: 0 } }), false);
  });
});

describe('the admin token', () => {
  it('reaches every endpoint, named or not', () => {
    assert.equal(
      grants(admin, { endpoint: { 'create-ydoc': 'crud', migrate: 'crud' } }),
      true,
    );
  });

  it('reads and writes the document, with its full history', () => {
    assert.equal(grants(admin, { ydoc: '-ru-' }), true);
    assert.equal(grants(admin, { history: { from: 0 } }), true);
  });

  it('soft-deletes but never hard-deletes over REST', () => {
    // DELETE /ydoc?hard=true became reachable over REST in yhub 0.8; Docs keeps
    // irreversible erasure programmatic, behind reset-ydoc
    assert.equal(grants(admin, { delete: ['soft'] }), true);
    assert.equal(grants(admin, { delete: ['hard'] }), false);
  });

  it('is not granted rollback or prune', () => {
    // 0.8 stopped implying them from write access; Docs does not use them
    assert.equal(grants(admin, { history: { from: 0, rollback: true } }), false);
    assert.equal(grants(admin, { history: { from: 0, prune: true } }), false);
  });
});

describe('the public global routes', () => {
  const globalPerms = normalizePermissions(publicGlobalPermissions);
  const globalGrants = (required) =>
    hasPermissions(globalPerms, {
      type: 'permissions:global:v1',
      ...required,
    });

  for (const name of ['ping', 'ready', 'jwks']) {
    it(`serves ${name} to anyone, read only`, () => {
      assert.equal(globalGrants({ endpoint: { [name]: '-r--' } }), true);
      assert.equal(globalGrants({ endpoint: { [name]: '--u-' } }), false);
    });
  }

  it('refuses a global endpoint it does not name', () => {
    assert.equal(globalGrants({ endpoint: { anything: '-r--' } }), false);
  });
});
