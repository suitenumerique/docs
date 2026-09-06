# docs-mcp: MCP server for Docs

`docs-mcp` is a remote [MCP](https://modelcontextprotocol.io) server that exposes three
tools — `search_documents`, `read_document`, `create_document` — backed by the Docs API.
It is an OAuth-protected resource server: it authenticates the caller via Keycloak and forwards
the caller's own token to Django, which stays the sole authority on document permissions.

## Architecture

```text
MCP client (MCP Inspector, Claude Code, ...)
    |
    | 1. Authorization Code + PKCE, requesting scopes:
    |    openid docs:documents:search docs:documents:read docs:documents:create docs-mcp
    v
Keycloak (impress realm)
    |
    | 2. Access token, aud=docs-mcp (only because the docs-mcp scope was requested),
    |    azp=docs-mcp-client
    v
docs-mcp (TypeScript, Streamable HTTP, stateless)
    |
    | 3. Forwards the *same* access token, unchanged, as a Bearer token
    |    (no token exchange; this server holds no credentials of its own)
    v
Django /api/v1.0/mcp/documents/* (core/mcp_api)
    |
    | 4. ResourceServerAuthentication (django-lasuite) introspects the token at Keycloak,
    |    checks its origin client is allow-listed (OIDC_RS_ALLOWED_AUDIENCES=docs-mcp-client),
    |    resolves the Docs user by `sub`, DocumentViewSet's permissions/querysets decide
    v
PostgreSQL
```

Steps 3-4 are the same resource-server pattern the (separate, currently disabled)
`external_api` feature uses: the MCP server forwards the caller's own token and Django
introspects it, no token exchange. `core/mcp_api` reuses the same `ResourceServerAuthentication`
backend, `DocumentPermission` class, and `DocumentViewSet.get_queryset`/`get_object` logic — see
[`resource_server.md`](./resource_server.md). Reading a document's content reuses the existing
`core.services.converter_services.Converter` client that talks to the `y-provider` service to
turn Yjs into Markdown.

There is deliberately no RFC 8693 (Token Exchange) step: local JWT validation
(RFC 9068 + JWKS, RFC 7517) plus plain token forwarding (RFC 6750) needs no client secret, so
this server holds no credentials of its own.

## Files

- `docker/auth/realm.json` — Keycloak clients (`docs-mcp-client` public, `docs-api`
  confidential/introspection) and client scopes (`docs:documents:search`,
  `docs:documents:read`, `docs:documents:create`, `docs-mcp`).
- `src/backend/core/mcp_api/` — the three Django endpoints and their permission/serializer
  classes.
- `src/backend/impress/settings.py`, `env.d/development/common` — reused `OIDC_RS_*` resource
  server settings (`OIDC_RS_CLIENT_ID=docs-api` for introspection,
  `OIDC_RS_ALLOWED_AUDIENCES=docs-mcp-client`); `MCP_READ_CONTENT_MAX_CHARS`.
- `src/frontend/servers/mcp/` — the TypeScript server (Express + `@modelcontextprotocol/sdk`).
  Validates incoming tokens against Keycloak's JWKS (`src/auth/jwtVerifier.ts`) and forwards
  them to Django (`src/docsApiClient.ts`).
- `env.d/development/mcp`, `compose.yml` (`mcp-development` service) — how it runs locally.
- `Makefile` (`mcp-claude`/`mcp-codex`/`mcp-gemini`/`mcp-cursor` targets) — generate each
  client's local, gitignored config pinning `docs-mcp-client` on first run (see "Connecting
  other MCP clients" below).

## Environment variables (`src/frontend/servers/mcp`)

| Variable | Purpose |
| --- | --- |
| `MCP_HOST` / `MCP_PORT` | bind address for the Express server |
| `MCP_RESOURCE_URL` | this server's `/mcp` URL, used as the OAuth "resource" and in PRM metadata |
| `KEYCLOAK_ISSUER` | issuer as seen by clients/tokens (`iss` claim check), e.g. `http://localhost:8083/realms/impress` |
| `KEYCLOAK_JWKS_URL` / `KEYCLOAK_DISCOVERY_URL` | JWKS and discovery endpoints, reachable from inside Docker (`http://nginx:8083/...`) |
| `DOCS_API_URL` | Django's base URL, where the caller's token is forwarded |
| `MCP_AUDIENCE` | audience this server requires on incoming tokens (`docs-mcp`) |

This server holds no credentials: it only reads Keycloak's public JWKS to verify token
signatures and forwards the caller's token to Django. `KEYCLOAK_ISSUER` is split from the
`*_URL` variables because, in Docker, this server reaches Keycloak through the internal `nginx`
alias, while the token's `iss` claim (and the metadata shown to external clients) must use the
externally-visible `localhost:8083` hostname — the same split Django's own OIDC settings use
(`OIDC_OP_URL` vs `OIDC_OP_JWKS_ENDPOINT`).

## Keycloak configuration

All of it is declared in `docker/auth/realm.json` — no manual Admin Console steps required.
There is no token exchange, so there are only two clients:

1. **Client scopes**: `docs:documents:search`, `docs:documents:read`, `docs:documents:create`
   (plain) and `docs-mcp` (one `oidc-audience-mapper` adding the audience `docs-mcp`). All four
   are *optional* scopes on `docs-mcp-client` only, so the audience is added only when the
   client requests it.
2. **`docs-mcp-client`** (public): Authorization Code + PKCE (`S256`), no secret, no implicit
   flow, no direct grants. This is the client the MCP client authenticates the user as; the
   token it obtains is forwarded all the way to Django.
3. **`docs-api`** (confidential): the client Django authenticates as when calling Keycloak's
   token introspection endpoint (`OIDC_RS_CLIENT_ID`/`OIDC_RS_CLIENT_SECRET`). No mappers, no
   special attributes.

Django trusts the forwarded token only after `ResourceServerAuthentication` introspects it at
Keycloak on every call, checking it's `active`, its `iss` matches `OIDC_OP_URL`, it carries an
`OIDC_RS_SCOPES` scope, and its origin client (`OIDC_RS_AUDIENCE_CLAIM`, default `client_id`) is
in `OIDC_RS_ALLOWED_AUDIENCES` (`docs-mcp-client`). A token minted for another client, or
missing the MCP scopes, cannot reach these endpoints.

`OIDC_RS_*` in `impress/settings.py` is process-wide, shared with the (currently disabled)
`external_api` feature — there is only one resource-server identity per Django process.
`OIDC_RS_ALLOWED_AUDIENCES` is a list, so a deployment running both would add each integration's
client_id alongside `docs-mcp-client`, no code change needed.

If you edit `realm.json` and want Keycloak to run exactly what the file says, drop and recreate
it (imports are additive on an existing realm, not a full reset):

```bash
docker compose stop keycloak kc_postgresql
docker compose rm -f keycloak kc_postgresql
docker compose up -d keycloak
```

Two Keycloak-specific import pitfalls: client `description` fields are capped at 255 characters
(a longer value crashes the *entire* import), and `ProtocolMapperRepresentation` entries don't
accept a `description` field at all.

The MCP Inspector requests the `offline_access` scope unconditionally, which requires the
authenticating user to hold the realm's `offline_access` role — grant it once per user via
Admin Console → Users → *user* → Role mapping → Assign role → `offline_access`. This is an
Inspector quirk, not something `docs-mcp` itself requires.

## Running it

`docs-mcp` is one of the services `make bootstrap` / `make run` start (see the `mcp-development`
service in `compose.yml` and the `build-mcp` / `run-backend` targets in the `Makefile`). To
build or restart it on its own:

```bash
make build-mcp
docker compose up -d mcp-development
```

- Django: `http://localhost:8071`
- Keycloak: `http://localhost:8083` (realm `impress`)
- docs-mcp: `http://localhost:4455/mcp`, health check at `http://localhost:4455/healthz`

## Testing the tools

### With the MCP Inspector

```bash
cd src/frontend/servers/mcp
yarn mcp-inspector
```

This points the Inspector at `http://localhost:4455/mcp` over Streamable HTTP and pre-fills the
static OAuth client (`docs-mcp-client`, no secret, scopes `openid docs:documents:search
docs:documents:read docs:documents:create docs-mcp`). To configure it manually instead (e.g.
against a different URL), run `npx @modelcontextprotocol/inspector` with no arguments and fill
in the same values by hand in the OAuth Settings section before connecting — Dynamic Client
Registration is not
configured on this realm.

1. Open the Inspector UI (`http://localhost:6274` by default), set transport to **Streamable
   HTTP**, URL to `http://localhost:4455/mcp`, connect.
2. Log in as `impress` / `impress` (or a `user-e2e-*` account, after granting `offline_access`
   as above). Accept the scopes on Keycloak's consent screen.
3. **List Tools** should show the three tools with their Zod-derived JSON schemas.
4. Call `search_documents` with `{"query": "onboarding"}`, `read_document` with an accessible
   document `id`, and `create_document` with `{"title": "Test", "content": "# Hello"}`.
5. Log in as a different user and call `read_document` on the first document — expect the tool
   call to fail (Django's `DocumentPermission` denies it, surfaced as an error result).

### Connecting other MCP clients

This realm does not expose Dynamic Client Registration (DCR) — `docker/auth/realm.json` only
declares `docs-mcp-client` statically. Clients that support pinning a static `client_id` (no
DCR, no client secret needed since it's a public client) can still connect. A `make` target generates each client's config on first run and launches it:

| Client | Config | Makefile target |
| --- | --- | --- |
| Claude Code | `.mcp.json` | `make mcp-claude` |
| Codex CLI | `.codex/config.toml` | `make mcp-codex` |
| Gemini CLI | `.gemini/settings.json` | `make mcp-gemini` |
| Cursor | `.cursor/mcp.json` | `make mcp-cursor` |

Each config pins `docs-mcp-client` as the OAuth client and a fixed local callback port/URL
(`8090` for Claude Code, `8091` for Codex CLI, `8092` for Gemini CLI, Cursor's own fixed
`8787`). `docs-mcp-client`'s `redirectUris` is `["*"]` in this dev realm, so none of these need
registering individually — don't carry that wildcard into a non-dev realm. None of these tools
authenticate automatically on launch — trigger the OAuth login once per client (Claude Code:
`/mcp` inside the session; Codex CLI: `codex mcp login docs-mcp`; Gemini CLI and Cursor: accept
the OAuth prompt on first tool call). Codex CLI additionally requires the project to be marked
as trusted before it reads `.codex/config.toml`.

These are external, fast-moving CLIs — if a `make mcp-*` target fails to connect, check that
tool's current MCP/OAuth flag names against its own docs before assuming the Keycloak side is
broken.

## Running the tests

```bash
# Django
docker compose exec app-dev pytest core/tests/mcp_api

# TypeScript
docker compose exec mcp-development yarn test
```

## Known limitations

- No refresh-token handling in the MCP client flow; long sessions would need one.
- No JWKS caching beyond `jose`'s in-memory default, no retry/backoff on Keycloak or Django
  calls, no rate limiting beyond Django's existing `DocumentThrottle`.
- Stateless mode means every request pays the cost of a new `McpServer`/transport instance —
  not tuned for high throughput.
- No dynamic client registration: only pre-registered clients (`docs-mcp-client`) can connect.
  A production deployment needs a considered DCR policy or a small fleet of statically
  registered clients.
- No structured logging/metrics/tracing beyond what Express/Django already provide by default.
- The forwarded token is only audience-narrowed once (its origin `client_id` must be
  allow-listed). An Authorization Server supporting RFC 8693 token exchange could mint a
  Django-specific, shorter-lived token instead, at the cost of a provider-specific grant and a
  confidential client in the MCP server.
