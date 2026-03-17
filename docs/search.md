# Setup Find search for Docs

This configuration will enable Find searches:
- Each save on **core.Document** or **core.DocumentAccess** will trigger the indexing of the document into Find.
- The `api/v1.0/documents/search/` will be used as proxy for searching documents from Find indexes.

## Create an index service for Docs

Configure a **Service** for Docs application with these settings

- **Name**: `docs`<br>_request.auth.name of the Docs application._
- **Client id**: `impress`<br>_Name of the token audience or client_id of the Docs application._

See [how-to-use-indexer.md](how-to-use-indexer.md) for details.

## Configure settings of Docs

Find uses a service provider authentication for indexing and a OIDC authentication for searching.

Add those Django settings to the Docs application to enable the feature.

```shell
SEARCH_INDEXER_CLASS="core.services.search_indexers.FindDocumentIndexer"

SEARCH_INDEXER_COUNTDOWN=10  # Debounce delay in seconds for the indexer calls.
SEARCH_INDEXER_QUERY_LIMIT=50 # Maximum number of results expected from the search endpoint

INDEXING_URL="http://find:8000/api/v1.0/documents/index/"
SEARCH_URL="http://find:8000/api/v1.0/documents/search/"

# Service provider authentication
SEARCH_INDEXER_SECRET="find-api-key-for-docs-with-exactly-50-chars-length"

# OIDC authentication
OIDC_STORE_ACCESS_TOKEN=True  # Store the access token in the session
OIDC_STORE_REFRESH_TOKEN=True  # Store the encrypted refresh token in the session
OIDC_STORE_REFRESH_TOKEN_KEY="<your-32-byte-encryption-key==>"
```

`OIDC_STORE_REFRESH_TOKEN_KEY` must be a valid Fernet key (32 url-safe base64-encoded bytes).
To create one, use the `bin/generate-oidc-store-refresh-token-key.sh` command.
