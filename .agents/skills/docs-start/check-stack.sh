#!/usr/bin/env bash
# Read-only report on the Docs development stack, for the docs-start skill.
#
# It changes nothing: no build, no pull, no container started or stopped.
# It prints what is missing, stale or running, then a suggested plan made of
# Makefile targets where one exists. Run it from anywhere in the repository:
#
#   bash .agents/skills/docs-start/check-stack.sh
#
# Works in Git Bash (Windows), Linux and macOS.

# no `set -u`: empty arrays are "unbound" under bash 3.2 (macOS)
export MSYS_NO_PATHCONV=1 # keep Git Bash from rewriting /app/... paths

ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || {
  echo "Not inside the Docs repository"
  exit 2
}
cd "$ROOT" || exit 2

# Same user the Makefile runs the containers with: plain `docker compose`
# commands have to pass it too, or the bind-mounted files end up unwritable.
if [ "${OS:-}" = "Windows_NT" ]; then
  DOCKER_USER="0:0"
else
  DOCKER_USER="$(id -u):$(id -g)"
fi
COMPOSE="DOCKER_USER=$DOCKER_USER docker compose"

PLAN=()
NOTES=()
plan() { PLAN+=("$1"); }
note() { NOTES+=("$1"); }

# -- portable helpers ---------------------------------------------------------

to_epoch() { # docker ISO 8601 date, "...Z" or "...+02:00" -> seconds
  date -d "$1" +%s 2>/dev/null && return
  # BSD date (macOS): no fractional seconds, and the offset spelled +hhmm
  local tz
  tz=$(echo "${1:19}" | sed 's/^\.[0-9]*//; s/^Z$/+00:00/; s/://')
  date -j -f '%Y-%m-%dT%H:%M:%S%z' "${1:0:19}${tz}" +%s 2>/dev/null || echo 0
}
mtime() { stat -c %Y "$1" 2>/dev/null || stat -f %m "$1" 2>/dev/null || echo 0; }
fhash() { tr -d '\r' | git hash-object --stdin; }
img_cat() { docker run --rm --entrypoint cat "$1" "$2" 2>/dev/null; }
head_at() { # commit HEAD pointed to at a given epoch, from the reflog
  git log -g --date=unix --format='%gd %H' HEAD 2>/dev/null |
    sed -n 's/^HEAD@{\([0-9]*\)} \(.*\)/\1 \2/p' |
    awk -v t="$1" '$1 <= t { print $2; exit }'
}

# -- docker -------------------------------------------------------------------

echo "== Docker"
if ! docker info >/dev/null 2>&1; then
  echo "daemon: NOT REACHABLE"
  echo
  echo "== Suggested plan"
  echo "1. Start Docker (Docker Desktop on Windows/macOS), then run this check again"
  exit 1
fi
echo "daemon: ok"
if docker network inspect lasuite-network >/dev/null 2>&1; then
  echo "network lasuite-network: ok"
else
  echo "network lasuite-network: MISSING"
fi

# -- local setup files --------------------------------------------------------

echo
echo "== Local setup files"
missing_env=()
for f in $(sed -n 's#^[[:space:]]*@touch \(env\.d/development/[^[:space:]]*\.local\).*#\1#p' Makefile); do
  [ -f "$f" ] || missing_env+=("$f")
done
if [ ${#missing_env[@]} -eq 0 ]; then
  echo "env.d/development/*.local: ok"
else
  echo "env.d/development/*.local MISSING: ${missing_env[*]}"
fi
for k in data/jwt/private.pem data/jwt/yhub-private.pem; do
  if [ -f "$k" ]; then echo "$k: ok"; else echo "$k: MISSING (make run-backend creates it)"; fi
done
oidc_keys=0
[ -f env.d/development/common.local ] &&
  oidc_keys=$(grep -c '^OIDC_STORE_REFRESH_TOKEN_KEY=' env.d/development/common.local)
echo "OIDC_STORE_REFRESH_TOKEN_KEY in common.local: $oidc_keys"
[ "$oidc_keys" -gt 1 ] &&
  note "common.local holds $oidc_keys OIDC_STORE_REFRESH_TOKEN_KEY lines (one per bootstrap, the last one wins): harmless but worth cleaning"

# -- containers ---------------------------------------------------------------

PS=$(docker compose ps -a --format '{{.Service}} {{.State}}' 2>/dev/null)
state() { # no associative array: macOS still ships bash 3.2
  local s
  s=$(echo "$PS" | awk -v svc="$1" '$1 == svc { print $2; exit }')
  echo "${s:-absent}"
}

# -- frontend mode ------------------------------------------------------------

echo
echo "== Frontend (:3000)"
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://localhost:3000/ 2>/dev/null)
fe_state=$(state frontend-development)
if [ "$fe_state" = "running" ]; then
  FRONTEND_MODE=container
  echo "served by the frontend-development container (http $code)"
elif [ "$code" != "000" ] && [ -n "$code" ]; then
  FRONTEND_MODE=local
  echo "served by a process on the host, not by docker (http $code): local \`yarn dev\`"
elif [ -d src/frontend/node_modules ]; then
  FRONTEND_MODE=undecided
  echo "nothing on :3000; the frontend is installed locally (src/frontend/node_modules)"
else
  FRONTEND_MODE=container
  echo "nothing on :3000; no local install, the container will serve it"
fi
echo "mode: $FRONTEND_MODE"
if [ -d src/frontend/node_modules ] && command -v yarn >/dev/null 2>&1; then
  if (cd src/frontend && yarn check --integrity >/dev/null 2>&1); then
    echo "local node_modules: in sync with yarn.lock"
  else
    echo "local node_modules: OUT OF SYNC with package.json/yarn.lock"
    [ "$FRONTEND_MODE" != "container" ] &&
      note "local frontend deps drifted: \`cd src/frontend && yarn install\` before \`yarn dev\` (uses the yarn cache, light on the network)"
  fi
fi

# -- images -------------------------------------------------------------------
# A dev image only goes stale when its dependency manifests or its Dockerfile
# change: the sources are bind-mounted. A file on disk newer than the image is
# a candidate; it is confirmed by comparing it with the copy baked in the image.
#
# spec: name|image|make target|services|image:local pairs|subset lockfile|dockerfile
IMAGES=(
  "backend|impress:backend-development|build-backend|app-dev celery-dev|/app/uv.lock:src/backend/uv.lock /app/pyproject.toml:src/backend/pyproject.toml||Dockerfile"
  "yhub|impress:yhub-development|build-yhub|yhub|/app/yarn.lock:src/yhub-server/yarn.lock /app/package.json:src/yhub-server/package.json||src/yhub-server/Dockerfile"
  # the y-provider Dockerfile runs `yarn install` without --frozen-lockfile,
  # which prunes yarn.lock inside the image: check it is a subset of ours
  "y-provider|impress:y-provider-development|build-yjs-provider|y-provider-development-converter|/home/frontend/package.json:src/frontend/package.json /home/frontend/servers/y-provider/package.json:src/frontend/servers/y-provider/package.json /home/frontend/packages/eslint-plugin-docs/package.json:src/frontend/packages/eslint-plugin-docs/package.json|/home/frontend/yarn.lock:src/frontend/yarn.lock|src/frontend/servers/y-provider/Dockerfile"
  "frontend|impress:frontend-development|build-frontend|frontend-development|/home/frontend/yarn.lock:src/frontend/yarn.lock /home/frontend/package.json:src/frontend/package.json /home/frontend/apps/impress/package.json:src/frontend/apps/impress/package.json /home/frontend/packages/eslint-plugin-docs/package.json:src/frontend/packages/eslint-plugin-docs/package.json||src/frontend/Dockerfile"
)

echo
echo "== Images"
images_missing=0
BUILD=()
RENEW=()
for spec in "${IMAGES[@]}"; do
  IFS='|' read -r name image target services pairs subset dockerfile <<<"$spec"
  if [ "$name" = "frontend" ] && [ "$FRONTEND_MODE" = "local" ]; then
    echo "$name: skipped (frontend runs locally)"
    continue
  fi
  created=$(docker image inspect -f '{{.Created}}' "$image" 2>/dev/null)
  if [ -z "$created" ]; then
    echo "$name ($image): MISSING -> make $target"
    images_missing=$((images_missing + 1))
    BUILD+=("$name:$target")
    continue
  fi
  ctime=$(to_epoch "$created")
  reasons=()
  for pair in $pairs; do
    in=${pair%%:*}
    loc=${pair#*:}
    [ "$(mtime "$loc")" -gt "$ctime" ] || continue
    [ "$(img_cat "$image" "$in" | fhash)" = "$(fhash <"$loc")" ] || reasons+=("$loc changed")
  done
  if [ -n "$subset" ]; then
    in=${subset%%:*}
    loc=${subset#*:}
    if [ "$(mtime "$loc")" -gt "$ctime" ]; then
      extra=$(comm -23 \
        <(img_cat "$image" "$in" | tr -d '\r' | grep '^  resolved ' | sort -u) \
        <(tr -d '\r' <"$loc" | grep '^  resolved ' | sort -u) | wc -l)
      [ "$extra" -eq 0 ] || reasons+=("$loc changed ($extra entries)")
    fi
  fi
  # the Dockerfile is not in the image: diff it against the commit checked
  # out when the image was built (a branch switch touches files it does not
  # change), and trust the mtime alone only when the reflog does not go back
  if [ "$(mtime "$dockerfile")" -gt "$ctime" ]; then
    built_from=$(head_at "$ctime")
    if [ -z "$built_from" ]; then
      reasons+=("$dockerfile touched since the build (no reflog to confirm)")
    elif ! git diff --quiet "$built_from" -- "$dockerfile" 2>/dev/null; then
      reasons+=("$dockerfile changed since the build")
    fi
  fi
  if [ ${#reasons[@]} -gt 0 ]; then
    echo "$name ($image, built ${created%%.*}): STALE -> make $target"
    printf '    - %s\n' "${reasons[@]}"
    BUILD+=("$name:$target")
  else
    echo "$name ($image, built ${created%%.*}): up to date"
  fi
done

# -- containers vs images -----------------------------------------------------
# `docker compose up --force-recreate` (what `make run` does) keeps each
# container's anonymous volumes. The dependencies installed in the image live
# in them (/app/.venv, node_modules): a volume older than the image hides what
# the image installed, so the container keeps running the old dependencies.

echo
echo "== Dependency volumes of the running containers"
for spec in "${IMAGES[@]}"; do
  IFS='|' read -r name image target services _ <<<"$spec"
  [ "$name" = "frontend" ] && [ "$FRONTEND_MODE" != "container" ] && continue
  created=$(docker image inspect -f '{{.Created}}' "$image" 2>/dev/null) || continue
  ctime=$(to_epoch "$created")
  for svc in $services; do
    cid=$(docker compose ps -a -q "$svc" 2>/dev/null | head -1)
    [ -z "$cid" ] && { echo "$svc: no container yet"; continue; }
    stale=""
    for vol in $(docker inspect -f '{{range .Mounts}}{{if eq .Type "volume"}}{{.Name}}={{.Destination}} {{end}}{{end}}' "$cid"); do
      vcreated=$(docker volume inspect -f '{{.CreatedAt}}' "${vol%%=*}" 2>/dev/null)
      [ -n "$vcreated" ] && [ "$(to_epoch "$vcreated")" -lt "$ctime" ] && stale+=" ${vol#*=}"
    done
    if [ -n "$stale" ]; then
      echo "$svc: STALE dependency volume(s):$stale (older than $image)"
      RENEW+=("$svc")
    else
      echo "$svc: ok"
    fi
  done
done

# -- services and databases ---------------------------------------------------

echo
echo "== Services"
for svc in postgresql redis minio keycloak kc_postgresql nginx app-dev celery-dev yhub yhub-postgres yhub-valkey y-provider-development-converter docspec mailcatcher; do
  printf '%-34s %s\n' "$svc" "$(state "$svc")"
done

echo
echo "== Databases"
app_db=unknown
if [ "$(state postgresql)" = "running" ]; then
  n=$(echo "select count(*) from information_schema.tables where table_name = 'django_migrations';" |
    docker compose exec -T postgresql sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tA' 2>/dev/null | tr -d '\r[:space:]')
  if [ "$n" = "1" ]; then app_db=migrated; elif [ "$n" = "0" ]; then app_db=empty; fi
fi
echo "backend database: $app_db"
pending_migrations=0
if [ "$app_db" = "migrated" ] && [ "$(state app-dev)" = "running" ]; then
  if docker compose exec -T app-dev python manage.py migrate --check >/dev/null 2>&1; then
    echo "backend migrations: all applied"
  else
    echo "backend migrations: PENDING (or the check failed) -> make migrate"
    pending_migrations=1
  fi
fi
yhub_db=unknown
if [ "$(state yhub-postgres)" = "running" ]; then
  n=$(echo "select count(*) from pg_tables where schemaname not in ('pg_catalog', 'information_schema');" |
    docker compose exec -T yhub-postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tA' 2>/dev/null | tr -d '\r[:space:]')
  if [ -n "$n" ] && [ "$n" -gt 0 ] 2>/dev/null; then yhub_db=migrated; elif [ "$n" = "0" ]; then yhub_db=empty; fi
fi
echo "yhub database: $yhub_db"

echo
echo "== Endpoints"
endpoints_ok=1
probe() {
  local c
  c=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$2" 2>/dev/null)
  printf '%-40s %s\n' "$1" "$c"
  [ "$c" = "200" ] || [ "$3" = "optional" ] || endpoints_ok=0
}
probe "backend  :8071/api/v1.0/config/" http://localhost:8071/api/v1.0/config/
probe "yhub     :3002/collaboration/ready/v1" http://localhost:3002/collaboration/ready/v1
probe "keycloak :8083 (via nginx)" http://localhost:8083/realms/impress/.well-known/openid-configuration
probe "frontend :3000" http://localhost:3000/ optional

# up = everything `make run-backend` starts is running and answering
stack_up=$endpoints_ok
for svc in app-dev celery-dev yhub y-provider-development-converter nginx docspec; do
  [ "$(state "$svc")" = "running" ] || stack_up=0
done

# -- plan ---------------------------------------------------------------------

any_image=0
for spec in "${IMAGES[@]}"; do
  IFS='|' read -r _ image _ <<<"$spec"
  docker image inspect "$image" >/dev/null 2>&1 && any_image=1
done

echo
echo "== Suggested plan"
if [ "$any_image" -eq 0 ] && [ "$(state postgresql)" = "absent" ]; then
  echo "1. make bootstrap    # first run: nothing is built yet"
  [ "$FRONTEND_MODE" = "local" ] &&
    echo "   (the frontend already runs on the host: its container will be built but will not start, :3000 is taken)"
else
  docker network inspect lasuite-network >/dev/null 2>&1 || plan "make create-docker-network"
  [ ${#missing_env[@]} -gt 0 ] && plan "make create-env-local-files"
  if [ "$FRONTEND_MODE" = "local" ] || [ "$FRONTEND_MODE" = "undecided" ]; then
    for b in "${BUILD[@]}"; do [ "${b%%:*}" = "frontend" ] || plan "make ${b#*:}"; done
    # already up: only what changed is recreated below, `make run-backend`
    # would restart every container and drop the open websockets for nothing
    [ "$stack_up" -eq 1 ] || plan "make run-backend"
  else
    for b in "${BUILD[@]}"; do plan "make ${b#*:}"; done
    [ "$stack_up" -eq 1 ] && [ "$(state frontend-development)" = "running" ] || plan "make run"
  fi
  # services whose image gets rebuilt, and those already on stale volumes,
  # must be recreated with fresh anonymous volumes: `make run` keeps them.
  # --no-deps: --renew-anon-volumes would otherwise also renew the volumes of
  # a dependency recreated in the same run, postgresql's data included
  for b in "${BUILD[@]}"; do
    for spec in "${IMAGES[@]}"; do
      IFS='|' read -r name _ _ services _ <<<"$spec"
      [ "$name" = "${b%%:*}" ] || continue
      [ "$name" = "frontend" ] && [ "$FRONTEND_MODE" != "container" ] && continue
      for s in $services; do RENEW+=("$s"); done
    done
  done
  if [ ${#RENEW[@]} -gt 0 ]; then
    uniq_renew=$(printf '%s\n' "${RENEW[@]}" | sort -u | tr '\n' ' ')
    plan "$COMPOSE up -d --force-recreate --renew-anon-volumes --no-deps ${uniq_renew% }"
  fi
  for b in "${BUILD[@]}"; do [ "${b%%:*}" = "yhub" ] && plan "make migrate-yhub"; done
  [ "$pending_migrations" -eq 1 ] && plan "make migrate"
  [ "$app_db" = "empty" ] && plan "make migrate" && plan "make demo    # empty database: seeds the demo data, flushes the DB first"
  [ "$yhub_db" = "empty" ] && plan "make migrate-yhub"
  [ "$FRONTEND_MODE" = "undecided" ] &&
    plan "ASK the user: frontend locally (make run-frontend-development, in the background) or in docker (make build-frontend if needed, then make run)"
  [ ${#PLAN[@]} -eq 0 ] && echo "Nothing to do: the stack is up and current."
  # a `make migrate` asked for twice (pending + empty) is run once
  i=1
  printf '%s\n' "${PLAN[@]}" | awk '!seen[$0]++' | while read -r step; do
    echo "$i. $step"
    i=$((i + 1))
  done
fi

if [ ${#NOTES[@]} -gt 0 ]; then
  echo
  echo "== Notes"
  printf -- '- %s\n' "${NOTES[@]}"
fi
