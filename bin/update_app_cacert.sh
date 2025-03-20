#!/bin/sh
set -o errexit

#  The script is pretty simple. It downloads the latest  cacert.pem  file from the  certifi  package and appends the root certificate from  mkcert  to it. Then it copies the updated  cacert.pem  file to the container. 
#  The script is executed with the following command: 
#  $ bin/update_app_cacert.sh docs-production-backend-1

CONTAINER_NAME=${1:-"docs-production-backend-1"}

echo "updating cacert.pem for certifi package in ${CONTAINER_NAME}"


curl --create-dirs https://raw.githubusercontent.com/certifi/python-certifi/refs/heads/master/certifi/cacert.pem -o /tmp/certifi/cacert.pem
cat "$(mkcert -CAROOT)/rootCA.pem" >> /tmp/certifi/cacert.pem
docker cp /tmp/certifi/cacert.pem ${CONTAINER_NAME}:/usr/local/lib/python3.12/site-packages/certifi/cacert.pem

echo "end patching cacert.pem in ${CONTAINER_NAME}"
