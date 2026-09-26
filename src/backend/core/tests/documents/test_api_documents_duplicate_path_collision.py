"""
Tests of the retry on a path collision of the duplicate API endpoint.

Treebeard computes the materialized path of a new node from the current last
sibling (or the last root): two requests adding a node at the same level at the
same time compute the same path, and the loser of the race hits the unique index.
"""

from unittest import mock

from django.db import IntegrityError

import pytest
from rest_framework.test import APIClient

from core import factories, models
from core.factories import YDOC_HELLO_WORLD_UPDATE

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True, name="mock_yhub")
def mock_yhub_fixture():
    """The collaboration server holds the content of every document."""
    with mock.patch("core.api.viewsets.YHubService") as mock_service:
        mock_service.return_value.get_ydoc.return_value = YDOC_HELLO_WORLD_UPDATE
        yield mock_service


PATH_COLLISION = IntegrityError(
    'duplicate key value violates unique constraint "impress_document_path_key"\n'
    "DETAIL:  Key (path)=(0001dbx) already exists."
)


def test_api_documents_duplicate_retries_sibling_path_collision():
    """
    Treebeard computes the path of the duplicate from the current last sibling:
    two requests adding a node at the same level at the same time compute the same
    path. The loser must retry with a fresh path rather than answer a 500.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    root = factories.DocumentFactory(users=[(user, "owner")], title="Root")
    factories.DocumentFactory(parent=root, title="Child")

    original_add_sibling = models.Document.add_sibling
    attempts = []

    def add_sibling(self, pos, **kwargs):
        attempts.append(pos)
        if len(attempts) == 1:
            raise PATH_COLLISION
        return original_add_sibling(self, pos, **kwargs)

    with (
        mock.patch.object(
            models.Document, "add_sibling", autospec=True, side_effect=add_sibling
        ),
        mock.patch("core.api.viewsets.posthog_capture"),
    ):
        response = client.post(
            f"/api/v1.0/documents/{root.id!s}/duplicate/",
            {"with_descendants": True},
            format="json",
        )

    assert response.status_code == 201
    assert attempts == ["last-sibling", "last-sibling"]

    duplicated = models.Document.objects.get(id=response.json()["id"])
    assert duplicated.is_root()
    assert duplicated.get_siblings().count() == 2
    assert [child.title for child in duplicated.get_children()] == ["Copy of Child"]
    assert models.Document.objects.count() == 4
    assert duplicated.accesses.filter(user=user, role="owner").exists()


def test_api_documents_duplicate_retries_root_path_collision():
    """
    A non-privileged user duplicating a sub-document gets a new root: its path is
    computed from the current last root and must be retried on collision as well.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    parent = factories.DocumentFactory()
    child = factories.DocumentFactory(
        parent=parent, users=[(user, "reader")], title="Sub Document"
    )
    factories.DocumentFactory(parent=child, title="Grandchild")

    original_add_root = models.Document.add_root
    attempts = []

    def add_root(**kwargs):
        attempts.append(kwargs["title"])
        if len(attempts) == 1:
            raise PATH_COLLISION
        return original_add_root(**kwargs)

    with (
        mock.patch.object(models.Document, "add_root", side_effect=add_root),
        mock.patch("core.api.viewsets.posthog_capture"),
    ):
        response = client.post(
            f"/api/v1.0/documents/{child.id!s}/duplicate/",
            {"with_descendants": True},
            format="json",
        )

    assert response.status_code == 201
    assert len(attempts) == 2

    duplicated = models.Document.objects.get(id=response.json()["id"])
    assert duplicated.is_root()
    assert [child.title for child in duplicated.get_children()] == [
        "Copy of Grandchild"
    ]
    assert models.Document.objects.count() == 5
    assert duplicated.accesses.filter(user=user, role="owner").exists()


def test_api_documents_duplicate_path_collision_exceeding_attempts(settings):
    """A collision that persists after the last attempt is not swallowed."""
    settings.TREEBEARD_PATH_COMPUTE_RETRY_MAX_ATTEMPTS = 2
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)
    root = factories.DocumentFactory(users=[(user, "owner")])

    with (
        mock.patch.object(
            models.Document, "add_sibling", autospec=True, side_effect=PATH_COLLISION
        ) as mock_add_sibling,
        mock.patch("core.api.viewsets.posthog_capture") as mock_capture,
        pytest.raises(IntegrityError),
    ):
        client.post(f"/api/v1.0/documents/{root.id!s}/duplicate/", format="json")

    assert mock_add_sibling.call_count == 2
    mock_capture.assert_not_called()
    assert models.Document.objects.count() == 1
