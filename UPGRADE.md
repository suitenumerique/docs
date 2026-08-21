# Upgrade

All instructions to upgrade this project from one release to the next will be
documented in this file. Upgrades must be run sequentially, meaning you should
not skip minor/major releases while upgrading (fix releases can be skipped).

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

For most upgrades, you just need to run the django migrations with
the following command inside your docker container:

`python manage.py migrate`

(Note : in your development environment, you can `make migrate`.)

## [Unreleased]

⚠️ This release replaces the collaboration server. The content of a document
does not live in the object storage anymore, it lives in that server, and the
`y-provider` that used to serve the websocket does not serve it. There is a new
service to deploy, a database to create for it, and the existing documents have
to be handed over to it: an instance that upgrades without doing so opens every
one of its documents **empty**. The entries below start with the steps of that
upgrade, in the order they are done, and end with the API changes.

- ⚠️ **A new service to deploy: the collaboration server**
  (`lasuite/impress-yhub`, listening on `3002`), which replaces the
  `y-provider` on everything under `/collaboration/`. It keeps the live state
  of the documents in Redis/Valkey and persists them to a PostgreSQL database
  of its own, so it needs both and there is nothing to default them to:

  ```yaml
  REDIS: redis://{redis-host}:6379/0
  POSTGRES: postgres://{user}:{password}@{postgres-host}:5432/yhub
  ```

  It also needs `COLLABORATION_BACKEND_BASE_URL`, the backend it asks about
  users and document access rights, and `COLLABORATION_SERVER_ORIGIN`, the
  origins allowed to open a websocket — the two the `y-provider` already had.
  Give it `Y_PROVIDER_API_KEY` as well, with the same value as the backend's:
  it is the header that exempts the collaboration server from the API
  throttling, and it calls the backend once per connection.

  `REDIS_PREFIX` (default `yhub`) namespaces its keys when the Redis instance
  is shared with something else, and `YHUB_ORG` (default `docs`) names the
  organization the documents live under — the backend and the server must
  agree on it, a room of any other organization is refused. In the helm chart
  everything is under the `yhub` values key, enabled by default, and
  `yhub.worker.enabled` splits it into a server deployment and a worker
  deployment that scale on their own. `src/yhub-server/README.md` documents the
  rest of what it reads.

- ⚠️ **Its schema is not created when it starts.** The server never runs DDL:
  run the script it ships, `npm run init-db` (`node
  node_modules/@y/hub/bin/init-db.js` in the image), once before starting it
  and again after every upgrade that adds a table. It creates the database when
  it is missing, and it is idempotent, so re-running it is always safe. The
  helm chart runs it as a job (`yhub.initDb`, on by default), next to the
  backend migrate job and retrying while the PostgreSQL server does not answer
  — nothing in the chart creates that server. Until it has run, every document
  read fails with a `relation "..." does not exist` error.

- ⚠️ **The existing documents have to be migrated into it.** Until now the
  content of a document was a file in the media bucket, at key
  `{document-id}/file`; the collaboration server starts out knowing none of
  them, and the frontend no longer seeds content of its own. Two steps, in this
  order:

  1. Turn `SOFT_MIGRATION=true` on the collaboration server **before letting
     anyone in**, and point it at the media bucket:
     `LEGACY_S3_ENDPOINT_URL` (no path), `LEGACY_S3_ACCESS_KEY_ID`,
     `LEGACY_S3_SECRET_ACCESS_KEY` (both with a `_FILE` variant),
     `LEGACY_S3_BUCKET_NAME` (defaults to `impress-media-storage`, the
     development name — production has to set it), and optionally
     `LEGACY_S3_REGION_NAME` and `LEGACY_S3_SIGNATURE_VERSION` (`s3v4` by
     default, `v4` for the providers wanting the other one; SigV2 is not
     available). Read-only, bucket-scoped credentials are enough, and on AWS
     they need `s3:ListBucket` beside `s3:GetObject` — without it a
     brand-new document reads as `403` instead of `404` and fails to open. A
     document is then seeded from its legacy snapshot the first time someone
     opens it. These are **not** the backend's `AWS_S3_*` settings: nothing
     here reads them, so a pod carrying both migrates out of the bucket named
     here and no other.
  2. Then backfill the corpus, which the lazy seeding never finishes on its own
     — a document nobody opens stays in S3 forever. `python manage.py
     migrate_documents` hands every document to the collaboration server, which
     replays its **full** S3 version history rather than its last snapshot, so
     `/documents/{id}/versions/` and the history the editor shows agree. It is
     bounded (`--concurrency`, `--rate`, `--limit`, `--created-before`),
     resumable and safe to re-run: what became of every document is recorded in
     the new `impress_document_migration` table, a document the server refused
     is left for a later `--retry-failed` run, and `--document-id` hands over a
     single one. `--dry-run` counts what a run would do.

  `SOFT_MIGRATION` may only be turned off once that backfill has covered the
  corpus. Turning it off earlier loses nothing — what is migrated stays
  migrated — but an unmigrated document then opens as an *empty* room over
  content that is alive in S3.

  Keep the media bucket, its objects and its versioning either way:
  `/documents/{id}/versions/` still serves the version history from there, and
  the full migration replays it.

- ⚠️ **The websocket url changed**, and so does what `/collaboration/` is
  routed to. The room is appended by the client, and the last segment of the
  base url is `YHUB_ORG`:

  ```yaml
  COLLABORATION_WS_URL: wss://{yourdocsdomain.tld}/collaboration/ws/v1/docs
  ```

  Both `/collaboration/` ingresses now point at the collaboration server. In
  the chart, `ingressCollaborationApi.path` (a single path) becomes
  `ingressCollaborationApi.paths` (a list, one ingress rule each), defaulting
  to `/collaboration/ydoc/` and `/collaboration/jwks/`. What is not listed
  stays in-cluster, which is how `create-ydoc`, `reset-connections`, `migrate`,
  `restore-ydoc` and `reset-ydoc` are kept unreachable: they are
  backend-internal, and publishing them would put document deletion and the
  legacy migration one request away from the internet. If you route
  `/collaboration/` by hand, publish the websocket, the browser-facing document
  routes (`ydoc`, `rollback`, `prune`, `changeset`, `activity`) and `jwks`, and
  keep those five in-cluster.

  The `nginx.ingress.kubernetes.io/upstream-hash-by: $arg_room` annotation is
  dropped from the websocket ingress, and should be dropped from yours: the
  replicas exchange updates through Redis, so a room no longer needs a sticky
  upstream, and the new urls carry no `room` query argument — hashing on it
  would pin every connection to a single pod.

- ⚠️ **The backend has to reach the collaboration server.**
  `YHUB_API_BASE_URL` is now required — creating a document, duplicating one,
  `formatted-content`, the search indexation and the deletions all go through
  it, and it is also where the backend reads the JWKS verifying the calls it
  receives:

  ```yaml
  YHUB_API_BASE_URL: http://{yhub-service}:443
  ```

  Prefer the internal service url, the routes the backend calls are not meant
  to be reachable from the outside. `YHUB_API_TIMEOUT` (30 seconds) and
  `YHUB_MIGRATION_TIMEOUT` (600 seconds, the replay of one document's whole
  history) bound those calls.

  `COLLABORATION_API_URL` is not read by the application anymore — it
  configured the safeguard removed below — and only the integration test suite
  still looks at it.

- ⚠️ **The backend needs an RSA private key of its own**: `JWT_PRIVATE_KEY`, or
  a file `JWT_PRIVATE_KEY_FILE` points at, which is easier since a PEM does not
  fit well in an environment variable:

  ```bash
  openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out private.pem
  ```

  It signs the short-lived tokens the backend presents to the collaboration
  server and to the conversion service, which verify them against the public
  half it publishes on `/api/v1.0/jwks` — so no secret is shared with either,
  and each token carries an `aud` claim naming the service it was issued for,
  so one cannot be replayed against the other. Without the key the backend
  cannot call either service at all. `JWT_TOKEN_LIFETIME` (3600 seconds) is
  both the `exp` horizon and how long an issued token is cached.

  The `y-provider` verifies the same way and only needs to reach the backend
  for it: `COLLABORATION_BACKEND_BASE_URL`, from which it derives
  `{base}/api/v1.0/jwks`, or `JWKS_URL` when that url is not the right one from
  where it runs. In a development environment, `make generate-secret-keys`
  creates the key in `data/jwt/`; on a cluster, `jwtKeys.enabled` makes the
  chart generate both keys in a secret the services mount read-only.

- ⚠️ The collaboration server now calls the backend on its own, to declare that
  a document was edited, and signs those calls: **it needs an RSA private key
  of its own**, which it had not before. Generate one and give it to the
  collaboration server in `YHUB_JWT_PRIVATE_KEY`, or in a file
  `YHUB_JWT_PRIVATE_KEY_FILE` points at:

  ```bash
  openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out yhub-private.pem
  ```

  There is nothing to configure on the backend side: it reads the public half
  from the JWKS the collaboration server publishes on `/collaboration/jwks/v1`,
  which it fetches over `YHUB_API_BASE_URL` — so the two only need to reach
  each other, and this key can be rolled without the backend being touched.
  Do not share the backend key (`JWT_PRIVATE_KEY`) with it: each service signs
  with a key of its own.

  Without this key the collaboration server keeps serving documents, and warns
  at startup that it will not notify the backend: the `updated_at` of a document
  then stops following the edits made in the editor, and the lists ordered by it
  drift out of date. In a development environment,
  `make generate-secret-keys` creates the key in `data/jwt/`.

- ⚠️ **`COLLABORATION_SERVER_SECRET` is gone**, on both sides: remove it from
  the backend and from the collaboration server, which authenticate each other
  with the signed tokens above. The safeguard it served — "while someone is
  connected to the websocket, the users who are not are read-only" — is gone
  with it, and the question it answered no longer arises: the content is saved
  through the websocket only, so an editor that cannot open one saves nothing
  instead of overwriting what the others wrote. Consequently
  `COLLABORATION_WS_NOT_CONNECTED_READ_ONLY` (and its misspelled
  `COLLABORATION_WS_NOT_CONNECTED_READY_ONLY` alias) and
  `NO_WEBSOCKET_CACHE_TIMEOUT` are no longer read, the write-only `websocket`
  field disappears from `PATCH /api/v1.0/documents/{document_id}/`, and
  `/api/v1.0/documents/{document_id}/can-edit/` is removed along with the
  `can_edit` ability in the document payload. The `get-connections` API of the
  `y-provider` is dropped for good with them, its only consumer was that
  mechanism.

- ⚠️ **The `y-provider` is the conversion service and nothing else** — its
  published image no longer serves `/collaboration/ws/`. In the chart,
  `yProvider.converter`, its deployment and its service are dropped: the
  `yProvider` release *is* the converter, so a deployment that had
  `yProvider.converter.enabled: true` loses the `-converter` suffix on the url
  the backend calls, and `yProvider.converter.*` values are now ignored, their
  `yProvider.*` counterparts taking over:

  ```yaml
  # before
  Y_PROVIDER_API_BASE_URL: http://impress-docs-y-provider-converter:443/api/
  # now
  Y_PROVIDER_API_BASE_URL: http://impress-docs-y-provider:443/api/
  ```

- The collaboration server can store the document blobs in a bucket instead of
  its own PostgreSQL database (`YHUB_S3_PERSISTENCE=true`, plus the
  `YHUB_S3_*` settings). It is off by default and nothing about this upgrade
  needs it. Read the "Document storage" section of `src/yhub-server/README.md`
  before enabling it: a document persisted that way cannot be read back once
  the setting is removed, and it is a third bucket, not the backend's
  `AWS_S3_*` nor the legacy one the migration reads.

- The endpoint `/api/v1.0/documents/{document_id}/content/`, added in 5.0.0, is
  removed, both its `GET` and its `PATCH`. The content of a document is now
  saved and served by the collaboration server, the editor exchanging it over
  the websocket, so nothing reads or writes it through the API anymore. If you
  integrate with Docs, stop calling this endpoint: the `content_patch` and
  `content_retrieve` abilities disappear from the document payload along with
  it. `/api/v1.0/documents/{document_id}/formatted-content/` is not affected.
  The `CONTENT_METADATA_CACHE_TIMEOUT` setting only tuned the cache of the
  removed `GET` and is no longer read, you can drop it from your configuration.
- The JWKS of the resource server moved from `/api/{version}/jwks` to
  `/external_api/{version}/jwks`, alongside the rest of the resource server
  endpoints. `/api/{version}/jwks` now publishes the public key validating the
  tokens Docs issues to call external services. If you enabled the resource
  server (`OIDC_RESOURCE_SERVER_ENABLED`), update the JWKS URI declared to your
  OIDC provider accordingly.

## [5.0.0] - 2026-04-30

We made several changes around document content management leading to several breaking changes in the API.

- The endpoint `/api/v1.0/documents/{document_id}/content/` has been renamed in `/api/v1.0/documents/{document_id}/formatted-content/`
- There is no more `content` attribute in the response of `/api/v1.0/documents/{document_id}/`, two new endpoints have been added to retrieve or update the document content.
- A new `GET /api/v1.0/documents/{document_id}/content/` endpoint has been implemented to fetch the document content ; this endpoint streams the whole content with a `text/plain` content-type response.
- A new `PATCH /api/v1.0/documents/{document_id}/content/` endpoint has been added to update the document content ; expected payload is:
```json
{
  "content": "document content in base64",
}
```

Other changes:

- The deprecated endpoint `/api/v1.0/documents/<document_id>/descendants` is removed. The search endpoint should be used instead.
- Upgrade docspec dependency to version >= 3.0.0
  The docspec service has changed since version 3.0.0, we ware now compatible with this version and not with version 2.x.x anymore
- It is now possible to use the Mistral SDK instead of the OpenAI for the AI features. If your provider is compatible with the mistral API, we encourage you to use it.
- `AI_API_KEY` settings is renamed in `OPENAI_SDK_API_KEY` and is only used to congiure the OpenAi sdk
- `AI_BASE_URL` settings is renamed in `OPENAI_SDK_BASE_URL` and is only used to congiure the OpenAi sdk

## [4.6.0] - 2026-02-27

- ⚠️ Some setup have changed to offer a bigger flexibility and consistency, overriding the favicon and logo are now from the theme configuration.
https://github.com/suitenumerique/docs/blob/f24b047a7cc146411412bf759b5b5248a45c3d99/src/backend/impress/configuration/theme/default.json#L129-L161


## [4.0.0] - 2025-11-26

- ⚠️ We updated `@gouvfr-lasuite/ui-kit` to `0.18.0`, so if you are customizing Docs with a css layer or with a custom template, you need to update your customization to follow the new design system structure.  
More information about the changes in the design system can be found here:
  - https://suitenumerique.github.io/cunningham/storybook/?path=/docs/migrating-from-v3-to-v4--docs
  - https://github.com/suitenumerique/docs/pull/1605
  - https://github.com/suitenumerique/docs/blob/main/docs/theming.md

- If you were using the `THEME_CUSTOMIZATION_FILE_PATH` and have overridden the header logo, you need to update your customization file to follow the new structure of the header, it is now: 
  ```json
  {
    ...,
    "header": {
      "icon": {
        "src": "your_logo_src",
        "width": "your_logo_width",
        "height": "your_logo_height"
      }
    }
  }
  ```


## [3.3.0] - 2025-05-22

⚠️ For some advanced features (ex: Export as PDF) Docs relies on XL packages from BlockNote. These are licenced under AGPL-3.0 and are not MIT compatible. You can perfectly use Docs without these packages by setting the environment variable `PUBLISH_AS_MIT` to true. That way you'll build an image of the application without the features that are not MIT compatible. Read the [environment variables documentation](/docs/env.md) for more information.

The footer is now configurable from a customization file. To override the default one, you can
use the `THEME_CUSTOMIZATION_FILE_PATH` environment variable to point to your customization file.
The customization file must be a JSON file and must follow the rules described in the
[theming documentation](docs/theming.md).

## [3.0.0] - 2025-03-28

We are not using the nginx auth request anymore to access the collaboration server (`yProvider`)
The authentication is now managed directly from the yProvider server. 
You must remove the annotation `nginx.ingress.kubernetes.io/auth-url` from the `ingressCollaborationWS`.

This means as well that the yProvider server must be able to access the Django server.
To do so, you must set the `COLLABORATION_BACKEND_BASE_URL` environment variable to the `yProvider`
service.

## [2.2.0] - 2025-02-10

- AI features are now limited to users who are authenticated. Before this release, even anonymous
  users who gained editor access on a document with link reach used to get AI feature.
  If you want anonymous users to keep access on AI features, you must now define the
  `AI_ALLOW_REACH_FROM` setting to "public".
