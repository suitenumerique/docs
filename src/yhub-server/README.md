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
- mirrors the environment conventions used elsewhere in this repository
  (`*_FILE` secret indirection, `COLLABORATION_SERVER_ORIGIN` allowlist, …).

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
