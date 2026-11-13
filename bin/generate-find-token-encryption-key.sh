#!/usr/bin/env bash

# Generate the Fernet key encrypting the Find tokens kept in the sessions.
#
# At login, the backend exchanges the access token of the user with Menshen for
# a token targeting Find, and keeps it in the session, encrypted with this key
# (FIND_TOKEN_ENCRYPTION_KEY).
#
# Development only. The key is generated locally and never committed: it lands
# in "data/", which is gitignored. The dev stack mounts it in the containers,
# where FIND_TOKEN_ENCRYPTION_KEY_FILE points at it.
#
# Idempotent: an existing key is kept. Delete the file to roll it; the Find
# tokens of the existing sessions can then no longer be read, their users search
# the database until their next login.

set -eo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KEY_DIR="${REPO_DIR}/data/find"
KEY_FILE="${KEY_DIR}/token-encryption.key"

mkdir -p "${KEY_DIR}"

if [ ! -f "${KEY_FILE}" ]; then
    # A Fernet key is 32 random bytes, url-safe base64 encoded
    openssl rand 32 | base64 | tr '+/' '-_' | tr -d '\n' > "${KEY_FILE}"
    chmod 600 "${KEY_FILE}"
    echo "✓ Find token encryption key generated in ${KEY_FILE}"
fi
