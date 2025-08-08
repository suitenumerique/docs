#!/bin/bash

set -o errexit    # always exit on error
set -o pipefail   # don't ignore exit codes when piping output

echo "-----> Running post-compile script"

rm -rf docker docs env.d gitlint src/frontend/apps/e2e
rm -rf src/frontend/apps
rm -rf src/frontend/packages

# Remove some of the larger packages required by the frontend only
rm -rf src/frontend/node_modules/@next src/frontend/node_modules/next src/frontend/node_modules/react-icons src/frontend/node_modules/@gouvfr-lasuite 

# du -ch | sort -rh | head -n 100
