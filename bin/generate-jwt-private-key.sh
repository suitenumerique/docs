#!/usr/bin/env bash

# Generate the RSA private key signing the JWT tokens issued by the backend.
#
# Development only. The key is generated locally and never committed: it lands
# in "data/", which is gitignored. The dev stack mounts it in the backend
# containers, where JWT_PRIVATE_KEY_FILE points at it.
#
# Idempotent: an existing key is kept. Delete the file to roll the key.

set -eo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KEY_PATH="${REPO_DIR}/data/jwt/private.pem"

if [ -f "${KEY_PATH}" ]; then
    exit 0
fi

mkdir -p "$(dirname "${KEY_PATH}")"
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "${KEY_PATH}" 2>/dev/null
chmod 600 "${KEY_PATH}"
echo "✓ JWT private key generated in ${KEY_PATH}"
