/**
 * Docs' access policy, as yhub 0.8 permission objects.
 *
 * Kept apart from `server.js` so it can be read — and tested — without standing
 * up redis and postgres: these three tables *are* the policy, and they are the
 * only thing between a reader and someone else's document.
 *
 * A permission object states, per facet, what a subject may do with one
 * document; yhub enforces every facet itself, on the websocket and on the REST
 * routes alike. Masks are positional `crud` strings where `-` denies, so
 * `'-r--'` is read-only and `'----'` grants nothing.
 */

/**
 * What a browser may do with a document, from the backend's verdict on it.
 * `canEdit` is `abilities.update`; read access was settled by `abilities.retrieve`
 * before this is reached.
 *
 * `awareness` is why Docs moved to yhub 0.8: a reader receives presence but
 * never publishes it (suitenumerique/docs#2544 — a read-only connection used to
 * propagate cursors even though its document updates were dropped). yhub enforces
 * it on both transports: it drops a read-only connection's awareness message on
 * the socket, and refuses the `awareness` field of `PATCH /ydoc`. Note this is a
 * deliberate departure from yhub's own default, which grants a reader `'-ru-'`
 * and documents read-only cursors as a feature.
 *
 * `ydoc` withholds `c`, which yhub's migration table would grant an editor: `c`
 * is reserved for "may populate the initial content", and in Docs that is
 * `create-ydoc` with the admin token. `u` alone already creates the document on
 * first write.
 *
 * `historyFrom` is the moment this user gained access to the document, in unix
 * milliseconds — the backend's `user_access_since`, which is the earliest access
 * they hold on the document or on one of its ancestors. It becomes the start of
 * the history they may read, which is the rule Docs has always had rather than a
 * new one: the version endpoints have always shown "only those created after the
 * user got access to the document". yhub clamps `from` up to this on every
 * changeset/activity read, so a client asks for whatever range it likes and gets
 * back only its own share — it never has to know the bound, and a stale or
 * modified one cannot widen it.
 *
 * `null` for a reader who reaches the document by link alone. There is no access
 * row and so no date, and the backend has always refused those users their
 * history for exactly that reason: "we wouldn't know from which date to allow
 * them anyway" (`Document.get_abilities`). Without the facet, `activity` and
 * `changeset` answer 403 on their own, so their endpoint entries are withheld
 * together with it rather than granting a route that opens nothing.
 *
 * A bounded ray is not a wall-clock-relative grant: it comes from a stored
 * `created_at`, so it re-derives identically on every websocket recheck, which is
 * what yhub's determinism contract asks for. And it never unlocks a `gc=false`
 * connection, which requires `from === 0` exactly — see the guard in server.js.
 *
 * No `delete` facet: deleting a document is Django's, through the admin token.
 * Deliberately absent too: `rollback` and `prune`, which are destructive and are
 * granted by name — restoring a version is not something a reader, or an editor,
 * does through this grant today.
 *
 * No `'*'` endpoint fallback, so everything not named here is denied — including
 * any endpoint a future yhub release adds. Under 0.7 this fence was a
 * `purpose != null` check in `getAccessType`, which `create-ydoc` slipped through
 * by declaring no purpose.
 */
export const browserDocumentPermissions = (canEdit, historyFrom = null) => ({
  type: 'permissions:document:v1',
  ydoc: canEdit ? '-ru-' : '-r--',
  awareness: canEdit ? '-ru-' : '-r--',
  ...(historyFrom ? { history: { from: historyFrom } } : null),
  endpoint: {
    // `r` opens the socket, `u` admits document updates over it
    ws: canEdit ? '-ru-' : '-r--',
    // GET is `r` and PATCH is `u`; DELETE (`d`) stays out — see `delete` above
    ydoc: canEdit ? '-ru-' : '-r--',
    // the editing timeline, and one point in it — both GET-only, both clamped to
    // the ray above
    ...(historyFrom ? { activity: '-r--', changeset: '-r--' } : null),
  },
});

/**
 * Django's admin token: everything, with one deliberate hole. `delete: ['soft']`
 * and not `'hard'` — yhub 0.8 made `DELETE /ydoc?hard=true` reachable over REST
 * for the first time, and Docs keeps irreversible erasure programmatic, behind
 * `reset-ydoc`, exactly as `yhub_services.delete_ydoc` describes.
 */
export const adminDocumentPermissions = {
  type: 'permissions:document:v1',
  ydoc: 'cru-',
  awareness: '-ru-',
  history: { from: 0 },
  delete: ['soft'],
  endpoint: { '*': 'crud' },
};

/**
 * The global-scoped routes, served to anyone: the JWKS, which carries public keys
 * and which the backend must read before it can authenticate anything we send it,
 * and the two probes, which kubernetes calls with no cookie and no token. Read
 * only, and named individually — a global endpoint added later is denied until it
 * is listed here.
 */
export const publicGlobalPermissions = {
  type: 'permissions:global:v1',
  endpoint: { ping: '-r--', ready: '-r--', jwks: '-r--' },
};
