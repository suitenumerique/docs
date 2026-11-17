#!/usr/bin/env bash

# Generate the Fernet key encrypting the OIDC refresh tokens kept in the sessions
# (OIDC_STORE_REFRESH_TOKEN_KEY), only used when OIDC_STORE_REFRESH_TOKEN is
# enabled.
#
# Development only. The key is generated locally and never committed: it lands
# in "data/", which is gitignored. The dev stack mounts it in the containers,
# where OIDC_STORE_REFRESH_TOKEN_KEY_FILE points at it. The file wins over an
# OIDC_STORE_REFRESH_TOKEN_KEY line left in common.local by former versions of
# this script, which appended one at every run.
#
# Idempotent: an existing key is kept. Delete the file to roll it; the refresh
# tokens of the existing sessions can then no longer be read.

set -eo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KEY_DIR="${REPO_DIR}/data/oidc"
KEY_FILE="${KEY_DIR}/refresh-token.key"

mkdir -p "${KEY_DIR}"

if [ ! -f "${KEY_FILE}" ]; then
    # A Fernet key is 32 random bytes, url-safe base64 encoded
    openssl rand 32 | base64 | tr '+/' '-_' | tr -d '\n' > "${KEY_FILE}"
    chmod 600 "${KEY_FILE}"
    echo "✓ OIDC refresh token key generated in ${KEY_FILE}"
fi
