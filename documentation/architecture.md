# Architecture

## Overview

Docs is a set of small services around one rule: **Django owns who may do what,
and the collaboration server owns what a document says**. Every other service is
either a client of those two or a converter they call.

- The **backend** (Django) holds documents, users, accesses, invitations and
  attachments metadata. It is the only service that decides whether a caller may
  read or write a document, and every other service asks it rather than deciding
  on its own.
- **yhub** holds the live Yjs state of the documents. Browsers connect to it over
  a websocket and edit together; it persists the merged state in a store of its
  own. The backend reads and writes that state through yhub's REST API — never
  directly in its database.
- The **frontend** is a Next.js application exported to static files. In
  production it is served by Nginx, with no Node.js runtime.
- **y-provider** and **Docspec** are stateless converters. They store nothing and
  own nothing.

Nothing long-lived is shared between the services: they authenticate to each
other with short-lived RS256 JWTs, each verified against the JWKS the other
publishes.

## The services at a glance

| Service | Stack | Owns | Talks to |
| --- | --- | --- | --- |
| Frontend | Next.js, BlockNote, static export served by Nginx | nothing | the browser only |
| Backend | Django, DRF | documents, users, accesses, attachments | PostgreSQL, Redis, S3, yhub, y-provider, Docspec, OIDC, LLM, search |
| Celery worker | Celery | nothing | PostgreSQL, Redis, yhub, SMTP, search |
| yhub server | `@y/hub`, Node | the live document content | Valkey, its PostgreSQL, the backend, S3 |
| yhub worker | `@y/hub`, Node | — | Valkey, its PostgreSQL, optional S3 |
| y-provider | Express, BlockNote server-util | nothing | the backend (JWKS only) |
| Docspec | external image | nothing | nothing |

## Global service map

<!-- diagram: architecture-services -->
```mermaid
flowchart LR

  subgraph clients["Clients"]
    direction TB
    BROWSER["<b>Browser</b><br/>Next.js SPA · BlockNote<br/>+ service worker (offline)"]
    EXTAPP["<b>Third-party app</b><br/>resource-server client"]
  end

  subgraph edge["Edge"]
    INGRESS["<b>Ingress / Nginx</b><br/>TLS · routing · media auth"]
  end

  subgraph app["Application services"]
    direction TB
    FRONT["<b>Frontend</b><br/>Next.js static build"]
    BACK["<b>Backend</b><br/>Django · DRF"]
    CELERY["<b>Celery worker</b>"]
    subgraph collab["Collaboration"]
      direction TB
      YHUB["<b>yhub server</b><br/>WebSocket + REST"]
      YWORKER["<b>yhub worker</b>"]
    end
    subgraph conv["Conversion"]
      direction TB
      YPROV["<b>y-provider</b><br/>Yjs to md / HTML / JSON"]
      DOCSPEC["<b>Docspec</b><br/>.docx import"]
    end
  end

  subgraph stores["Data stores"]
    direction TB
    PG[("PostgreSQL<br/>docs · users · rights")]
    REDIS[("Redis<br/>broker · cache")]
    S3[("S3 / MinIO<br/>attachments · versions")]
    VALKEY[("Valkey<br/>update stream")]
    YPG[("PostgreSQL <i>yhub</i><br/>Yjs state")]
    YS3[("S3 <i>yhub</i><br/>optional")]
  end

  subgraph ext["External services"]
    direction TB
    OIDC["OIDC provider<br/>Keycloak · ProConnect"]
    LLM["LLM provider<br/>OpenAI · Mistral"]
    SEARCH["Search / indexing"]
    SMTP["SMTP relay"]
    AV["Malware detection"]
    OBS["Langfuse · Sentry · PostHog"]
  end

  %% clients to edge
  BROWSER ==>|"HTTPS · WSS"| INGRESS
  EXTAPP -->|"bearer token"| INGRESS
  BROWSER -.->|"login"| OIDC

  %% edge to services
  INGRESS -->|"/"| FRONT
  INGRESS ==>|"/api/v1.0/"| BACK
  INGRESS ==>|"/collaboration/"| YHUB
  INGRESS -->|"/media/ after auth check"| S3
  INGRESS -.->|"auth_request"| BACK
  INGRESS -->|"/external_api/v1.0/"| BACK

  %% backend
  BACK --> PG
  BACK --> S3
  BACK --> REDIS
  REDIS --> CELERY
  CELERY --> PG
  BACK <-.->|"OIDC"| OIDC
  BACK -->|"AI features"| LLM
  BACK -->|"query"| SEARCH
  CELERY -->|"index"| SEARCH
  CELERY -->|"mail"| SMTP
  BACK <-.->|"scan · callback"| AV
  BACK -.-> OBS

  %% backend and collaboration
  BACK <==>|"document lifecycle<br/>+ auth callbacks"| YHUB
  CELERY -->|"cascade sync"| YHUB

  %% conversion
  BACK -->|"convert"| YPROV
  BACK -->|"import .docx"| DOCSPEC
  YPROV -.->|"JWKS"| BACK

  %% collaboration internals
  YHUB --> VALKEY
  VALKEY --> YWORKER
  YWORKER --> YPG
  YHUB --> YPG
  YWORKER -.-> YS3
  YHUB -.->|"legacy content"| S3

  classDef client fill:#e8f0fe,stroke:#3b6fd4,color:#12244a
  classDef service fill:#e6f7ed,stroke:#2f9e5f,color:#0f3d24
  classDef store fill:#fff4e0,stroke:#d99a19,color:#4a3410
  classDef external fill:#f3ecfc,stroke:#8256c4,color:#2e1a4d
  classDef edgeNode fill:#fdeaea,stroke:#cf4747,color:#4a1414

  class BROWSER,EXTAPP client
  class FRONT,BACK,CELERY,YHUB,YWORKER,YPROV,DOCSPEC service
  class PG,REDIS,S3,VALKEY,YPG,YS3 store
  class OIDC,LLM,SEARCH,SMTP,AV,OBS external
  class INGRESS edgeNode

  style clients fill:#fbfcff,stroke:#c7d4ec
  style edge fill:#fffafa,stroke:#eccaca
  style app fill:#fafdfb,stroke:#c9e3d4
  style collab fill:#f0faf4,stroke:#a9d6bd
  style conv fill:#f0faf4,stroke:#a9d6bd
  style stores fill:#fffdf8,stroke:#ecd9b0
  style ext fill:#fdfbff,stroke:#d9c9ee
```

## Request routing

One hostname is enough. The reverse proxy dispatches on the path:

| Path | Goes to | Notes |
| --- | --- | --- |
| `/` | frontend | static assets, client-side routing |
| `/api/v1.0/` | backend | REST API, session cookie |
| `/external_api/v1.0/` | backend | resource server, OIDC bearer token |
| `/collaboration/ws/v1/…` | yhub | the websocket the editors open |
| `/collaboration/{ydoc,rollback,prune,changeset,activity,jwks}` | yhub | document APIs, guarded by the same document authorization |
| `/media/` | S3, after an `auth_request` to the backend | see [attachments](#attachments-and-protected-media) |

Four yhub routes are **backend-internal** and must not be published:
`reset-connections`, `migrate`, `restore-ydoc` and `reset-ydoc`. The two probes
(`ping`, `ready`) are called by the kubelet and stay in-cluster too. The helm
chart's ingress lists what it routes rather than what it hides, so they stay
private on their own.

## Collaboration

<!-- diagram: architecture-collaboration -->
```mermaid
flowchart TB

  EDITORS["<b>Editors</b><br/>one browser per participant"]
  BACK["<b>Django backend</b><br/>owns documents, users, access rights"]

  subgraph yhubbox["yhub — two halves sharing only the stores"]
    direction LR
    SRV["<b>server</b><br/>YHUB_ROLE=server | all<br/>websockets + /collaboration/ routes"]
    WRK["<b>worker</b><br/>YHUB_ROLE=worker | all<br/>merges updates, persists, trims"]
  end

  VALKEY[("<b>Valkey / Redis</b><br/>update stream · consumer group")]
  YPG[("<b>PostgreSQL</b> <i>yhub</i><br/>persisted Yjs state")]
  YS3[("<b>S3</b> <i>yhub</i><br/>optional blob store")]
  LEGACY[("<b>S3 media bucket</b><br/>legacy content + versions")]

  EDITORS <==>|"WSS /collaboration/ws/v1/:org/:docid"| SRV
  SRV -->|"auth + change callbacks"| BACK
  BACK -->|"document lifecycle API"| SRV

  SRV -->|"XADD"| VALKEY
  VALKEY -->|"XREADGROUP"| WRK
  VALKEY -->|"fan-out to the other replicas"| SRV
  SRV -->|"read on first sync"| YPG
  WRK -->|"merged state"| YPG
  WRK -.->|"when enabled"| YS3
  SRV -.->|"seed a room · replay history"| LEGACY
  BACK --> LEGACY

  classDef svc fill:#e6f7ed,stroke:#2f9e5f,color:#0f3d24
  classDef store fill:#fff4e0,stroke:#d99a19,color:#4a3410
  classDef client fill:#e8f0fe,stroke:#3b6fd4,color:#12244a
  class SRV,WRK,BACK svc
  class VALKEY,YPG,YS3,LEGACY store
  class EDITORS client
  style yhubbox fill:#f0faf4,stroke:#a9d6bd
```

yhub is **two halves that share the two stores and nothing else** — no
in-process state, no ordering between them:

- the **server** accepts the websockets, serves the routes, and writes every
  update to the Valkey stream;
- the **worker** claims tasks from that stream, merges the updates, stores the
  result and trims what it persisted.

`YHUB_ROLE` decides which half a process runs. Unset means both, which is the
default. Splitting them lets each scale on its own — servers with the connected
editors, workers with the write throughput — but they are split together or not
at all: servers alone accept edits and never persist them.

Consumer groups hand each task to exactly one worker, and replicas exchange
updates through the stream, so **no sticky routing is needed** on the websocket
ingress and any number of replicas can serve the same document.

yhub decides nothing about access. On every websocket upgrade it asks the
backend twice — `GET /api/v1.0/users/me/` for the identity behind the cookie,
then `GET /api/v1.0/documents/{id}/` for what that identity may do with this
document — and a backend that does not answer produces a retryable 503 rather
than a permission decision. When the persisted content changes, it calls
`POST /api/v1.0/documents/{id}/content-updated/` back, so that lists ordered by
`updated_at` follow the edits. That call is best effort: one the backend refuses
or never receives is logged and dropped.

Documents created before the migration still have their content in the S3 media
bucket. The first access to a room yhub does not know seeds it from there;
`POST /collaboration/migrate/…` replays a document's full version history out of
the same bucket.

See [collaboration.md](collaboration.md) for the configuration.

### Opening and editing a document

<!-- diagram: sequence-open-document -->
```mermaid
sequenceDiagram
  autonumber
  actor U as Browser
  participant N as Ingress / Nginx
  participant D as Django backend
  participant Y as yhub server
  participant V as Valkey
  participant W as yhub worker
  participant P as PostgreSQL yhub

  U->>N: GET /docs/:id
  N->>D: GET /api/v1.0/documents/:id/ (session cookie)
  D-->>U: metadata, abilities, link reach

  U->>N: WSS /collaboration/ws/v1/docs/:id
  N->>Y: upgrade, forwards cookie and origin
  Y->>D: GET /api/v1.0/users/me/
  D-->>Y: user id (or 401, then anonymous)
  Y->>D: GET /api/v1.0/documents/:id/
  D-->>Y: abilities, so read-only or read-write
  Note over Y: unknown room, seed it once<br/>from the legacy S3 content
  Y->>P: read the persisted state
  Y-->>U: initial sync

  loop while editing
    U->>Y: Yjs update
    Y->>V: XADD
    Y-->>U: broadcast to the other editors
  end

  V->>W: XREADGROUP, one task to one worker
  W->>P: merge and persist
  W->>V: trim what is stored
  Y->>D: POST /documents/:id/content-updated/ (yhub JWT)
  D->>D: bump updated_at, queue the search indexer
```

## Content is read through yhub, never around it

The backend never reads a document's content from its own database — it does not
have it. Anything needing the text goes through yhub's REST API with an admin
JWT:

| The backend wants to | It calls |
| --- | --- |
| create a document with initial content | `POST /collaboration/create-ydoc/v1/…` — a strict create, 409 if content already exists |
| read the content (export, search indexing, AI) | `GET /collaboration/ydoc/v1/…` |
| delete a document | `DELETE /collaboration/ydoc/v1/…` |
| restore a deleted one | `POST /collaboration/restore-ydoc/v1/…` |
| erase the content, keeping the room | `POST /collaboration/reset-ydoc/v1/…` |
| re-check the rights of connected clients | `POST /collaboration/reset-connections/v1/…` |
| replay the legacy history | `POST /collaboration/migrate/v1/…` |

Deletions and permission changes cascade: a document inherits the accesses of its
ancestors, so the Celery tasks walk the subtree and call the document-scoped
endpoint once per descendant. A document that fails is logged and does not stop
the ones after it.

## Conversion, import and export

<!-- diagram: sequence-conversion -->
```mermaid
sequenceDiagram
  autonumber
  actor U as Browser
  participant D as Django backend
  participant K as Docspec
  participant C as y-provider
  participant Y as yhub server

  rect rgb(240,247,255)
    Note over U,Y: importing a file
    U->>D: POST /documents/create-for-owner/ or import
    alt .docx
      D->>K: POST /conversion
      K-->>D: BlockNote blocks
    else markdown
      Note over D: kept as is
    end
    D->>C: POST /api/convert/ (admin JWT)
    C-->>D: Yjs update, binary
    D->>Y: POST /collaboration/create-ydoc/v1/docs/:id
    Y-->>D: 201, or 409 if the document already has content
  end

  rect rgb(245,255,248)
    Note over U,Y: exporting or reading the content
    U->>D: GET /documents/:id/formatted-content/?content_format=markdown
    D->>Y: GET /collaboration/ydoc/v1/docs/:id
    Y-->>D: current state, the source of truth
    D->>C: POST /api/convert/ Yjs to markdown
    C-->>D: markdown
    D-->>U: converted content
  end
```

**y-provider** is the only service that understands both a Yjs update and the
BlockNote schema, so every conversion in either direction goes through it. It
used to serve the websockets as well, which is why it could be deployed twice;
the collaboration is served by yhub now and the conversion is all that is left.

**Docspec** turns `.docx` into modern editable content. It is optional
(`CONVERSION_UPLOAD_ENABLED`), it exposes a public API with no authentication of
its own, and should therefore be deployed on a private network.

See [format_conversion.md](format_conversion.md).

## Attachments and protected media

<!-- diagram: sequence-attachment -->
```mermaid
sequenceDiagram
  autonumber
  actor U as Browser
  participant N as Ingress / Nginx
  participant D as Django backend
  participant S as S3 / MinIO
  participant C as Celery worker
  participant A as Malware scanner

  rect rgb(240,247,255)
    Note over U,A: upload
    U->>D: POST /documents/:id/attachment-upload/
    D->>D: check write access, size, mime type
    D->>S: PUT object, status=processing
    D->>C: queue the scan
    C->>A: scan the object
    A-->>D: callback, safe or infected
    D->>S: metadata status=ready, or delete
    D-->>U: media url
  end

  rect rgb(245,255,248)
    Note over U,S: read
    U->>N: GET /media/:key
    N->>D: auth_request /documents/media-auth/<br/>X-Original-URL
    D->>D: resolve the document, check read access
    D-->>N: 200 + Authorization, X-Amz-Date, X-Amz-Content-SHA256
    N->>S: GET the object with those signed headers
    S-->>U: file, with Content-Security-Policy default-src none
  end
```

Attachments are never served straight from the bucket. Every `/media/` request
goes through an Nginx `auth_request` sub-request to the backend, which resolves
the object key back to its document, checks the caller's read access, and answers
with the S3 headers signing that single object. Nginx then proxies the object
with those headers. The bucket needs no public access, and a leaked url grants
nothing.

The sub-request is on the hot path of every image in a document, so a slow
backend shows up here first — the reason the readiness probe and the database
pool sizing matter more than their traffic suggests.

## Service-to-service trust

<!-- diagram: architecture-trust -->
```mermaid
flowchart LR

  BACK["<b>Django backend</b><br/>signs with JWT_PRIVATE_KEY<br/>publishes /api/v1.0/jwks"]
  YHUB["<b>yhub</b><br/>signs with YHUB_JWT_PRIVATE_KEY<br/>publishes /collaboration/jwks/v1"]
  YPROV["<b>y-provider</b><br/>verifies only, signs nothing"]
  RS["<b>Resource server</b><br/>same Django process<br/>publishes /external_api/v1.0/jwks"]
  OIDC["<b>OIDC provider</b>"]

  BACK ==>|"admin JWT · RS256 · aud yhub · short lived"| YHUB
  YHUB -.->|"fetches the backend JWKS to verify it"| BACK
  YHUB ==>|"callback JWT · RS256 · aud docs-backend · 1 min"| BACK
  BACK -.->|"fetches the yhub JWKS to verify it"| YHUB
  BACK ==>|"admin JWT · RS256"| YPROV
  YPROV -.->|"fetches the backend JWKS to verify it"| BACK
  OIDC -.->|"introspection · declared JWKS"| RS
  RS --- BACK

  NOTE["No shared secret in either direction.<br/>Each side holds only its own private key<br/>and can roll it without touching the other:<br/>keys are picked by <i>kid</i> and the set is re-fetched<br/>whenever an unknown one shows up."]

  classDef svc fill:#e6f7ed,stroke:#2f9e5f,color:#0f3d24
  classDef external fill:#f3ecfc,stroke:#8256c4,color:#2e1a4d
  classDef note fill:#fffdf5,stroke:#d9c9a0,color:#4a3410
  class BACK,YHUB,YPROV,RS svc
  class OIDC external
  class NOTE note
```

Both directions between the backend and yhub are authenticated with short-lived
RS256 JWTs, and each side verifies the other against the JWKS it publishes. Both
need a signing key of their own, and neither needs a copy of the other's — so
rolling one needs no change on the other side. The helm chart can generate both
keys into a secret every service mounts read-only (`jwtKeys.enabled`).

Two other credentials exist and are *not* part of that scheme:

- `Y_PROVIDER_API_KEY`, sent by yhub as `X-Y-Provider-Key` on its authorization
  calls. It only exempts them from the API throttling — it authenticates nothing.
- `SERVER_TO_SERVER_API_TOKENS`, a list of bearer tokens accepted on
  `create-for-owner`, for trusted services creating a document on a user's behalf.

## Authentication of the users

The frontend redirects to the OIDC provider (Keycloak in development, ProConnect
in production, any compliant provider elsewhere); the backend is the relying
party and keeps the session in a cookie. That cookie is what the browser sends to
the API *and* what yhub forwards to the backend when authorizing a websocket.

Docs is also a **resource server**: with `OIDC_RESOURCE_SERVER_ENABLED`, another
application can call `/external_api/v1.0/` with an OIDC access token, on the
routes and actions the `EXTERNAL_API` setting allows. See
[resource_server.md](resource_server.md).

## Asynchronous work

Celery runs on the same Redis instance the backend caches and stores sessions in,
on a database of its own. It carries what must not
block a request: invitation and access-request emails, the search indexing, the
user reconciliation import, the malware scan callbacks, and the cascade calls to
yhub when a document is deleted, restored, or has its accesses changed. There is
no beat scheduler — periodic work is deployed as Kubernetes CronJobs
(`backend.cronjobs` in the chart).

## Optional and external services

| Service | Enabled by | Used for |
| --- | --- | --- |
| Search / indexing | `SEARCH_INDEXER_CLASS`, `INDEXING_URL`, `SEARCH_URL` | full-text search across documents, fed by Celery |
| LLM provider | `AI_FEATURE_ENABLED` + OpenAI-compatible or Mistral credentials | rewrite, summarize, translate, fix typos |
| Langfuse | `LANGFUSE_*` | tracing the LLM calls |
| Malware detection | `MALWARE_DETECTION` backend | scanning uploaded attachments |
| Docspec | `CONVERSION_UPLOAD_ENABLED`, `DOCSPEC_API_URL` | `.docx` import |
| yhub S3 persistence | `YHUB_S3_PERSISTENCE` | document blobs in a bucket instead of PostgreSQL |
| Sentry, PostHog | `SENTRY_DSN`, `POSTHOG_KEY` | errors and product analytics |

## Data stores

| Store | Holds | Lost if deleted |
| --- | --- | --- |
| PostgreSQL (Django) | documents, users, accesses, invitations | everything but the document text |
| Redis | Celery broker, cache, sessions | in-flight tasks, and every session — users are logged out |
| S3 / MinIO | attachments, legacy content and its version history | attachments, version history |
| Valkey / Redis (yhub) | the update stream not yet persisted | the last seconds of edits — hence `appendonly` |
| PostgreSQL (yhub) | the persisted Yjs state | the documents' text |
| S3 (yhub, optional) | the same state as blobs | the documents' text |

yhub's schema is never created at startup — the server runs no DDL. Run its init
script once before starting it, and again after every upgrade that adds a table;
the helm chart runs it as a job.

## Regenerating the diagrams

The diagrams above are the source. `documentation/assets/diagrams/render.sh`
extracts each one into a standalone `.mmd` file and renders it to PNG and SVG in
the same directory:

```bash
./documentation/assets/diagrams/render.sh
```

## Architecture decision records

- [ADR-0001-20250106-use-yjs-for-docs-editing](./adr/ADR-0001-20250106-use-yjs-for-docs-editing.md)
