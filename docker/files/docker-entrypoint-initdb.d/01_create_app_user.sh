#!/bin/bash
set -e

# Create a non-superuser for the application to test migrations.
# Uses DB_USER and DB_PASSWORD from the environment so it stays in
# sync with the application database configuration.
# Only creates the user when DB_USER differs from POSTGRES_USER.


# Validate required environment variables
if [ -z "${POSTGRES_USER}" ] || [ -z "${POSTGRES_DB}" ] || [ -z "${DB_USER}" ] || [ -z "${DB_PASSWORD}" ]; then
    echo "Required environment variables (POSTGRES_USER, POSTGRES_DB, DB_USER, DB_PASSWORD) must be set."
    exit 0
fi


if [ "${DB_USER}" = "${POSTGRES_USER}" ]; then
    echo "DB_USER is the same as POSTGRES_USER, skipping non-superuser creation."
    exit 0
fi

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE USER "${DB_USER}" WITH PASSWORD '${DB_PASSWORD}';
    ALTER DATABASE "${POSTGRES_DB}" OWNER TO "${DB_USER}";
EOSQL
