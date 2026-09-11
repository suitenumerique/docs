# Collaboration

By default with Docs, collaboration is enabled. To allow the collaboration between users, a connection to a websocket server is made (the yhub service), you only have to configure the Django backend URL and the allowed origin in your yhub service:

```yaml
COLLABORATION_BACKEND_BASE_URL: https://{yourdocsdomain.tld}
COLLABORATION_SERVER_ORIGIN: https://{yourdocsdomain.tld}
```

The collaboration server keeps the live state of a document in Redis and persists it to a PostgreSQL database of its own, so it needs both:

```yaml
REDIS: redis://{redis-host}:6379/0
POSTGRES: postgres://{user}:{password}@{postgres-host}:5432/yhub
```

Nothing creates that schema at startup: the server never runs DDL. Run the script yhub ships (`yarn init-db`, which the helm chart runs as a job) once before starting it, and again after every upgrade that adds a table. It creates the database when it is missing, it is idempotent, and until it has run every document read fails with `relation "..." does not exist`.

The Django backend reads and writes document content there too, so point it at the service:

```yaml
YHUB_API_BASE_URL: http://{yhub-service}:443
```

Prefer the internal service url: the routes the backend calls are not meant to be reachable from the outside. Route `/collaboration/ws/` to the service publicly — that is the one the browsers open — plus `/collaboration/ydoc/` for the http fallback, `/collaboration/activity/` and `/collaboration/changeset/` for the editing history, `/collaboration/rollback/` for restoring a document to a point in that history, and `/collaboration/jwks/`, which carries public keys and nothing else. Keep everything else in-cluster: `prune`, `reset-connections`, `migrate`, `restore-ydoc`, `reset-ydoc` and `create-ydoc` are refused to a browser by the permission tables anyway, and an endpoint that cannot be reached cannot be probed.

Both directions are authenticated with short-lived RS256 JWTs rather than a shared secret, and each side verifies the other against the JWKS it publishes — so both need a signing key of their own, and neither needs a copy of the other's:

```yaml
# Django
JWT_PRIVATE_KEY_FILE: /path/to/backend-private.pem
# yhub
YHUB_JWT_PRIVATE_KEY_FILE: /path/to/yhub-private.pem
```

They are ordinary PKCS#8 RSA keys (`openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048`), and rolling one needs no change on the other side. Without them the documents still open and edit, but the backend cannot create, delete or restore a document's content, and yhub cannot tell it that a document changed — its `updated_at` stops following the edits.

### Generating them on the cluster

The helm chart generates both for you, so that no key has to be created by hand, put in a values file or in a secret:

```yaml
jwtKeys:
  enabled: true
```

A job then creates the two keys, once, in a secret every service mounts read-only, and points the backend and yhub at them. It generates them with `openssl` in a pod-local volume and hands them to `kubectl create secret`, so they never touch a disk, a manifest or a values file. The secret is left alone when it is already there, so the job is safe to re-run — it runs on every sync — and rolling the keys is deleting the secret and letting the next run create it again. Both sides follow: they pick the verification key by its `kid` and fetch the set again when they meet one they do not know.

The job is the only thing allowed near that secret: the chart gives it a service account whose role can `create` a secret and read whether that one exists, nothing more. The services never call the kubernetes API — they read a mounted file. The secret is not part of the release either, so uninstalling keeps the same identities; delete the secret to start over.

Deployments already holding their keys in a secret of their own point the chart at it instead, and the job and its rights are not created at all:

```yaml
jwtKeys:
  enabled: true
  existingSecret: my-jwt-keys   # holding private.pem and yhub-private.pem
```

Setting `JWT_PRIVATE_KEY_FILE` or `YHUB_JWT_PRIVATE_KEY_FILE` yourself keeps priority over what the job provides, so a deployment holding its keys in a secret of its own can leave `jwtKeys` disabled and mount them where it wants.

Several replicas can serve the same document: they exchange updates through Redis, so no sticky routing is needed on the websocket ingress.

## What happens when connection to the websocket is not allowed?

Some networks refuse a websocket upgrade — corporate proxies, captive portals — and a browser is
told nothing more than "the connection closed". For those clients the editor falls back to polling
the collaboration server over plain http, on the same room, with the same session cookie and the
same authorization. Nothing has to be configured: the fallback is installed next to the websocket
and only ever sends a request while the socket is down.

That means `/collaboration/ydoc/` has to be routed publicly, not only in-cluster — the browsers of
those users call it directly. And the origins a browser may reach the server from are the ones in
`COLLABORATION_SERVER_ORIGIN`, which now gate the http routes as well as the websocket:

```yaml
COLLABORATION_SERVER_ORIGIN: https://{yourdocsdomain.tld}
```

A comma-separated list is allowed, and each entry is a bare origin — `https://host[:port]`, no path
and no trailing slash. A deployment serving the frontend from another origin than the collaboration
server has to list it here or the fallback is refused, the same way the websocket already is.

What the fallback does *not* do is hide the difference. It publishes local changes about a second
after the last keystroke, and it retrieves the document every ten seconds, so someone else's edits
arrive with up to that much delay and remote cursors move at poll resolution. Each round transfers
the whole document, so a large document polled by many clients is real egress. It is a way to keep
editing, not a replacement for the socket — and the socket keeps being retried underneath, so a
client that fell back during an outage returns to it on its own.

A reader on the fallback sees no cursors at all. Read-only clients may not publish presence (see
below), the provider has no receive-only setting for it, and a reader that tried to publish would
be refused and stop polling altogether — so it is built without awareness and only ever reads the
document. On the websocket a reader still sees everyone else's cursors.

Documents are never in conflict either way: both transports publish from the same Yjs document, and
Yjs merges. Before the fallback existed, users who could not open a websocket edited a document that
was saved wholesale and erased each other's modifications; that is what this removes.

## Working offline

Every document this browser opens is kept locally, as a Yjs document in IndexedDB
(`IndexeddbPersistence`, one database per document id). Opening a document offline shows what was
written last time instead of an empty editor, and what is written offline survives a reload.

It lives next to the `Y.Doc`, in `useProviderStore`, and not in the service worker — which is where
it looks like it belongs, since the service worker is already what serves the page and the document
metadata offline. A service worker only sees http, and content that arrives over the websocket
never passes through one, so a worker-side cache would be empty for exactly the clients whose
connection works. Hooking the document instead means it does not matter which transport filled it.

Nothing extra publishes those changes. Both providers answer the collaboration server's sync step 1
with everything the server is missing, so the next connection that opens carries whatever was
written offline, and Yjs merges it — no replay queue, and no wholesale save that could erase someone
else's work.

Three consequences worth knowing:

- A browser with no `indexedDB` — one told to block site data, some private windows — gets an editor
  that behaves exactly as it did before, not a broken one. Local persistence is treated as absent.
- Local content is enough to render, so the editor appears before the socket has finished opening,
  online as well as offline.
- A reader's `PATCH /ydoc` is now dropped client-side rather than sent. The collaboration server
  enforces read-only differently per transport: the socket drops a reader's document updates and
  stays open, while http refuses them with a 403 — and a 4xx is permanent, so the provider would
  stop *before* its first `GET`, since the `PATCH` comes first in a round. That never arose while a
  reader's document stayed empty until the first `GET` filled it, which is exactly what a local copy
  changes. Nothing is lost by dropping it: a reader's content came from the server to begin with.

### What is kept, and for how long

A copy is dropped once nobody has opened that document for thirty days, swept once on startup
(`sweepLocalDocs`). `IndexeddbPersistence` has no expiry of its own, so without this every document
ever opened would be kept until the browser evicted it under storage pressure — which it does
without asking and without order.

When each copy was last opened is tracked in a small IndexedDB database of its own
(`docs-local-index`), not in local storage — so it shares one fate with the copies it tracks. A
browser clears site data and evicts storage per origin, so the index and the documents it indexes
are wiped together or kept together, never one without the other. Where the browser can enumerate
its databases (`indexedDB.databases()` — Chromium and WebKit, never Firefox), the sweep also drops
any document-shaped database the index has lost track of, so an index that was somehow lost cannot
strand copies on disk.

**Content is not cleared on logout.** A local copy outlives the session that created it, so on a
shared machine the next person to use that browser profile has the documents of the last one. This
is a deliberate gap, not an oversight — clearing on logout, and on a document whose access the
server has revoked, is still to do.

### The service worker's part

The collaboration server's rest api is never cached: `ydoc`, `activity`, `changeset` and `rollback`
are all `NetworkOnly`. This is not the default — the collaboration server is on the application's
own origin unless an instance moves it, so without a route of its own a poll for the live document
falls through to the catch-all `StaleWhileRevalidate` and is answered from a cache: a room frozen at
the moment it was first read, and, offline, one the provider would take for a successful round and
report as synced. A version list read from a cache has the same problem, missing every version made
since.

## Who may share a cursor

Presence — the coloured cursors and selections of the other people in a document — is a permission
of its own, separate from the right to edit. A **reader receives presence but never publishes it**:
they see who else is in the document and where, and nobody sees them.

The collaboration server enforces this itself rather than trusting the editor to be quiet. It drops
a read-only connection's presence message on the websocket, and refuses the `awareness` field of a
fallback request, so a modified or stale client changes nothing. See the access-control section of
`src/yhub-server/README.md` for the permission tables this comes from.

Note this is deliberately stricter than the collaboration server's own default, which lets
read-only connections broadcast cursors.

## How much history a user may see

The editing history is bounded per user: **you see the document's history from the moment you were
given access to it, and no further back.** Joining a document that has been written for a year does
not hand you the year — it hands you what happened since you arrived.

This is not a new rule. It is the one the version endpoints have always applied ("only those
created after the user got access to the document"); it now also bounds the collaboration server's
`activity` and `changeset` routes, which are what a history view is built on.

The date is the earliest access you hold on the document **or on one of its ancestors** — share a
folder with someone and they get its whole subtree from that moment, including documents created in
it later. The backend computes it (`user_access_since` on the document endpoint) and the
collaboration server turns it into the start of the history it will serve. The bound is applied
server-side and silently: a client asks for whatever range it likes and receives only its own
share, so there is no bound for it to get wrong and none it can widen.

A reader who reaches a document through its link alone — a public or authenticated-reach document
they hold no access on — gets **no history at all**, not a bounded one. There is no access record
and therefore no date to bound it with, which is the same reason the version endpoints have always
refused them.

## What a version is

The version history lists the document's editing activity at a granularity of **one minute**:
changes less than a minute apart become one version, and no version spans more than a minute. That
bound is deliberate — the collaboration server records activity at the granularity of a keystroke,
and a list of every few keystrokes is not a history anyone can read.

Changes are merged **regardless of who made them**. A version is a moment in the document, not a
moment in one person's editing, so two people typing in the same minute produce one version and not
two interleaved ones. The collaboration server only ever groups changes by the same author, so this
last step happens in the browser, on top of its grouping.

With one exception: **a migrated document's imported history is never grouped.** Before the
migration the editor saved the whole document once a minute, and the migration replays each of
those saves at its original timestamp, attributed to `system`. Grouped like ordinary editing they
would land on the granularity itself — a chain of entries a minute apart, merging or not depending
on how fast the network was on the day each was written, losing about a third of the chain. There
was no editing session to summarise here, only a record of saves that already happened, so they are
shown one for one. Both the collaboration server and the browser are told to leave them alone.

## Restoring a previous state

Selecting a version and restoring it asks the collaboration server to undo everything that happened
after it. **Any user who may edit a document may restore it**; a reader may not.

The restore is applied where the document lives, not in the tab that asked for it, so everyone with
the document open sees it arrive over their own connection like any other change. Nothing is
destroyed: the restore is itself a change, so the state it replaced stays in the history and can be
restored again.

It is bounded by the same date as everything else, and more strictly. Reads are trimmed silently to
what a user may see; a restore is *refused* if it reaches further back than that — so nobody can
undo work that predates their access, even by asking for it directly.
