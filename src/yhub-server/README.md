# yhub-server

This directory contains the La Suite Docs-specific configuration for
[yhub](https://www.npmjs.com/package/@y/hub) (`@y/hub`), the collaboration
server that synchronizes Yjs documents between editors in real time.

It is not a fork of yhub — it is a thin wrapper (`server.js`) that:

- starts a yhub instance (websocket sync on port 3002, backed by Redis/Valkey
  and PostgreSQL),
- plugs in an auth plugin that resolves users and per-document access rights
  by calling the Docs Django backend (`/api/v1.0/users/me/` and
  `/api/v1.0/documents/{id}/`),
- serves every route under the `/collaboration/` prefix
  (`server.apiPrefix`), including the websocket sync route
  `/collaboration/ws/v1/{org}/{docid}`,
- exposes `POST /collaboration/reset-connections/v1/{org}/{docid}` (optional
  `X-User-Id` header), for the Django backend to re-check the authorization
  of a document's connected clients when permissions change (backend wiring
  pending) — authenticated with an RS256 admin JWT issued by Django and
  verified against its JWKS (`/api/v1.0/jwks`); the `reset-connections`
  purpose is granted only to that admin token, never to regular users,
- mirrors the environment conventions used elsewhere in this repository
  (`*_FILE` secret indirection, `COLLABORATION_SERVER_ORIGIN` allowlist, …).

Public exposure: route the whole `/collaboration/` prefix to this server —
the websocket and the built-in document APIs (`ydoc`, `rollback`, `prune`,
`changeset`, `activity`) are all guarded by the same cookie-based document
authorization and are meant to be reachable by browsers. The one exception
is `/collaboration/reset-connections/`, which is backend-internal and should
not be routed through the public ingress.

The `Dockerfile` builds the container image used by the `yhub` service in
`compose.yml`.

## ⚠️ License warning (AGPL)

This directory depends on `@y/hub`, which is licensed under the
**GNU AGPL-3.0** (or a separate proprietary license from its author). Unlike
the rest of this repository (MIT), the code in this directory is loaded into
the same process as AGPL-licensed code. As a consequence:

- **Any modification to the code in this directory (in particular
  `server.js`) must be released under an AGPL-compatible license** if you run
  or distribute the resulting server, including making it available to users
  over a network (AGPL section 13).
- See the [LICENSE](./LICENSE) file in this directory for details.

**The rest of La Suite Docs is not affected.** The Django backend and the
frontend never link against yhub; they communicate with it exclusively
through network requests (REST/HTTP and WebSocket). They remain under the
MIT license of the repository root.
