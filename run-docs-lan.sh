#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

export DOCKER_USER="${DOCKER_USER:-$(id -u)}"
export LAN_HOST="${LAN_HOST:-$(ip route get 1.1.1.1 2>/dev/null | sed -n 's/.* src \([^ ]*\).*/\1/p' | head -n 1)}"
LAN_HOST="${LAN_HOST:-127.0.0.1}"

action="${1:-start}"
compose=(docker compose -f compose.yml -f compose.lan.yml)
app_services=(
    app-dev
    celery-dev
    frontend-development
    y-provider-development
    y-provider-development-converter
    nginx
)

case "$action" in
    start)
        # Compose only recreates services whose configuration changed. In
        # particular, do not force-recreate PostgreSQL or Redis dependencies:
        # their state must survive an ordinary application restart.
        "${compose[@]}" up -d "${app_services[@]}"
        ;;
    restart)
        # Restart only application services. Stateful dependencies (databases,
        # Redis, MinIO and Keycloak) deliberately keep running.
        if [[ -z "$("${compose[@]}" ps --all --quiet app-dev)" ]]; then
            printf 'Docs is not started; run %s without an argument first.\n' "${0##*/}" >&2
            exit 1
        fi
        "${compose[@]}" restart "${app_services[@]}"
        ;;
    *)
        printf 'Usage: %s [start|restart]\n' "${0##*/}" >&2
        exit 2
        ;;
esac

printf 'Docs:      http://%s:3000\n' "$LAN_HOST"
printf 'API:       http://%s:8071\n' "$LAN_HOST"
printf 'Connexion: http://%s:8083\n' "$LAN_HOST"
