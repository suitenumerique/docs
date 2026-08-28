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
 * No `history` facet, and that is load-bearing rather than an omission: it is
 * what makes yhub refuse a `gc=false` connection with a 403. Docs users are
 * served the garbage-collected document; the full history is the backend's.
 *
 * No `delete` facet: deleting a document is Django's, through the admin token.
 *
 * No `'*'` endpoint fallback, so everything not named here is denied. The browser
 * calls exactly two routes — the websocket, and `ydoc` for the http fallback.
 * `activity`, `changeset`, `rollback`, `prune` and every custom endpoint are
 * closed to it. Under 0.7 this fence was a `purpose != null` check in
 * `getAccessType`, which `create-ydoc` slipped through by declaring no purpose.
 */
export const browserDocumentPermissions = (canEdit) => ({
  type: 'permissions:document:v1',
  ydoc: canEdit ? '-ru-' : '-r--',
  awareness: canEdit ? '-ru-' : '-r--',
  endpoint: {
    // `r` opens the socket, `u` admits document updates over it
    ws: canEdit ? '-ru-' : '-r--',
    // GET is `r` and PATCH is `u`; DELETE (`d`) stays out — see `delete` above
    ydoc: canEdit ? '-ru-' : '-r--',
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
