#!/bin/bash

set -o errexit  # always exit on error
set -o pipefail # don't ignore exit codes when piping output

echo "-----> Running post-frontend script"

# Move the frontend build to the nginx root and clean up
mkdir -p build/
mv src/frontend/apps/impress/out build/frontend-out

# Custom logo
ASSETS_DIR=build/frontend-out/assets
if [ -n "$THEME_CUSTOMIZATION_LOGO_URL" ]; then
    # Ensure https
    [[ ! "$THEME_CUSTOMIZATION_LOGO_URL" =~ ^https:// ]] && echo "[custom-logo] ERROR: URL must use HTTPS" >&2 && exit 1

    # Prevent SSRF
    HOSTNAME=$(echo "$THEME_CUSTOMIZATION_LOGO_URL" | sed -E 's|^https://([^/:]+).*|\1|')
    [[ "$HOSTNAME" =~ ^(localhost|127\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|0\.0\.0\.0|\[::1\]) ]] && echo "[custom-logo] ERROR: SSRF blocked: $HOSTNAME" >&2 && exit 1

    LOGO_FILE="${ASSETS_DIR}/icon-docs.svg"
    TMP_FILE=$(mktemp "${LOGO_FILE}.XXXXXX.tmp")

    # Actual download
    echo "[custom-logo] INFO: Downloading custom logo from: $THEME_CUSTOMIZATION_LOGO_URL"
    curl -fsSL --tlsv1.2 -o "$TMP_FILE" "$THEME_CUSTOMIZATION_LOGO_URL"

    # Validate filesize
    FILESIZE=$(stat -c%s "$TMP_FILE" 2>/dev/null || stat -f%z "$TMP_FILE")
    [[ "$FILESIZE" -eq 0 ]] && echo "[custom-logo] ERROR: empty file" >&2 && exit 1
    [[ "$FILESIZE" -gt 5242880 ]] && echo "[custom-logo] ERROR: file too large (${FILESIZE}B > 5MB)" >&2 && exit 1

    # Validate file type
    IS_SVG=false

    HEADER=$(head -c 100 "$TMP_FILE" | tr -d '\0' | tr '[:upper:]' '[:lower:]')
    [[ "$HEADER" =~ ^.*"<svg".*$ ]] && IS_SVG=true
    [[ "$HEADER" =~ ^.*"<?xml".*"<svg".*$ ]] && IS_SVG=true

    [[ "$IS_SVG" == false ]] && echo "[custom-logo] ERROR: not a valid SVG file" >&2 && exit 1

    mv -f "$TMP_FILE" "$LOGO_FILE"
    echo "[custom-logo] INFO: Custom logo downloaded successfully"
fi

mv src/backend/* ./
mv deploy/paas/* ./

# Inject custom theme JSON
if [ -n "$THEME_CUSTOMIZATION_JSON" ]; then
    echo "[custom-theme] INFO: Deploying the custom theme from THEME_CUSTOMIZATION_JSON."
    mkdir -p impress/configuration/theme
    echo "$THEME_CUSTOMIZATION_JSON" >impress/configuration/theme/default.json
    echo "[custom-theme] INFO: Custom theme deployed successfully."
fi

echo "3.13" >.python-version
