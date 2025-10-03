# Setup the Find search for Impress

This configuration will enable the fulltext search feature for Docs :
- Each save on **core.Document** or **core.DocumentAccess** will trigger the indexer
- The `api/v1.0/documents/search/` will work as a proxy with the Find API for fulltext search.

## Create an index service for Docs

Configure a **Service** for Docs application with these settings

- **Name**: `docs`<br>_request.auth.name of the Docs application._
- **Client id**: `impress`<br>_Name of the token audience or client_id of the Docs application._

See [how-to-use-indexer.md](how-to-use-indexer.md) for details.

## Configure settings of Docs

Add those Django settings the Docs application to enable the feature.

```shell
SEARCH_INDEXER_CLASS="core.services.search_indexers.FindDocumentIndexer"
SEARCH_INDEXER_COUNTDOWN=10  # Debounce delay in seconds for the indexer calls.

# The token from service "docs" of Find application (development).
SEARCH_INDEXER_SECRET="find-api-key-for-docs-with-exactly-50-chars-length"
SEARCH_INDEXER_URL="http://find:8000/api/v1.0/documents/index/"

# Search endpoint. Uses the OIDC token for authentication
SEARCH_INDEXER_QUERY_URL="http://find:8000/api/v1.0/documents/search/"
```

We also need to enable the **OIDC Token** refresh or the authentication will fail quickly.

```shell
# Store OIDC tokens in the session
OIDC_STORE_ACCESS_TOKEN = True  # Store the access token in the session
OIDC_STORE_REFRESH_TOKEN = True  # Store the encrypted refresh token in the session
OIDC_STORE_REFRESH_TOKEN_KEY = "your-32-byte-encryption-key=="  # Must be a valid Fernet key (32 url-safe base64-encoded bytes)
```
