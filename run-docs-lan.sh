#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

export DOCKER_USER="${DOCKER_USER:-$(id -u)}"
export LAN_HOST="${LAN_HOST:-$(ip route get 1.1.1.1 2>/dev/null | sed -n 's/.* src \([^ ]*\).*/\1/p' | head -n 1)}"
LAN_HOST="${LAN_HOST:-127.0.0.1}"

docker compose -f compose.yml -f compose.lan.yml up -d --force-recreate \
    app-dev celery-dev frontend-development y-provider-development \
    y-provider-development-converter nginx

printf 'Docs:      http://%s:3000\n' "$LAN_HOST"
printf 'API:       http://%s:8071\n' "$LAN_HOST"
printf 'Connexion: http://%s:8083\n' "$LAN_HOST"