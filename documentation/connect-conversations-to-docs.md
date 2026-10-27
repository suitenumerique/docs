# Connect Conversations to Docs via Resource Server

This guide explains how to configure the [Conversations](https://github.com/suitenumerique/conversations) application to interact with Docs using Docs' resource server API.

Both applications share the same OIDC provider (Keycloak in development, ProConnect in production), which makes the integration straightforward: Conversations authenticates its users via OIDC and can reuse their access tokens to call Docs on their behalf.

## How it works

```
User → Conversations (OIDC client) → Keycloak → Docs (resource server)
                                         ↑
                              validates access token
```

1. The user logs into Conversations via OIDC (Keycloak/ProConnect).
2. Conversations stores the user's access token in the session.
3. When Conversations needs to call Docs, it forwards that token as a `Bearer` token.
4. Docs validates the token against the OIDC provider (token introspection) and authorizes the request.

## Prerequisites

- Both Conversations and Docs are configured against the same OIDC provider.
- The OIDC client used by Conversations (`OIDC_RP_CLIENT_ID`) is registered in Keycloak and allowed to call Docs.

---

## Step 1 — Configure Docs as a resource server

In your Docs environment, set the following variables:

```bash
OIDC_RESOURCE_SERVER_ENABLED=True
OIDC_OP_URL=<your-keycloak-realm-url>
OIDC_OP_INTROSPECTION_ENDPOINT=<your-keycloak-realm-url>/protocol/openid-connect/token/introspect
OIDC_RS_CLIENT_ID=<docs-resource-server-client-id>
OIDC_RS_CLIENT_SECRET=<docs-resource-server-client-secret>
OIDC_RS_AUDIENCE_CLAIM=azp
OIDC_RS_ALLOWED_AUDIENCES=conversations
```

> `OIDC_RS_ALLOWED_AUDIENCES` must include the `OIDC_RP_CLIENT_ID` used by Conversations (`conversations` by default) so that Docs accepts tokens issued for that client.

Then, configure which API actions Conversations is allowed to perform. The default already enables document listing, retrieval and creation:

```python
# In Docs settings (or via EXTERNAL_API env var as JSON)
EXTERNAL_API = {
    "documents": {
        "enabled": True,
        "actions": ["list", "retrieve", "create", "children"],
    },
    "users": {
        "enabled": True,
        "actions": ["get_me"],
    },
}
```

Adjust `actions` to match what Conversations actually needs.

---

## Step 2 — Configure Conversations to store the access token

Conversations already has `OIDC_STORE_ACCESS_TOKEN` and `OIDC_STORE_REFRESH_TOKEN` settings available but disabled by default. Enable them in your environment file (e.g. `env.d/development/common`):

```bash
# Store tokens in the user session so they can be forwarded to Docs
OIDC_STORE_ACCESS_TOKEN=True
OIDC_STORE_REFRESH_TOKEN=True

# Fernet key used to encrypt the refresh token at rest in the session
# Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
OIDC_STORE_REFRESH_TOKEN_KEY=<your-32-byte-fernet-key>

# Base URL of the Docs external API
DOCS_API_BASE_URL=http://docs:8000/external_api/v1.0
```

> Conversations already validates that `OIDC_STORE_REFRESH_TOKEN_KEY` is set when token storage is enabled (see `settings.py` line 1163–1170), so the app will refuse to start with an invalid configuration.

---

## Step 3 — Add a Docs API client in Conversations

Create a small client module in Conversations to call Docs:

```python
# src/backend/core/docs_client.py
import requests
from django.conf import settings


DOCS_API_BASE_URL = settings.DOCS_API_BASE_URL


def _auth_headers(access_token: str) -> dict:
    return {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }


def get_me(access_token: str) -> dict:
    """Return the Docs user profile for the current user."""
    response = requests.get(
        f"{DOCS_API_BASE_URL}/users/me/",
        headers=_auth_headers(access_token),
    )
    response.raise_for_status()
    return response.json()


def list_documents(access_token: str, **params) -> dict:
    """List documents accessible to the current user."""
    response = requests.get(
        f"{DOCS_API_BASE_URL}/documents/",
        headers=_auth_headers(access_token),
        params=params,
    )
    response.raise_for_status()
    return response.json()


def create_document(access_token: str, title: str, content: bytes, filename: str) -> dict:
    """Create a document in Docs from raw content (e.g. a Markdown file)."""
    from io import BytesIO

    file = BytesIO(content)
    file.name = filename

    response = requests.post(
        f"{DOCS_API_BASE_URL}/documents/",
        files={"file": (filename, file)},
        headers={"Authorization": f"Bearer {access_token}"},
    )
    response.raise_for_status()
    return response.json()
```

---

## Step 4 — Use the client in views

Use the `refresh_oidc_access_token` decorator from `django-lasuite` to ensure the token is fresh before calling Docs:

```python
# Example: export a conversation to a Docs document
from django.utils.decorators import method_decorator
from lasuite.oidc_login.decorators import refresh_oidc_access_token
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from core.docs_client import create_document


class ChatViewSet(GenericViewSet):

    @method_decorator(refresh_oidc_access_token)
    @action(detail=True, methods=["post"], url_path="export-to-docs")
    def export_to_docs(self, request, pk=None):
        """Export a conversation as a Markdown document to Docs."""
        conversation = self.get_object()
        access_token = request.session.get("oidc_access_token")

        markdown_content = conversation.to_markdown()  # adapt to your model
        result = create_document(
            access_token=access_token,
            title=conversation.title,
            content=markdown_content.encode(),
            filename=f"{conversation.title}.md",
        )

        return Response({"docs_document_id": result["id"]})
```

The `refresh_oidc_access_token` decorator will:
1. Check if the stored access token is expired.
2. Use the encrypted refresh token to silently obtain a new one.
3. Update the session before your view logic runs.

Alternatively, enable the middleware globally to refresh tokens on every request:

```python
# conversations/settings.py — add to MIDDLEWARE
MIDDLEWARE = [
    # ... existing middleware ...
    "lasuite.oidc_login.middleware.RefreshOIDCAccessToken",
]
```

---

## Step 5 — Add the setting to Conversations settings.py

```python
# src/backend/conversations/settings.py
DOCS_API_BASE_URL = values.Value(
    None, environ_name="DOCS_API_BASE_URL", environ_prefix=None
)
```

---

## Development setup

In your local `compose.yml`, make sure the Conversations backend can reach the Docs container by name. If Docs runs on port `8000` and both services share the same Docker network:

```yaml
services:
  app:
    environment:
      - DOCS_API_BASE_URL=http://docs:8000/external_api/v1.0
      - OIDC_STORE_ACCESS_TOKEN=True
      - OIDC_STORE_REFRESH_TOKEN=True
      - OIDC_STORE_REFRESH_TOKEN_KEY=<generated-fernet-key>
```

And in your Docs service:

```yaml
  docs:
    environment:
      - OIDC_RESOURCE_SERVER_ENABLED=True
      - OIDC_OP_URL=http://keycloak:8080/realms/conversations
      - OIDC_OP_INTROSPECTION_ENDPOINT=http://keycloak:8080/realms/conversations/protocol/openid-connect/token/introspect
      - OIDC_RS_CLIENT_ID=docs
      - OIDC_RS_CLIENT_SECRET=<docs-client-secret>
      - OIDC_RS_AUDIENCE_CLAIM=azp
      - OIDC_RS_ALLOWED_AUDIENCES=conversations
```

---

## Available Docs API endpoints

Once configured, Conversations can call the following Docs endpoints:

| Endpoint | Action | Description |
|---|---|---|
| `GET /external_api/v1.0/documents/` | `list` | List the user's documents |
| `GET /external_api/v1.0/documents/{id}/` | `retrieve` | Get a document |
| `POST /external_api/v1.0/documents/` | `create` | Create a document |
| `GET /external_api/v1.0/documents/{id}/children/` | `children` | List sub-documents |
| `GET /external_api/v1.0/users/me/` | `get_me` | Get the current user profile |

Additional actions (`update`, `destroy`, `versions_list`, `ai_transform`, etc.) can be enabled in the `EXTERNAL_API` Docs setting.

---

## References

- [Docs resource server documentation](resource_server.md)
- [django-lasuite: resource server backend](https://github.com/suitenumerique/django-lasuite/blob/main/documentation/how-to-use-oidc-resource-server-backend.md)
- [django-lasuite: calling a resource server](https://github.com/suitenumerique/django-lasuite/blob/main/documentation/how-to-use-oidc-call-to-resource-server.md)
- [django-lasuite: OIDC backend](https://github.com/suitenumerique/django-lasuite/blob/main/documentation/how-to-use-oidc-backend.md)
