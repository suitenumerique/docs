# docs-mcp: MCP server for Docs

`docs-mcp` is a remote [MCP](https://modelcontextprotocol.io) server that exposes three
tools — `search_documents`, `read_document`, `create_document` — backed by the Docs API.
It is an OAuth-protected resource server: it authenticates the caller with an access token from
your OIDC provider and forwards the caller's own token to Django, which stays the sole authority
on document permissions.

Nothing in the auth chain is tied to a specific identity provider: both `docs-mcp` and the Django
endpoints are configured through settings only. The development stack uses Keycloak
(`docker/auth/realm.json`) as a ready-made example, see
[Example: the development Keycloak realm](#example-the-development-keycloak-realm).

## Architecture

```text
MCP client (MCP Inspector, Claude Code, ...)
    |
    | 1. Authorization Code + PKCE against the OIDC provider, requesting scopes:
    |    openid docs:documents:search docs:documents:read docs:documents:create
    |    (+ any MCP_EXTRA_SCOPES, e.g. docs-mcp in dev)
    v
OIDC provider (dev: Keycloak, impress realm)
    |
    | 2. JWT access token identifying docs-mcp through MCP_AUDIENCE_CLAIM
    |    (dev: aud=docs-mcp, azp=docs-mcp-client)
    v
docs-mcp (TypeScript, Streamable HTTP, stateless)
    |
    | 3. Verifies the JWT locally (JWKS, iss, exp, audience claim), then forwards the *same*
    |    access token, unchanged, as a Bearer token
    |    (no token exchange; this server holds no credentials of its own)
    v
Django /api/v1.0/mcp/documents/* (core/mcp_api)
    |
    | 4. ResourceServerAuthentication (django-lasuite) introspects the token at the provider,
    |    checks its origin client is allow-listed (OIDC_RS_AUDIENCE_CLAIM in
    |    OIDC_RS_ALLOWED_AUDIENCES), resolves the Docs user by `sub`,
    |    DocumentViewSet's permissions/querysets decide
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

The bundled `docs-mcp` server is optional: the Django endpoints only rely on
`ResourceServerAuthentication` and `MCPResourceServerPermission`, so any other MCP server (or
client) forwarding a token that passes the `OIDC_RS_*` checks can use them.

## Files

- `src/backend/core/mcp_api/` — the three Django endpoints and their permission/serializer
  classes.
- `src/backend/impress/settings.py`, `env.d/development/common` — reused `OIDC_OP_*` /
  `OIDC_RS_*` resource server settings; `MCP_READ_CONTENT_MAX_CHARS`.
- `src/frontend/servers/mcp/` — the TypeScript server (Express + `@modelcontextprotocol/sdk`).
  Validates incoming tokens against the provider's JWKS (`src/auth/jwtVerifier.ts`) and forwards
  them to Django (`src/docsApiClient.ts`).
- `env.d/development/mcp`, `compose.yml` (`mcp-development` service) — how it runs locally.
- `docker/auth/realm.json` — the development Keycloak realm (clients and client scopes below).
- `Makefile` (`mcp-claude`/`mcp-codex`/`mcp-gemini`/`mcp-cursor` targets) — generate each
  client's local, gitignored config pinning `docs-mcp-client` on first run (see "Connecting
  other MCP clients" below).

## OIDC provider requirements

Any OpenID Connect provider works as long as it offers the following. Each item names the
setting(s) it maps to on the `docs-mcp` side (`MCP_*`) and on the Django side (`OIDC_*`).

1. **Discovery and signing keys.** An issuer URL, an OIDC discovery document
   (`/.well-known/openid-configuration`) and a JWKS endpoint (`MCP_OIDC_ISSUER`,
   `MCP_OIDC_DISCOVERY_URL`, `MCP_OIDC_JWKS_URL`; `OIDC_OP_URL` for Django). `docs-mcp`
   re-publishes the discovery document as its RFC 9728 protected resource metadata, so MCP
   clients find the authorization and token endpoints there. The provider must support the
   Authorization Code flow with PKCE (`S256`).
2. **JWT access tokens.** `docs-mcp` verifies tokens locally, so they must be JWTs signed with a
   key from the JWKS, carrying `iss`, `exp`, `sub` and a space-separated `scope` claim. Opaque
   access tokens are not supported by `docs-mcp` (see [Known limitations](#known-limitations)).
   Django does not have this constraint: it introspects the token in any case.
3. **A claim identifying `docs-mcp`.** So that a token minted for another application of the
   same provider is rejected, `docs-mcp` requires `MCP_AUDIENCE_CLAIM` to carry one of
   `MCP_ALLOWED_AUDIENCES`. Pick whichever the provider can emit:
   - `aud` (the default): the provider adds a dedicated audience to the token — an audience
     mapper (Keycloak, dev setup: `docs-mcp`), an API identifier, or this server's
     `MCP_RESOURCE_URL` if the provider honours RFC 8707 resource indicators (MCP clients send
     it as the `resource` parameter). If adding the audience needs an extra scope, list it in
     `MCP_EXTRA_SCOPES` so it's advertised to clients.
   - the origin client, for providers that cannot add a custom audience:
     `MCP_AUDIENCE_CLAIM=client_id` (RFC 9068) or `azp`, and
     `MCP_ALLOWED_AUDIENCES=<the MCP client's client_id>`.
4. **The Docs scopes.** `docs:documents:search`, `docs:documents:read` and
   `docs:documents:create` must be requestable and end up in the token's `scope` claim: each tool
   checks its own scope, and Django requires at least one of `OIDC_RS_SCOPES`.
5. **An OAuth client for MCP clients.** A public client (no secret, PKCE) whose `client_id` is
   either pre-registered and pinned in each MCP client (what the dev setup does), or obtained
   through Dynamic Client Registration if the provider supports it. Its redirect URIs must cover
   the MCP clients' local callbacks.
6. **Token introspection for Django.** A confidential client Django authenticates as
   (`OIDC_RS_CLIENT_ID`/`OIDC_RS_CLIENT_SECRET`) at the provider's introspection endpoint
   (`OIDC_OP_INTROSPECTION_ENDPOINT`). The introspection response must contain `active`, `iss`,
   `scope` and the claim named by `OIDC_RS_AUDIENCE_CLAIM` (default `client_id`), whose value
   must be in `OIDC_RS_ALLOWED_AUDIENCES` — typically the MCP client's `client_id`. Providers
   returning signed/encrypted JWT introspection responses (RFC 9701) are supported through
   `OIDC_RS_BACKEND_CLASS` and the `OIDC_RS_*` key settings, see
   [`resource_server.md`](./resource_server.md).
7. **Stable `sub`.** Django resolves the Docs user by the token's `sub`, so it must be the same
   subject Docs users log in with through `OIDC_OP_*`.

## Configuration

### docs-mcp (`src/frontend/servers/mcp`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `MCP_HOST` / `MCP_PORT` | `0.0.0.0` / `4455` | bind address for the Express server |
| `MCP_RESOURCE_URL` | required | this server's `/mcp` URL, used as the OAuth "resource" and in PRM metadata |
| `MCP_OIDC_ISSUER` | required | issuer as seen by clients/tokens (`iss` claim check), e.g. `http://localhost:8083/realms/impress` |
| `MCP_OIDC_JWKS_URL` / `MCP_OIDC_DISCOVERY_URL` | required | JWKS and discovery endpoints, as reachable from this server (`http://nginx:8083/...` in Docker) |
| `MCP_AUDIENCE_CLAIM` | `aud` | token claim that must identify this server: `aud`, or e.g. `client_id` / `azp` |
| `MCP_ALLOWED_AUDIENCES` | required | comma-separated values accepted for `MCP_AUDIENCE_CLAIM` (at least one; the check cannot be disabled) |
| `MCP_EXTRA_SCOPES` | empty | comma-separated scopes advertised in the protected resource metadata on top of the `docs:documents:*` ones |
| `DOCS_API_URL` | required | Django's base URL, where the caller's token is forwarded |

With `MCP_AUDIENCE_CLAIM=aud` the token's `aud` (a string or an array) must contain one of the
allowed values; with any other claim, that claim's value must be one of them.

This server holds no credentials: it only reads the provider's public JWKS to verify token
signatures and forwards the caller's token to Django. `MCP_OIDC_ISSUER` is split from the
`*_URL` variables because this server may reach the provider through a different hostname than
the one in the token's `iss` claim — in Docker, the internal `nginx` alias instead of the
externally-visible `localhost:8083` — the same split Django's own OIDC settings use
(`OIDC_OP_URL` vs `OIDC_OP_JWKS_ENDPOINT`).

These variables are `MCP_`-prefixed rather than bare `OIDC_*` on purpose: Django already reads a
large `OIDC_OP_*` / `OIDC_RS_*` family, and look-alike names with a different meaning (e.g.
`OIDC_AUDIENCE_CLAIM` next to `OIDC_RS_AUDIENCE_CLAIM`) would be easy to mix up in a deployment
sharing one configuration.

### Django (`src/backend`)

The MCP endpoints reuse the resource server settings, see
[`resource_server.md`](./resource_server.md) and [`env.md`](./env.md):

| Setting | Purpose for the MCP endpoints |
| --- | --- |
| `OIDC_OP_URL` | expected issuer of the introspected token |
| `OIDC_OP_INTROSPECTION_ENDPOINT` | where the forwarded token is introspected |
| `OIDC_RS_CLIENT_ID` / `OIDC_RS_CLIENT_SECRET` | confidential client Django introspects as |
| `OIDC_RS_SCOPES` | the token must carry at least one of them (`docs:documents:search,docs:documents:read,docs:documents:create`) |
| `OIDC_RS_AUDIENCE_CLAIM` | introspection claim naming the token's origin client (default `client_id`) |
| `OIDC_RS_ALLOWED_AUDIENCES` | accepted values for that claim (the MCP client's `client_id`) |

`OIDC_RS_*` in `impress/settings.py` is process-wide, shared with the (currently disabled)
`external_api` feature — there is only one resource-server identity per Django process.
`OIDC_RS_ALLOWED_AUDIENCES` is a list, so a deployment running both would add each integration's
client_id alongside the MCP client's, no code change needed. The MCP endpoints are mounted
regardless of `OIDC_RESOURCE_SERVER_ENABLED`, which only gates `external_api`.

## Example: the development Keycloak realm

The development stack ships a Keycloak realm with everything above declared in
`docker/auth/realm.json` — no manual Admin Console steps required. It maps onto the
requirements as follows:

1. **Client scopes**: `docs:documents:search`, `docs:documents:read`, `docs:documents:create`
   (plain) and `docs-mcp` (one `oidc-audience-mapper` adding the audience `docs-mcp`). All four
   are *optional* scopes on `docs-mcp-client` only, so the audience is added only when the
   client requests it — hence `MCP_AUDIENCE_CLAIM=aud`, `MCP_ALLOWED_AUDIENCES=docs-mcp` and
   `MCP_EXTRA_SCOPES=docs-mcp` in `env.d/development/mcp`.
2. **`docs-mcp-client`** (public): Authorization Code + PKCE (`S256`), no secret, no implicit
   flow, no direct grants. This is the client the MCP client authenticates the user as; the
   token it obtains is forwarded all the way to Django, where
   `OIDC_RS_ALLOWED_AUDIENCES=docs-mcp-client` allow-lists it.
3. **`docs-api`** (confidential): the client Django authenticates as when calling Keycloak's
   token introspection endpoint (`OIDC_RS_CLIENT_ID=docs-api`/`OIDC_RS_CLIENT_SECRET`). No
   mappers, no special attributes.

The audience mapper is a Keycloak feature. With a provider that can't add a custom audience,
drop the `docs-mcp` scope and allow-list the MCP client on the `docs-mcp` side as well, e.g.
`MCP_AUDIENCE_CLAIM=client_id` (or `azp`: Keycloak user access tokens carry `azp`, not
`client_id`) and `MCP_ALLOWED_AUDIENCES=docs-mcp-client`.

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

The dev realm does not expose Dynamic Client Registration (DCR) — `docker/auth/realm.json` only
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

- `docs-mcp` only accepts JWT access tokens (verified locally against the JWKS). Providers
  issuing opaque access tokens would need token introspection in `docs-mcp` too, which is not
  implemented; Django's side already works with them since it always introspects.
- No refresh-token handling in the MCP client flow; long sessions would need one.
- No JWKS caching beyond `jose`'s in-memory default, no retry/backoff on the OIDC provider or
  Django calls, no rate limiting beyond Django's existing `DocumentThrottle`.
- Stateless mode means every request pays the cost of a new `McpServer`/transport instance —
  not tuned for high throughput.
- No dynamic client registration in the dev realm: only pre-registered clients
  (`docs-mcp-client`) can connect. A production deployment needs a considered DCR policy or a
  small fleet of statically registered clients.
- No structured logging/metrics/tracing beyond what Express/Django already provide by default.
- The forwarded token is only audience-narrowed once (its origin `client_id` must be
  allow-listed). An Authorization Server supporting RFC 8693 token exchange could mint a
  Django-specific, shorter-lived token instead, at the cost of a provider-specific grant and a
  confidential client in the MCP server.
