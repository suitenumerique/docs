# Agent Guidelines for Docs

This file contains guidelines for AI agents coding in this repository.

## Project Overview

**La Suite Docs** is a collaborative text editor built by DINUM (French government) and ZenDiS (German government). It features real-time editing, offline support, AI actions, and multi-format export (PDF/DOCX/ODT).

Repository: https://github.com/suitenumerique/docs

## Monorepo Structure

- `src/backend/` - Django REST API (Python 3.14+)
- `src/frontend/apps/impress/` - Main Next.js 15 application (TypeScript)
- `src/frontend/apps/e2e/` - Playwright E2E tests
- `src/frontend/packages/i18n/` - Shared i18n utilities
- `src/frontend/packages/eslint-plugin-docs/` - Custom ESLint plugin
- `src/frontend/servers/y-provider/` - Conversion service only (Express, `POST /api/convert/`). It no longer serves any websocket
- `src/yhub-server/` - Collaboration server: a thin TypeScript wrapper around `@y/hub` (websockets, REST routes, worker). It holds the content of the documents
- `src/mail/` - Email templates (MJML)
- `src/helm/` - Kubernetes/Helm deployment

## Development Commands

### Setup and Services

```bash
make bootstrap          # Full dev setup (build + migrate + demo + run)
make build              # Build all Docker containers
make run                # Start all services
make stop               # Stop services
make build-yhub         # Build the collaboration server (yhub) image
make migrate-yhub       # Create/upgrade the yhub database schema (`yarn init-db`), safe to re-run
make status             # Check running services
```

### Backend (Python/Django)

Tests run inside Docker containers. You must first build the backend image and ensure the `lasuite-network` Docker network exists before running tests.

```bash
make build-backend                     # Build the backend Docker image (required before first test run)
docker network create lasuite-network  # Create the external network (required once)
bin/pytest -n auto                     # Run all backend tests in parallel
bin/pytest -n auto path/to/test        # Run specific test file/directory
bin/pytest -n auto path/to/test.py::TestClass::test_method  # Run single test via docker compose
make lint                              # ruff format + ruff check + pylint
make lint-ruff-format                  # Format only
make lint-ruff-check                   # Lint only
make migrate                           # Run database migrations
make makemigrations                    # Create new migrations
make resetdb                           # Flush DB + create superuser (admin/admin)
```

### Frontend (TypeScript/Next.js)

```bash
# From src/frontend/apps/impress/:
yarn dev                # Development server (port 3000)
yarn build              # Production build (includes prettier + stylelint checks)
yarn lint               # TypeScript check + ESLint
yarn test               # Run Vitest tests
yarn prettier           # Format code
yarn stylelint          # Lint CSS

# From project root:
make frontend-lint      # Lint all frontend workspaces
make frontend-test      # Run frontend tests
```

### Collaboration server (yhub, TypeScript)

```bash
# From src/yhub-server/ (standalone package: its own package.json and yarn.lock,
# not a workspace of src/frontend):
yarn test               # Vitest unit tests (@y/hub is mocked, no store needed)
yarn typecheck          # tsc --noEmit
yarn lint               # ESLint
yarn build              # Compile to dist/
yarn init-db            # Create/upgrade the yhub postgres schema (what `make migrate-yhub` runs)
```

The container starts with `node --import ./dist/sentry.js dist/server.js`: keep the
`--import` when overriding the command. `src/yhub-server/README.md` is the reference
for everything this server does (permissions, roles, migration, storage, metrics).

### Mails

```bash
make mails-install      # Install dependencies
make mails-build        # Convert MJML to HTML + plaintext
```

### Helm/Kubernetes Deployment

```bash
make build-k8s-cluster       # Create local Kind cluster
make start-tilt             # Start Tilt for hot-reload
# From src/helm/: helmfile -n impress -e dev apply/destroy/diff
```

### Dev Service URLs

- Frontend: http://localhost:3000
- Backend API/Admin: http://localhost:8071
- Keycloak (auth): http://localhost:8083
- MinIO (S3): http://localhost:9000
- Collaboration server (yhub): http://localhost:3002 (websocket on `/collaboration/ws/v1/docs/{docid}`)
- yhub PostgreSQL: localhost:5433 (its own database, apart from the backend's on 15432)
- Mailcatcher: http://localhost:1081

## Architecture

### Backend

- **Framework**: Django + DRF, configured via `django-configurations` (`src/backend/impress/settings.py`)
- **Main app**: `src/backend/core/` (models, API viewsets, services, authentication)
- **API**: REST on `/api/v1.0/` with nested routes (e.g., `/documents/{id}/accesses/`)
- **Auth**: OIDC via `mozilla-django-oidc` (Keycloak in dev)
- **Background tasks**: Celery + Redis
- **Database**: PostgreSQL 16 with `django-treebeard` for document hierarchy
- **Storage**: S3-compatible (MinIO in dev) for attachments and media. **The content of a document is not stored by the backend anymore**: it lives in the collaboration server (yhub). `Document.content`, `save_content` and the S3 object versions are gone; `file_key` only survives as a pointer for the migration of legacy documents
- **Collaboration server client**: `core/services/yhub_services.py` (`YHubService`: `get_ydoc`, `create_ydoc`, `delete_ydoc`, `restore_ydoc`, `reset_ydoc`, `migrate`, `reset_connections`). It is called synchronously by document creation from a file, `duplicate`, `formatted-content`, and from Celery tasks for delete/restore/access changes. Mock it in tests (`CELERY_TASK_ALWAYS_EAGER=True` in the `Test` configuration, so tasks run inline)
- **Service-to-service auth**: short-lived RS256 JWTs with an `aud` claim, never a shared bearer token. The backend signs with `JWT_PRIVATE_KEY` (`core/services/jwt_services.py`) and publishes its keys on `/api/v1.0/jwks`; yhub signs with `YHUB_JWT_PRIVATE_KEY` and publishes `/collaboration/jwks/v1`. Dev keys are generated in `data/jwt/` by `make bootstrap`
- **Removed endpoints**: `documents/{id}/content/` (GET and PATCH), `documents/{id}/versions/`, `documents/{id}/can-edit/`. New ones: `documents/{id}/content-updated/` (called by yhub) and `documents/{id}/accesses/me/`. `documents/{id}/formatted-content/` now reads the content from yhub
- **Legacy documents**: `python manage.py migrate_documents` hands the S3 content of existing documents to yhub (resumable, idempotent); `SOFT_MIGRATION=true` on yhub seeds a document on first open. See `UPGRADE.md`
- **Search**: Full-text indexing via `manage.py index`
- **Load-test tooling**: `src/backend/loadtest/` is a separate Django application that mints sessions for existing users (`create_load_test_sessions`, `revoke_load_test_sessions`). It is only installed by the `LoadTest` configuration (`DJANGO_CONFIGURATION=LoadTest`, a subclass of `Production`); `LOAD_TEST_TOOLS_ENABLED` is `False` everywhere else, pinned in `Production`, and never read from the environment. Anything added for load tests goes there, not in `core`, and must stay off in `Production`

### Frontend

- **Editor**: BlockNote.js 0.46.x (Tiptap-based block editor)
- **Real-time**: Yjs with the plain `y-websocket` `WebsocketProvider` (`features/docs/doc-management/stores/useProviderStore.tsx`), and an HTTP polling fallback (`@y/yhub-http-fallback`) used while the websocket cannot be opened. Hocuspocus is gone
- **Offline**: documents are kept locally (`y-indexeddb`) and a service worker (`features/service-worker/`) caches pages and API answers and replays queued mutations when back online
- **Version history**: built from the activity API of yhub, not from the backend
- **State**: Zustand (broadcast store for cross-tab sync), TanStack React Query for server state
- **UI**: Mantine 8 + Cunningham design system
- **Export**: BlockNote XL packages (PDF, DOCX, ODT)
- **i18n**: i18next with Crowdin for community translations

### Collaboration Flow

Clients connect via WebSocket to the collaboration server (`src/yhub-server`, built on `@y/hub`), authenticated by their Django session cookie.

- On every connection (and permission recheck, REST call, fallback poll) yhub asks the backend who the caller is and what they may do: `GET /users/me/`, `GET /documents/{id}/`, and `GET /documents/{id}/accesses/me/` for the history. The backend stays the source of truth for access rights
- Updates travel between replicas through Redis/Valkey streams, so yhub replicas are stateless and need no sticky sessions. A worker (`YHUB_ROLE=all|server|worker`) compacts the stream into yhub's own PostgreSQL database (optionally S3 for the blobs)
- After a compaction that found new content, yhub calls `POST /documents/{id}/content-updated/` so that the backend updates `updated_at` and the search index
- The backend reads and writes content through the REST routes of yhub with an admin JWT (see `YHubService`)

## Observability

- **Metrics** (opt-in, `PROMETHEUS_METRICS_ENABLED` + a required `PROMETHEUS_API_KEY` bearer token, both services refuse to start without the key):
  - backend: django-prometheus on `/metrics`, deliberately outside `/api/`, protected by `core.middleware.PrometheusAuthMiddleware`. Multiprocess mode is set up automatically for the uvicorn workers. See `documentation/metrics.md`
  - yhub: `src/yhub-server/src/metrics.ts`, served on its own port (`9464`) in every role, the worker included. See the "Metrics" section of `src/yhub-server/README.md`
  - chart: `ingressMetrics` publishes `/metrics`, `/metrics/yhub` and `/metrics/yhub-worker` on a dedicated host
  - never put a document id, a user id or a path in a metric label
- **Sentry**: backend (`SENTRY_DSN`), y-provider, and yhub (`src/yhub-server/src/sentry.ts`, preloaded, `SENTRY_*` settings; `error`/`fatal` log lines of the shared pino logger are reported)
- **Profiling**: django-silk, opt-in with `SILK_ENABLED` (`documentation/profiling.md`)
- `documentation/load-testing.md` is the load-testing guide: tooling, setup of an instance, scenarios. Never against production
- **Load generators**: `src/loadtest/k6/` (plain k6 scripts: the page-open HTTP sequence and the heavy endpoints; every request tagged with a `name` free of identifiers, CSRF by double-submit with the frontend's `Origin`) and `src/loadtest/swarm/` (standalone TypeScript package, like `src/yhub-server`) opens many Yjs clients on yhub with the frontend's client stack, reading the manifest of `create_load_test_sessions`. Tests run against an in-process y-websocket server (`__tests__/_server.ts`); `src/loadtest/canary/` (same shape, Playwright library) drives a few real Chromium pairs through the frontend to measure page open, editor ready and keystroke propagation, with the manifest's cookies (session + `csrftoken`) set on the context

## Code Style Guidelines

### Python (Backend)
- **Formatter**: Ruff (line-length: 88)
- **Linter**: Ruff + Pylint (pylint runs only on files changed from `origin/main`)
- Imports (Ruff enforced): future, stdlib, django, third-party, impress (`core`), first-party, local
- Naming: PascalCase classes, snake_case functions/variables, UPPER_SNAKE_CASE constants
- **Print statements are forbidden** (T20 rule) - CI will reject them in backend code
- Use `@transaction.atomic`, `select_related`/`prefetch_related`, type hints `list[str]`
- Run migrations after model changes
- In `settings.py`, `post_setup` runs after django-configurations has handed the settings to Django: change lists and dicts **in place** there (`append`, `insert`, item assignment), a reassignment is silently ignored
- Use specific exceptions, no unused imports, double quotes, f-strings
- **Tests**: Prefer the `settings` fixture from `pytest-django` over `django.test.override_settings`

### TypeScript/React (Frontend)
- **Formatter**: Prettier (single quotes, trailing commas, semicolons, 80 char width)
- **Linter**: ESLint 9 with custom `eslint-plugin-docs`
- **Style**: Stylelint for CSS
- Imports: React & Next.js, libraries, internal, types, styles
- Naming: PascalCase components/types, camelCase functions, `use*` hooks, UPPER_SNAKE_CASE constants
- Strict mode, interfaces for shapes, Zustand for state, React Query for data

### TypeScript (yhub-server)
- Every environment variable is read, validated and refused at import time in `src/config.ts` (secrets through `secret()` in `src/env.ts`, which supports `NAME_FILE`): add new settings there, with a test in `__tests__/config.spec.ts`
- Prettier style with single quotes; tests are Vitest and mock `@y/hub`
- `@y/y` must stay the very copy `@y/hub` resolves (`__tests__/dependencies.spec.ts`)

## Helm/Kubernetes Deployment

### Structure
- `helmfile.yaml.gotmpl` - Helmfile defining releases and environments
- `impress/` - Helm chart with templates and default values
- `env.d/{env}/` - Environment-specific values (dev=local, feature=CI)

### Services
- Backend (Django + Celery), Frontend (Next.js), yhub (collaboration server, plus an optional separate worker with `yhub.worker.enabled`), yProvider (conversion only)
- Two standalone Valkey instances from the official `valkey/valkey` chart: `valkey-docs` (backend cache, sessions, Celery) and `valkey-yhub`
- `dev` only (`monitoring: true` in the helmfile environment): a trimmed `kube-prometheus-stack` release (`env.d/dev/values.prometheus.yaml.gotmpl`, operator + CRDs + one Prometheus at https://docs-prometheus.127.0.0.1.nip.io) scraping the backend and yhub through the `serviceMonitor` of the chart, with the token in the `docs-metrics` Secret it creates, and a Grafana at https://docs-grafana.127.0.0.1.nip.io (admin/admin) whose sidecar loads the dashboards of `src/loadtest/dashboards/` from ConfigMaps (legend `{{` escaped for helm's tpl, as the values file explains)
- Websocket ingress on `/collaboration/ws/` with no `upstream-hash-by`: any yhub replica serves any document
- DocSpec (conversion), Posthog (analytics) - optional

### Deployment Model
- Kind cluster with mkcert HTTPS, local registry (localhost:5001)
- CoreDNS for nip.io domains, dev-backend deps (Keycloak, PostgreSQL, Minio)

### Helm Guidelines
- Never commit secrets; use Got templating `{{ now | unixEpoch }}`
- Follow semantic versioning; values use `@param` annotations

## Git Conventions

### Commit Format

```
<gitmoji>(type) lowercase title

Mandatory description explaining why.
```

- **No space** between emoji and `(type)`, **one space** after closing parenthesis
- Types: `backend`, `frontend`, `ci`, `docker`, `dependencies`, `e2e`, `export`, `auth`, etc.
- Gitmoji examples: `✨` feature, `🐛` fix, `♻️` refactor, `⬆️` dependency upgrade, `🔒️` security
- Commits must be signed (`-S`) and signed-off (`--signoff`)

### Changelog

Update `CHANGELOG.md` under `[Unreleased]` with format: `- <gitmoji>(type) description` (max 80 chars per line).

### PR Checklist

Run before submitting: `make lint && make frontend-lint && make test`

## General Practices

- Commit messages should be clear and descriptive
- Run `make lint` and tests before committing
- Use DRF for REST APIs with proper serializers
- Implement proper error handling with try/except blocks
- Use Django settings for configuration
- Internationalize user-facing strings with `_()`
- Cache expensive operations, use database indexes
- Write docstrings for classes and complex functions
- Use type checking: TypeScript (frontend), mypy optional (Python)

## Environment Configuration

Config files in `env.d/development/`: `common`, `postgresql`, `kc_postgresql`, `crowdin`, `yhub`, `yhub-postgres`. The collaboration server reads its own two files and none of the backend's. Create `.local` overrides (gitignored) for custom settings.

## i18n

```bash
make i18n-generate      # Extract translation strings (backend + frontend)
make i18n-compile       # Compile translations for all apps
```

Internationalize user-facing strings with `_()` (backend) or i18next (frontend).

## Key Directories

- `src/backend/` - Django REST API backend
- `src/frontend/` - Next.js (apps/impress, packages/i18n, servers/y-provider)
- `src/yhub-server/` - Collaboration server (yhub)
- `src/helm/` - Helmfile and Helm chart for Kubernetes deployment
- `src/mail/` - Email template generator (MJML)
- `documentation/` - Documentation
- `.github/` - GitHub workflows and templates
