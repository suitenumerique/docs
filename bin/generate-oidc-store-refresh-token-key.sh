#!/usr/bin/env bash

# Generate the secret OIDC_STORE_REFRESH_TOKEN_KEY and store it to common.local

set -eo pipefail

COMMON_LOCAL="env.d/development/common.local"

OIDC_STORE_REFRESH_TOKEN_KEY=$(openssl rand -base64 32)

echo "OIDC_STORE_REFRESH_TOKEN_KEY=${OIDC_STORE_REFRESH_TOKEN_KEY}" > "${COMMON_LOCAL}"
echo "✓ OIDC_STORE_REFRESH_TOKEN_KEY generated and stored in ${COMMON_LOCAL}"
