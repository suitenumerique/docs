---
name: docs-start
description: Start the La Suite Docs development stack with the least work possible. Use when asked to start, run, launch, boot or bring up Docs, the dev stack or the backend, after a clone, a pull or a branch switch. Checks what is built, stale and running, then runs only the Makefile targets needed (bootstrap only on a first run, rebuilds only the images whose dependencies changed), and copes with a frontend served by a local `yarn dev`.
---

# Start the Docs stack

The goal is a running stack for the smallest cost: some contributors have a
slow connection or little memory. `make bootstrap` and every `make build-*`
are expensive, so run them only when the check below says so. `make run` is
usually all that is needed.

## 1. Check first, change nothing

```bash
bash .claude/skills/docs-start/check-stack.sh
```

Run it with the Bash tool (Git Bash on Windows). It is read-only and takes
around 20 seconds. It reports:

- the Docker daemon, the `lasuite-network` network, the `env.d/development/*.local` files and the JWT keys,
- **how the frontend is served**: the `frontend-development` container, a host
  process on :3000 (a local `yarn dev`: `mode: local`), or nothing yet,
- each dev image: missing, stale or up to date,
- containers whose **dependency volumes** are older than their image,
- the services' state, the two databases and the endpoints,
- a **suggested plan**, plus notes.

Read the plan before running it. It is a suggestion; the rules below explain
it and take precedence.

## 2. Rules behind the plan

**First run.** When no dev image and no `postgresql` container exist (a fresh
clone), run `make bootstrap`. It creates the network, the `.local` files and
the keys, builds every image, runs the migrations, builds the mails, starts
everything and seeds the demo data. Never run it on a stack that is already
set up. It rebuilds everything, flushes the database (`make demo` runs
`resetdb`), and `generate-secret-keys` appends one more
`OIDC_STORE_REFRESH_TOKEN_KEY` to `common.local` on every run.

**An image is stale only when its dependencies changed.** Every dev container
bind-mounts its sources, so code changes never need a rebuild. Only these do:

| image | make target | stale when these change | services |
|---|---|---|---|
| `impress:backend-development` | `make build-backend` | `src/backend/uv.lock`, `pyproject.toml`, root `Dockerfile` | `app-dev`, `celery-dev` |
| `impress:yhub-development` | `make build-yhub` | `src/yhub-server/yarn.lock`, `package.json`, its `Dockerfile` | `yhub` |
| `impress:y-provider-development` | `make build-yjs-provider` | `src/frontend/yarn.lock`, the root, y-provider and eslint-plugin `package.json`, its `Dockerfile` | `y-provider-development-converter` |
| `impress:frontend-development` | `make build-frontend` | `src/frontend/yarn.lock`, the root, impress and eslint-plugin `package.json`, `src/frontend/Dockerfile` | `frontend-development` |

Build only the stale images, one target each. Never use `make build`: it
rebuilds all four. When the frontend runs locally, never build the frontend
image.

**Some containers need `--renew-anon-volumes`.** `/app/.venv` and the
`node_modules` directories are anonymous volumes. `docker compose up
--force-recreate`, which is what `make run` does, carries them over to the new
container. After a rebuild, the container can therefore keep running the *old*
dependencies. The check reports it ("STALE dependency volume(s)"), and the
plan renews them for those services only:

```bash
DOCKER_USER=<same as the Makefile> docker compose up -d --force-recreate --renew-anon-volumes --no-deps <services>
```

- Keep `--no-deps`. Without it, a dependency recreated in the same `up` gets
  its volumes renewed too, and `postgresql` and `kc_postgresql` keep their
  data in anonymous volumes.
- Each renewal leaves the old volume dangling. `docker volume ls -f
  dangling=true` lists them. Suggest a cleanup to the user; never prune
  yourself.
- Always pass `DOCKER_USER` as the plan prints it: `0:0` on Windows, `uid:gid`
  elsewhere. Without it, compose runs the containers as `1000` and the
  bind-mounted files become unwritable.

**The frontend.**

- `mode: local`: something already answers on :3000 from the host, usually
  the user's own `yarn dev`. This is expected. Run `make run-backend`, not
  `make run`: `make run` would try to start the `frontend-development`
  container and fail with "port 3000 is already allocated". Tell the user the
  frontend on :3000 is theirs and was left alone.
- `mode: undecided`: nothing on :3000, but `src/frontend/node_modules` exists
  locally. Ask the user whether to run the frontend locally or in Docker.
  - Locally: `make run-backend`, then `make run-frontend-development`. That
    target blocks, so start it with `run_in_background`. It stops the
    container and runs `yarn dev`.
  - In Docker: build the frontend image if it is missing or stale, then run
    `make run`.
- `mode: container`: `make run`.
- When the check says the local `node_modules` are out of sync, tell the user
  and offer `cd src/frontend && yarn install`. It mostly hits the yarn cache.

**Already up.** When every backend service is running and answering, the plan
skips `make run`/`make run-backend` and only recreates what changed. Those
targets force-recreate every container and would drop the open collaboration
websockets for nothing. With nothing to change, the plan says so. Report that
and stop.

**Databases.**

- `make migrate` when migrations are pending.
- On an empty backend database (containers removed with `make down`: the
  `postgresql` data lives in an anonymous volume), run `make migrate` then
  `make demo`.
- `make migrate-yhub` after rebuilding yhub, or when its database is empty.
  It is idempotent: a `BUSYGROUP` error in its output is harmless.

## 3. Run the plan

- Use the Bash tool from the repository root and the Makefile targets as
  written.
- Builds and `make bootstrap` can exceed the 2-minute default. Pass
  `timeout: 600000`, or use `run_in_background` for `make bootstrap`.
- Before `make bootstrap`, a rebuild, or anything else long, tell the user in
  one line what you are about to run and why ("backend image stale:
  `uv.lock` changed").
- Never run `make down`, `make clean`, `docker compose down`, `docker system
  prune` or `--no-cache` builds to "start clean". They lose data or the build
  cache, and a slow connection pays for it.

## 4. Verify, then report

Run `check-stack.sh` again. The endpoints must answer `200` and the plan must
say "Nothing to do". Then give the user a short summary:

- what was run, and why,
- the URLs: frontend http://localhost:3000, API/admin http://localhost:8071,
  Keycloak http://localhost:8083, yhub http://localhost:3002, mails
  http://localhost:1081, MinIO http://localhost:9001,
- the logins: `impress` / `impress` for the app (Keycloak); `admin@example.com`
  / `admin` for the Django admin once `make demo` or `make superuser` has run,
- the notes from the check (local frontend, duplicated keys, drifted
  `node_modules`).

## Troubleshooting

- **A service keeps restarting**: `docker compose logs --tail 80 <service>`.
  If the traceback shows a missing module or a missing export after a pull,
  the dependencies are stale. The check tells whether the image or only the
  volumes are behind. A container out of sync with its volumes is often fixed
  by the `--renew-anon-volumes --no-deps` command above, even when the check
  sees nothing.
- **`env file ... .local not found`**: run `make create-env-local-files`. A
  new `.local` file was added to `compose.yml` since the last bootstrap.
- **yhub `/collaboration/ready/v1` answers `503`**: its postgres or valkey is
  down (`docker compose ps yhub-postgres yhub-valkey`). If the log names a
  missing relation, run `make migrate-yhub`.
- **Edits to `docker/auth/realm.json` have no effect** (`invalid_scope`,
  `client_not_found`): Keycloak imports the realm only once, and its
  `kc_postgresql` keeps it in an anonymous volume. Run `docker compose up -d
  --force-recreate --renew-anon-volumes kc_postgresql keycloak` (with
  `DOCKER_USER`). Everyone will have to log in again.
- **The Docker daemon is not reachable**: ask the user to start Docker
  Desktop. Do not try to start it yourself.

## Improvements

Whenever you notice something that would make starting the stack cheaper or
more reliable, tell the user and **ask before proposing a change**. This
covers:

- the Makefile: a target that does too much, a missing guard, a non-idempotent
  step,
- `compose.yml` or the Dockerfiles,
- this skill or `check-stack.sh`: a false positive or negative in the
  staleness check, a new service, a new image, a new `.local` file.

Keep the image table above and the `IMAGES` list in `check-stack.sh` in step
with `compose.yml` and the Dockerfiles.
