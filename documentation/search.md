# Setup Find search for Docs

This configuration will enable Find searches:
- Each save on **core.Document** or **core.DocumentAccess** will trigger the indexing of the document into Find.
- The `api/v1.0/documents/search/` will be used as proxy for searching documents from Find indexes.

## Create an index service for Docs

Configure a **Service** for Docs application with these settings

- **Name**: `docs`<br>_The service the documents of Docs are indexed in; its token is `SEARCH_INDEXER_SECRET`._

See [how-to-use-indexer.md](how-to-use-indexer.md) for details.

Find validates each document of a batch. A document it refuses is logged as an
error ("Document <id> was not indexed by Find") and the rest of the batch is
indexed all the same. Find refuses, for example, a document shared with a user
whose `sub` is longer than 50 characters, or with a team whose name is not a
slug.

## Configure Menshen

Find authenticates the searches with a user token exchanged with
[Menshen](https://github.com/suitenumerique/menshen), La Suite's token exchange
server. Right after the OIDC login of a user who searches with Find, Docs
exchanges their access token for a Find token, keeps it encrypted in their
session, and revokes it at logout. The search never calls the identity provider.

Menshen needs:

- Docs as a service provider, the credentials of which are `MENSHEN_CLIENT_ID`
  and `MENSHEN_CLIENT_SECRET`;
- an exchange rule from Docs to Find (audience `FIND_AUDIENCE`, `find` by
  default) for the action scope `FIND_SEARCH_ACTION_SCOPE`
  (`action:search-find-docs` by default), granting the search in each service
  of `FIND_SEARCH_SERVICES` (`find:docs:search` for the default `docs`);
- a token lifetime (`exchanged_token_duration` of the rule) of at least
  `SESSION_COOKIE_AGE`: the token is used for the whole session, and a user
  whose token has expired searches the database until their next login (a
  warning is logged at login when the token is shorter than the session).

Menshen introspects the access token with the identity provider before
exchanging it: the identity provider must add `menshen` to the audience of the
access tokens of Docs.

## Configure settings of Docs

Find uses a service provider authentication for indexing and a token exchanged
with Menshen for searching.

Add those Django settings to the Docs application to enable the feature.

```shell
SEARCH_INDEXER_CLASS="core.services.search_indexers.FindDocumentIndexer"

SEARCH_INDEXER_COUNTDOWN=10  # Debounce delay in seconds for the indexer calls.
SEARCH_INDEXER_QUERY_LIMIT=50 # Maximum number of results expected from the search endpoint

INDEXING_URL="http://find:8000/api/v1.0/documents/index/"
SEARCH_URL="http://find:8000/api/v1.0/documents/search/"

# Service provider authentication
SEARCH_INDEXER_SECRET="find-api-key-for-docs-with-exactly-50-chars-length"

# Token exchange with Menshen, at login
MENSHEN_URL="https://menshen.example.org"
MENSHEN_CLIENT_ID="docs"
MENSHEN_CLIENT_SECRET="<secret of Docs in Menshen>"
FIND_AUDIENCE="find"  # The default
FIND_SEARCH_ACTION_SCOPE="action:search-find-docs"  # The default
FIND_SEARCH_SERVICES="docs"  # The default, comma-separated
FIND_SEARCH_TIMEOUT=10  # The default, in seconds, before searching the database instead
FIND_TOKEN_ENCRYPTION_KEY="<your-32-byte-encryption-key==>"

# OIDC authentication
OIDC_STORE_ACCESS_TOKEN=True  # Store the access token in the session, exchanged at login
```

`FIND_TOKEN_ENCRYPTION_KEY` must be a valid Fernet key (32 url-safe
base64-encoded bytes), e.g. `openssl rand 32 | base64 | tr '+/' '-_'`.
The search does not use the refresh token of the identity provider:
`OIDC_STORE_REFRESH_TOKEN` is not needed for it.
Secrets can be read from files with the `_FILE` variants, e.g.
`MENSHEN_CLIENT_SECRET_FILE` and `FIND_TOKEN_ENCRYPTION_KEY_FILE`.

## Feature flags

The Find search integration is controlled by the `flag_find_full_text_search`
feature flag: the users having it search the full text of the documents in Find,
the others search the titles of the documents in the database.

The Find token is only exchanged at login, for the users having the flag: a
user who gets the flag during their session searches Find from their next
login. A user who loses it searches the database from their next search.

Feature flags can be activated through the admin interface.

## Fallback on the database

The titles are searched in the database instead of Find, so that a search
always answers:

- for anonymous users;
- for the sessions without a usable Find token: Menshen failing or not
  configured at login, the flag granted since the login, the token expired, or
  encrypted with a former `FIND_TOKEN_ENCRYPTION_KEY`;
- whenever Find fails to answer: unreachable, slower than
  `FIND_SEARCH_TIMEOUT`, an error, an unexpected answer.
  A token Find rejects (401) is dropped from the session.

The failures are logged: a `400` or `403` from Find usually means that the
token does not grant the search in one of `FIND_SEARCH_SERVICES`.
