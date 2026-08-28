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
/**
 * When these two were given access to the document. Any positive number would
 * do — what the assertions care about is that it is the value the ray starts at,
 * and that it is not zero.
 */
const ACCESS_SINCE = 1_700_000_000_000;

const reader = normalizePermissions(
  browserDocumentPermissions(false, ACCESS_SINCE),
);
const editor = normalizePermissions(
  browserDocumentPermissions(true, ACCESS_SINCE),
);
// the same two reaching the document by link alone: no access row, so no date
const linkReader = normalizePermissions(browserDocumentPermissions(false));
const linkEditor = normalizePermissions(browserDocumentPermissions(true));
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

describe('the history a user may read', () => {
  /**
   * The rule Docs has always had, now expressed as a permission: a user sees the
   * document's history from the moment they were given access to it, and no
   * further back. yhub clamps every changeset/activity read up to this, so the
   * bound is enforced on the server and the client never has to know it.
   */
  it('starts the ray where the user got access', () => {
    for (const who of [reader, editor]) {
      assert.equal(grants(who, { history: { from: ACCESS_SINCE } }), true);
    }
  });

  it('does not reach back before that', () => {
    // a requirement asking for a wider ray than the grant is not contained in it
    for (const who of [reader, editor]) {
      assert.equal(grants(who, { history: { from: ACCESS_SINCE - 1 } }), false);
      assert.equal(grants(who, { history: { from: 0 } }), false);
    }
  });

  it('opens the timeline and one point in it, read only', () => {
    for (const who of [reader, editor]) {
      for (const name of ['activity', 'changeset']) {
        assert.equal(grants(who, { endpoint: { [name]: '-r--' } }), true);
        // GET only: neither endpoint has another verb, and granting one would
        // be granting a route that does not exist
        assert.equal(grants(who, { endpoint: { [name]: '--u-' } }), false);
      }
    }
  });

  it('never grants the full ray, which is what would unlock gc=false', () => {
    // `gc=false` demands `history.from === 0` exactly. A real access date is
    // ~1.8e12, so this can only regress through a bug — assert on the object
    // rather than through `hasPermissions`, because it is the literal value
    // that matters here
    for (const who of [reader, editor]) {
      assert.notEqual(who.history, false);
      assert.ok(who.history.from > 0);
    }
  });

  it('never grants rollback or prune', () => {
    // destructive, granted by name, and restoring a version is not something
    // this grant does
    for (const who of [reader, editor]) {
      assert.equal(
        grants(who, { history: { from: ACCESS_SINCE, rollback: true } }),
        false,
      );
      assert.equal(
        grants(who, { history: { from: ACCESS_SINCE, prune: true } }),
        false,
      );
      assert.equal(grants(who, { endpoint: { rollback: 'c---' } }), false);
      assert.equal(grants(who, { endpoint: { prune: 'c---' } }), false);
    }
  });
});

describe('a reader who holds no access, only the link', () => {
  /**
   * There is no access row and so no date. The backend has always refused these
   * users their version history for exactly that reason — "we wouldn't know from
   * which date to allow them anyway" — and the grant says the same thing by
   * withholding the facet.
   */
  it('gets no history at all', () => {
    for (const who of [linkReader, linkEditor]) {
      assert.equal(who.history, false);
      assert.equal(grants(who, { history: { from: 0 } }), false);
      assert.equal(grants(who, { history: { from: ACCESS_SINCE } }), false);
    }
  });

  it('cannot reach the timeline either', () => {
    // withheld together with the ray: without it these two answer 403 on their
    // own, so granting them would open nothing and only muddy the grant
    for (const who of [linkReader, linkEditor]) {
      for (const name of ['activity', 'changeset']) {
        assert.equal(grants(who, { endpoint: { [name]: '-r--' } }), false);
      }
    }
  });

  it('still reads and syncs the document like anyone else', () => {
    assert.equal(grants(linkReader, { ydoc: '-r--' }), true);
    assert.equal(grants(linkEditor, { ydoc: '--u-' }), true);
    assert.equal(grants(linkEditor, { endpoint: { ws: '--u-' } }), true);
  });
});

describe('everything the browser must not reach', () => {
  // there is no '*' fallback in the browser grant, so an endpoint yhub adds in
  // a future release is denied until it is named — this is the property that
  // replaced 0.7's `purpose != null` check
  for (const name of [
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
