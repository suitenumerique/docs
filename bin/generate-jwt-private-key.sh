#!/usr/bin/env bash

# Generate the RSA keys signing the JWT tokens exchanged between the services.
#
# Two directions, hence two keys:
# - "private.pem" signs the tokens the backend issues to call the converter and
#   the collaboration server.
# - "yhub-private.pem" signs the calls the collaboration server makes to the
#   backend.
#
# Only the private halves exist as files: each service publishes the public half
# of its own key on its JWKS endpoint, where the other one reads it.
#
# Development only. The keys are generated locally and never committed: they
# land in "data/", which is gitignored. The dev stack mounts them in the
# containers, where the *_FILE settings point at them.
#
# Idempotent: existing keys are kept. Delete a file to roll it.

set -eo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KEY_DIR="${REPO_DIR}/data/jwt"

mkdir -p "${KEY_DIR}"

if [ ! -f "${KEY_DIR}/private.pem" ]; then
    openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 \
        -out "${KEY_DIR}/private.pem" 2>/dev/null
    chmod 600 "${KEY_DIR}/private.pem"
    echo "✓ backend JWT private key generated in ${KEY_DIR}/private.pem"
fi

if [ ! -f "${KEY_DIR}/yhub-private.pem" ]; then
    openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 \
        -out "${KEY_DIR}/yhub-private.pem" 2>/dev/null
    chmod 600 "${KEY_DIR}/yhub-private.pem"
    echo "✓ collaboration JWT private key generated in ${KEY_DIR}/yhub-private.pem"
fi
