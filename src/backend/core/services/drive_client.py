"""
Client for the Drive API.

The document tree and sharing are owned by Drive: documents are represented
there as items of type "file" carrying `metadata.external_app == "docs"`.
Every call impersonates the acting user through the server-to-server token and
the X-User-Sub / X-User-Email headers.
"""

import logging

from django.conf import settings
from django.core.cache import cache

import requests
from rest_framework import exceptions as drf_exceptions

logger = logging.getLogger(__name__)

ITEM_CACHE_TIMEOUT = 10  # seconds


class DriveClientError(Exception):
    """Raised when a call to the Drive API fails."""

    def __init__(self, message, status_code=None):
        super().__init__(message)
        self.status_code = status_code


def _headers(user):
    headers = {"Authorization": f"Bearer {settings.DRIVE_SERVER_TO_SERVER_TOKEN}"}
    sub = str(getattr(user, "sub", "") or "")
    email = str(getattr(user, "email", "") or "")
    # No identity headers means Drive computes abilities for an anonymous
    # visitor (public link reach only).
    if sub:
        headers["X-User-Sub"] = sub
    if email:
        headers["X-User-Email"] = email
    return headers


def _request(method, path, user, **kwargs):
    """Perform a request to the Drive API on behalf of a user."""
    if not settings.DRIVE_API_BASE_URL or not settings.DRIVE_SERVER_TO_SERVER_TOKEN:
        raise DriveClientError("Drive integration is not configured.")

    url = f"{settings.DRIVE_API_BASE_URL}{path}"
    try:
        response = requests.request(
            method, url, headers=_headers(user), timeout=10, **kwargs
        )
    except requests.RequestException as exc:
        raise DriveClientError(f"Could not reach Drive: {exc}") from exc

    if response.status_code >= 400:
        raise DriveClientError(
            f"Drive API call failed ({response.status_code}) on {path}: "
            f"{response.text[:500]}",
            status_code=response.status_code,
        )

    if response.status_code == 204:
        return None

    return response.json()


def raise_as_drf(exc):
    """Convert a DriveClientError to the closest DRF exception."""
    if exc.status_code in (401, 403):
        raise drf_exceptions.PermissionDenied(str(exc)) from exc
    if exc.status_code == 404:
        raise drf_exceptions.NotFound(str(exc)) from exc
    raise drf_exceptions.APIException(str(exc)) from exc


def create_doc_item(user, title, parent_id=None):
    """Create the Drive item representing a document, root or child."""
    payload = {
        "type": "file",
        "title": title or "Untitled document",
        "metadata": {"external_app": "docs"},
    }
    if parent_id:
        return _request("post", f"/items/{parent_id}/children/", user, json=payload)
    return _request("post", "/items/", user, json=payload)


def get_item(item_id, user):
    """Fetch a Drive item (including abilities) with a short per-user cache."""
    cache_key = f"drive_item:{item_id}:{getattr(user, 'sub', 'anonymous')}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    item = _request("get", f"/items/{item_id}/", user)
    cache.set(cache_key, item, ITEM_CACHE_TIMEOUT)
    return item


def get_tree(item_id, user):
    """Fetch the nested descendants tree of a document from Drive."""
    return _request("get", f"/items/{item_id}/tree-descendants/", user)


def list_root_docs(user, page=1):
    """List the user's root items pointing to Docs documents."""
    params = {"external_app": "docs", "type": "file"}
    if page and str(page) != "1":
        params["page"] = page
    return _request("get", "/items/", user, params=params)


def list_children(item_id, user):
    """List the direct children of a document item."""
    return _request(
        "get", f"/items/{item_id}/children/", user, params={"external_app": "docs"}
    )


def patch_title(item_id, user, title):
    """Push a document rename to Drive."""
    return _request("patch", f"/items/{item_id}/", user, json={"title": title})


def delete_item(item_id, user):
    """Move the Drive item mirroring a document to Drive's trash."""
    return _request("delete", f"/items/{item_id}/", user)


def map_drive_abilities(drive_abilities):
    """
    Map a Drive item's abilities onto the Docs document abilities dict.

    The dict shape must stay identical to Document.get_abilities as the frontend
    and the collaboration server both consume it. All sharing-related abilities
    are disabled: sharing is managed in Drive.
    """
    a = drive_abilities or {}
    r = a.get("retrieve", False)
    u = a.get("update", False)

    return {
        "accesses_manage": False,
        "accesses_view": False,
        "ai_proxy": u,
        "ai_transform": u,
        "ai_translate": u,
        "attachment_upload": u,
        "media_check": r,
        "can_edit": u,
        "children_list": a.get("children_list", r),
        "children_create": a.get("children_create", False),
        "collaboration_auth": r,
        "comment": u,
        "formatted_content": r,
        "content_patch": u,
        "content_retrieve": r,
        "cors_proxy": r,
        "descendants": r,
        "destroy": a.get("destroy", False),
        "duplicate": False,
        "favorite": False,
        "link_configuration": False,
        "invite_owner": False,
        "leave": False,
        "move": False,
        "partial_update": u,
        "restore": False,
        "retrieve": r,
        "media_auth": r,
        "link_select_options": {},
        "tree": r,
        "update": u,
        "versions_destroy": u,
        "versions_list": r,
        "versions_retrieve": r,
        "search": r,
    }


def no_abilities():
    """All-False abilities dict used when Drive cannot be reached."""
    mapped = map_drive_abilities({})
    mapped["link_select_options"] = {}
    return mapped


def get_doc_context(document_id, user):
    """
    Return (mapped_abilities, drive_user_role) for a document, sourced from
    Drive. Falls back to no abilities when the user has no access or Drive
    cannot be reached.
    """
    try:
        item = get_item(str(document_id), user)
    except DriveClientError:
        return no_abilities(), None

    return map_drive_abilities(item.get("abilities")), item.get("user_role")


def drive_item_to_doc_dict(item):
    """
    Map a Drive item payload to the shape of Docs' ListDocumentSerializer, so
    the frontend can consume Drive-served lists/trees transparently.
    """
    path = str(item.get("path") or "")
    depth = len(path.split(".")) if path else 1

    return {
        "id": item["id"],
        "abilities": map_drive_abilities(item.get("abilities")),
        # Link reach/role are managed in Drive and exposed read-only.
        "ancestors_link_reach": item.get("ancestors_link_reach") or "restricted",
        "ancestors_link_role": item.get("ancestors_link_role"),
        "computed_link_reach": item.get("computed_link_reach") or "restricted",
        "computed_link_role": item.get("computed_link_role"),
        "created_at": item.get("created_at"),
        "creator": (item.get("creator") or {}).get("id"),
        "deleted_at": item.get("deleted_at"),
        "depth": depth,
        "excerpt": None,
        "is_favorite": False,
        "link_reach": item.get("link_reach") or "restricted",
        "link_role": item.get("link_role"),
        "nb_accesses_ancestors": item.get("nb_accesses", 1),
        "nb_accesses_direct": item.get("nb_accesses", 1),
        "numchild": item.get("numchild", 0),
        "path": path,
        "title": item.get("title"),
        "updated_at": item.get("updated_at"),
        "user_role": item.get("user_role"),
    }


def drive_tree_to_doc_tree(node):
    """Recursively map a Drive nested tree node to the Docs tree node shape."""
    mapped = drive_item_to_doc_dict(node)
    mapped["children"] = [
        drive_tree_to_doc_tree(child) for child in node.get("children", [])
    ]
    return mapped
