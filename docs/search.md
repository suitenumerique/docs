# Setup full-text search with Find

This configuration will enable the fulltext search feature for Docs :
- Each save on **core.Document** or **core.DocumentAccess** will trigger the indexer
- The `api/v1.0/documents/search/` will work as a proxy with the Find API for fulltext search.

## Create an index service for Docs

In Find application Django admin configure a **Service** with these settings

- **Name**: `docs`<br>_request.auth.name of the Docs application._

- **Client id**: `impress`<br>_Name of the token audience or client_id of the Docs application._

## Configure settings

Add those Django settings to enable the feature.

```shell
SEARCH_INDEXER_CLASS="core.services.search_indexers.FindDocumentIndexer"
SEARCH_INDEXER_COUNTDOWN=10  # Debounce delay in seconds for the index calls.

# Indexation endpoint.
SEARCH_INDEXER_SECRET=my-token-from-the-find-impress-service
# The token from service "docs" of Find application.
SEARCH_INDEXER_URL="http://app-find:8000/api/v1.0/documents/index/"

# Search endpoint. Uses the OIDC token for authentication
SEARCH_INDEXER_QUERY_URL="http://app-find:8000/api/v1.0/documents/search/"
```

We also need to enable the **OIDC Token** refresh or the authentication will fail quickly.

```shell
# Store OIDC tokens in the session
OIDC_STORE_ACCESS_TOKEN = True  # Store the access token in the session
OIDC_STORE_REFRESH_TOKEN = True  # Store the encrypted refresh token in the session
OIDC_STORE_REFRESH_TOKEN_KEY = "your-32-byte-encryption-key=="  # Must be a valid Fernet key (32 url-safe base64-encoded bytes)
```

# Installation with docker compose

First see [compose installation](installation/compose.md) documentation.

## 1. Postgresql

Find uses PostgreSQL as its database.

If you are using the example provided, you need to generate a secure key for `DB_PASSWORD` and set it in `env.d/find_postgresql`.

```shell
# Postgresql db container configuration
POSTGRES_DB=find
POSTGRES_USER=dinum
POSTGRES_PASSWORD=pass

# App database configuration
DB_HOST=postgresql-find
DB_NAME=find
DB_USER=dinum
DB_PASSWORD=<password>
DB_PORT=5432
```

And the service can be configured in `compose.yml`.

```yaml
  postgresql-find:
    image: postgres:15
    env_file:
      - env.d/development/find_postgresql
      - env.d/development/find_postgresql.local
    ports:
      - "15433:5432"
```

## 2. Opensearch

Find uses Opensearch as its indexation database.

If you are using the example provided, you need to generate a secure key for `OPENSEARCH_INITIAL_ADMIN_PASSWORD` and `OPENSEARCH_PASSWORD`
to set them in `env.d/opensearch`.

```shell
OPENSEARCH_INITIAL_ADMIN_PASSWORD=find
OPENSEARCH_PASSWORD=find
OPENSEARCH_USE_SSL=true  # false in Development mode

# Dashboard
OPENSEARCH_HOSTS=["http://opensearch:9200"]
DISABLE_SECURITY_DASHBOARDS_PLUGIN=false  # true in Development mode
```

And the service & dashboard can be configured in `compose.yml`.

```yaml
  opensearch:
    user: ${DOCKER_USER:-1000}
    image: opensearchproject/opensearch:latest
    env_file:
      - env.d/development/opensearch
      - env.d/development/opensearch.local
    environment:
      - discovery.type=single-node
      - plugins.security.disabled=true
      - plugins.security.ssl.http.enabled=false
    ulimits:
      memlock:
        soft: -1
        hard: -1
    volumes:
      - ./data/opensearch:/usr/share/opensearch/data
    ports:
      - "9200:9200"
      - "9600:9600"

  opensearch-dashboards:
    image: opensearchproject/opensearch-dashboards:latest
    ports:
      - "5601:5601"
    env_file:
      - env.d/development/opensearch
      - env.d/development/opensearch.local
    depends_on:
      - opensearch
```

## 3. Find (dev mode)

If you are using the example provided, you need to generate a secure key for `OIDC_RS_CLIENT_SECRET` and set it in `env.d/find`.

```shell
# Django
DJANGO_ALLOWED_HOSTS=*
DJANGO_SECRET_KEY=ThisIsAnExampleKeyForDevPurposeOnly
DJANGO_SETTINGS_MODULE=find.settings
DJANGO_SUPERUSER_PASSWORD=admin

# Python
PYTHONPATH=/app

# find settings

# Backend url
FIND_BASE_URL="http://localhost:9072"

# OIDC
OIDC_OP_URL=http://localhost:8083/realms/impress
OIDC_OP_INTROSPECTION_ENDPOINT=http://nginx:8083/realms/impress/protocol/openid-connect/token/introspect

OIDC_OP_JWKS_ENDPOINT=http://nginx:8083/realms/impress/protocol/openid-connect/certs
OIDC_OP_AUTHORIZATION_ENDPOINT=http://localhost:8083/realms/impress/protocol/openid-connect/auth
OIDC_OP_TOKEN_ENDPOINT=http://nginx:8083/realms/impress/protocol/openid-connect/token
OIDC_OP_USER_ENDPOINT=http://nginx:8083/realms/impress/protocol/openid-connect/userinfo

OIDC_RP_CLIENT_ID=impress
OIDC_RP_CLIENT_SECRET=ThisIsAnExampleKeyForDevPurposeOnly
OIDC_RP_SIGN_ALGO=RS256
OIDC_RP_SCOPES="openid email"

OIDC_REDIRECT_ALLOWED_HOSTS=["http://localhost:8083", "http://localhost:3000"]
OIDC_AUTH_REQUEST_EXTRA_PARAMS={"acr_values": "eidas1"}

# OIDC Resource server
OIDC_RS_SCOPES="openid"
OIDC_RS_CLIENT_ID=impress
OIDC_RS_CLIENT_SECRET=ThisIsAnExampleKeyForDevPurposeOnly
OIDC_RS_SIGN_ALGO=RS256

OIDC_RS_BACKEND_CLASS="core.authentication.FinderResourceServerBackend"
```

And Find can be configured in `compose.yml`.

```yaml
  find-dev:
    user: ${DOCKER_USER:-1000}
    image: find:backend-development
    environment:
      - PYLINTHOME=/app/.pylint.d
      - DJANGO_CONFIGURATION=Development
    env_file:
      - env.d/development/find
      - env.d/development/find.local
      - env.d/development/find_postgresql
      - env.d/development/find_postgresql.local
      - env.d/development/opensearch
      - env.d/development/opensearch.local
    ports:
      - "9071:8000"
    volumes:
      - ../find/src/backend:/app
      - ../find/data/static:/data/static
    depends_on:
        - find_postgresql
        - opensearch
        - redis
```

## Ports (dev defaults)

| Port      | Service               |
| --------- | --------------------- |
| 3000      | Next.js               |
| 8071      | Django (main)         |
| 9071      | Django (Find)         |
| 4444      | Y-Provider            |
| 8080      | Keycloak              |
| 8083      | Nginx proxy           |
| 9000/9001 | MinIO                 |
| 15432     | PostgreSQL (main)     |
| 15433     | PostgreSQL (Find)     |
| 5433      | PostgreSQL (Keycloak) |
| 1081      | MailCatcher           |
| 9200      | Opensearch            |
| 9600      | Opensearch admin      |
| 5601      | Opensearch dashboard  |
