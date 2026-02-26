# Use Docs as a Resource Server

Docs implements resource server, so it means it can be used from an external app to perform some operation using the dedicated API.

> **Note:** This feature might be subject to future evolutions. The API endpoints, configuration options, and behavior may change in future versions.

## Prerequisites

In order to activate the resource server on Docs you need to setup the following environement variables

```python
OIDC_RESOURCE_SERVER_ENABLED=True
OIDC_OP_URL=
OIDC_OP_INTROSPECTION_ENDPOINT=
OIDC_RS_CLIENT_ID=
OIDC_RS_CLIENT_SECRET=
OIDC_RS_AUDIENCE_CLAIM=
OIDC_RS_ALLOWED_AUDIENCES=
```

It implements the resource server using `django-lasuite`, see the [documentation](https://github.com/suitenumerique/django-lasuite/blob/main/documentation/how-to-use-oidc-resource-server-backend.md)

## Customise allowed routes

Configure the `EXTERNAL_API` setting to control which routes and actions are available in the external API. Set it via the `EXTERNAL_API` environment variable (as JSON) or in Django settings.

Default configuration:

```python
EXTERNAL_API = {
    "documents": {
        "enabled": True,
        "actions": ["list", "retrieve", "create", "children"],
    },
    "document_access": {
        "enabled": False,
        "actions": [],
    },
    "document_invitation": {
        "enabled": False,
        "actions": [],
    },
    "users": {
        "enabled": True,
        "actions": ["get_me"],
    },
}
```

**Endpoints:**

- `documents`: Controls `/external_api/v1.0/documents/`. Available actions: `list`, `retrieve`, `create`, `update`, `destroy`, `trashbin`, `children`,  `move`, `restore`, `versions`, `link-configuration`, `attachment-upload`, `media-auth`, `ai-transform`, `ai-translate`
- `document_access`: `/external_api/v1.0/documents/{id}/accesses/`. Available actions: `list`, `retrieve`, `create`, `update`, `partial_update`, `destroy`
- `document_invitation`: Controls `/external_api/v1.0/documents/{id}/invitations/`. Available actions: `list`, `retrieve`, `create`, `partial_update`, `destroy`

Each endpoint has `enabled` (boolean) and `actions` (list of allowed actions). Only actions explicitly listed are accessible.

## Request Docs

In order to request Docs from an external resource provider, you need to implement the basic setup of `django-lasuite` [Using the OIDC Authentication Backend to request a resource server](https://github.com/suitenumerique/django-lasuite/blob/main/documentation/how-to-use-oidc-call-to-resource-server.md)

Then you can requests some routes that are available at `/external_api/v1.0/*`, here are some examples of what you can do.

### Create a document

Here is an example of a view that creates a document from a markdown file at the root level in Docs.

```python
    @method_decorator(refresh_oidc_access_token)
    def create_document_from_markdown(self, request):
        """
        Create a new document from a Markdown file at root level.
        """

        # Get the access token from the session
        access_token = request.session.get('oidc_access_token')

        # Create a new document from a file
        file_content = b"# Test Document\n\nThis is a test."
        file = BytesIO(file_content)
        file.name = "readme.md"

        response = requests.post(
            f"{settings.DOCS_API}/documents/",
            {
                "file": file,
            },
            format="multipart",
        )

        response.raise_for_status()
        data = response.json()
        return {"id": data["id"]}
```

### Get user information

The same way, you can use the /me endpoint to get user information.

```python
response = requests.get(
    "{settings.DOCS_API}/users/me/",
    headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
)
```
