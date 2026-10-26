# Deploy docs.nickthesick.com

These instructions are for the existing Docs instance on the Mac mini's Docker
host, operated from the Paseo container. Run Compose and image builds from:

```sh
cd /home/paseo/.paseo/worktrees/0693k6kd/stingy-robin
```

This checkout owns Compose project `docs`. Do not deploy from another checkout:
the backend, environment files, signing keys and media use paths in this one.
No second instance or preview server is needed.

## Existing configuration

`compose.yml` is merged automatically with the **gitignored**
`compose.override.yml`. The override is required; repository defaults alone
would run development servers instead of the deployed images. Keep it and the
existing `env.d/development/*.local` files and `data/jwt/` keys in place. Do not
copy secrets into this document or commit them.

The Docker daemon runs outside Paseo. Bind mounts in the override use the
daemon-visible prefix `/var/lib/docker/volumes/paseo_paseo_home/_data/` for
files under Paseo's `/home/paseo/`. Keep those explicit paths: `/home/paseo/`
is not the same directory on the Docker host, especially after a restart.

The override keeps this temporary instance small:

- `nginx-frontend`: production static frontend image; no source mounts.
- `y-provider-development-converter`: production `y-provider` Docker target;
  `NODE_ENV=production`, no source mounts despite the service's name.
- `yhub`: production `yhub` Docker target, only signing keys mounted,
  `YHUB_COMPUTE_POOL_SIZE=1` and `YHUB_TASK_CONCURRENCY=1`.
- `app-dev`: existing Django Development configuration, uvicorn without reload.
- `celery-dev`: `INFO`, `--pool=solo --concurrency=1`.
- Seven dependency/yhub health checks run once a minute, with faster startup
  checks. `frontend-development` is profile-only and must stay stopped.

Host Caddy already routes `https://docs.nickthesick.com` over the external
`backbone` network:

| Path | Container destination |
| --- | --- |
| `/collaboration/*` (including WebSockets) | `docs-yhub-1:3002` |
| `/api/*`, `/admin/*`, `/static/*` | `docs-app-dev-1:8000` |
| `/media/*`, `/media-auth` | `docs-nginx-1:8083` |
| `/realms/*` | `docs-keycloak-1:8080` |
| Everything else | `docs-nginx-frontend-1:3000` |

Do not change Caddy or expose another port for a normal deployment.

```sh
docker compose config --quiet
docker compose ps
git status --short
```

## Build and deploy frontend changes

Build the current working tree, including intentional uncommitted changes.
Do not reset, clean or overwrite it. A frontend-only change does not require
rebuilding or restarting the converter, yhub, backend or databases.

Install from the existing lockfile:

```sh
cd src/frontend
yarn install --frozen-lockfile
cd apps/impress
```

Build the full-feature static app with same-origin API requests and the service
worker enabled. `CIRCLE_NODE_TOTAL=3` gives this Next.js version two build
workers; the heap cap avoids exhausting the small host. No edit to
`next.config.js` is needed.

```sh
CIRCLE_NODE_TOTAL=3 \
NODE_OPTIONS='--max-old-space-size=1792' \
NEXT_PUBLIC_API_ORIGIN='' \
NEXT_PUBLIC_SW_DEACTIVATED=false \
NEXT_PUBLIC_PUBLISH_AS_MIT=false \
yarn build
cd ../../../..
```

`yarn build` includes formatting, CSS and TypeScript checks. Wait for successful
static export to `src/frontend/apps/impress/out`; never package an interrupted
or failed build. For additional checks, from `src/frontend/apps/impress` run
`yarn test`, `../../node_modules/.bin/tsc --noEmit` and
`../../node_modules/.bin/eslint src`.

Package that output using the repository's production nginx Docker target:

```sh
DEPLOY_ID="$(git rev-parse --short HEAD)-$(date -u +%Y%m%d%H%M%S)"
FRONTEND_TAG="docs-frontend:$DEPLOY_ID"
OUTPUT_TAG="docs-frontend:build-output-$DEPLOY_ID"

docker tag "$(docker inspect docs-nginx-frontend-1 --format '{{.Image}}')" \
  docs-frontend:rollback

docker build --progress=plain -t "$OUTPUT_TAG" -f - \
  src/frontend/apps/impress/out <<'EOF'
FROM scratch
COPY . /app
EOF

docker build --progress=plain -f src/frontend/Dockerfile \
  --target frontend-production \
  --build-arg FRONTEND_IMAGE="$OUTPUT_TAG" \
  --build-arg DOCKER_USER=101 \
  -t "$FRONTEND_TAG" .

docker run --rm --entrypoint nginx "$FRONTEND_TAG" -t
```

In `compose.override.yml`, set **only**
`services.nginx-frontend.image` to the value of `$FRONTEND_TAG`. Keep the empty
volume override and networks unchanged. Then deploy only that service:

```sh
docker compose config --quiet
docker compose up -d --no-deps --force-recreate --wait --wait-timeout 120 \
  nginx-frontend
```

## Converter, yhub or backend changes

For changed BlockNote dependencies or converter source, build the production
converter too. Optionally choose a new `services.y-provider-development-converter.image`
tag in the override before building; Compose builds the configured tag.

```sh
docker compose build y-provider-development-converter
docker compose up -d --no-deps --force-recreate --wait --wait-timeout 120 \
  y-provider-development-converter
```

For yhub changes, build its configured production image. For an `@y/hub` upgrade,
read its changelog and run its idempotent schema initializer with the **new**
image before starting it. This was required for 0.9.1's versions table.
Its PostgreSQL, Valkey and MinIO must already be running.

```sh
docker compose build yhub
docker compose run --rm --no-deps yhub \
  node node_modules/@y/hub/bin/init-db.js
docker compose up -d --no-deps --force-recreate --wait --wait-timeout 120 yhub
```

Keep the image's `node --import ./dist/sentry.js dist/server.js` startup and the
one-worker limits. Do not replace it with `yarn dev` or mount server sources.

Backend sources are bind-mounted but reload is disabled. Restart `app-dev` and
`celery-dev` after Python-only changes. If dependencies or the backend image
changed, build `app-dev` and recreate those two services instead. Run Django
migrations when the change includes them:

```sh
docker compose build app-dev
docker compose run --rm --no-deps app-dev python manage.py migrate
docker compose up -d --no-deps --force-recreate app-dev celery-dev
```

Skip image builds and migrations when they are unrelated to the change.

## Verify the live deployment

```sh
docker compose ps nginx-frontend yhub y-provider-development-converter
curl -fsS https://docs.nickthesick.com/api/v1.0/config/ > /dev/null
curl -fsS https://docs.nickthesick.com/collaboration/ready/v1
sha256sum src/frontend/apps/impress/out/index.html
curl -fsS https://docs.nickthesick.com/ | sha256sum
sha256sum src/frontend/apps/impress/out/service-worker.js
curl -fsS https://docs.nickthesick.com/service-worker.js | sha256sum
```

Readiness must say `ready` with PostgreSQL and Redis `ok`. Both HTML hashes and
both worker hashes must match. Fetch an actual `/_next/static/...` script from
the HTML and check that it returns JavaScript, not the HTML fallback.

In the Paseo browser, use **https://docs.nickthesick.com**, not localhost.
Confirm `__NEXT_DATA__.buildId` matches the freshly built HTML. Sign in normally
if needed; test editing, reload persistence and history on a new temporary
document. A static document route returning 200 does not prove authentication,
WebSockets or restores work. Soft-delete the temporary document afterward.
For service-worker changes, wait for the updated worker to activate and reload;
check the active worker and the affected network requests, not just page HTML.

From the Paseo container, `127.0.0.1:3000` is not the Docker host's published
frontend port. To check nginx directly, use:

```sh
docker exec docs-nginx-frontend-1 wget -q -O /dev/null http://127.0.0.1:3000/
docker compose logs --tail 50 nginx-frontend yhub
```

## Restart or roll back this instance

If existing containers are stopped, start them rather than creating new stores:

```sh
docker compose start postgresql kc_postgresql redis minio yhub-postgres \
  yhub-valkey mailcatcher
docker compose start createbuckets app-dev keycloak nginx celery-dev yhub \
  y-provider-development-converter nginx-frontend
```

Allow Keycloak several minutes to become healthy. If it was recreated and login
requests return 502, refresh the backend nginx proxy's cached DNS:

```sh
docker compose exec -T nginx nginx -s reload
```

For a frontend rollback, set `services.nginx-frontend.image` in the override to
`docs-frontend:rollback`, then repeat the frontend-only `compose up` command and
verification. Older named images can also be used. Do not prune rollback images
until the replacement has been checked.

Never run `docker compose down -v`, renew anonymous volumes, or remove the data
directories as part of deploying. Backend and Keycloak databases have existing
anonymous volumes; yhub uses named PostgreSQL/Valkey volumes. Do not run
`make bootstrap` or start `frontend-development` to update this instance.
