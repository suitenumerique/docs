"""
Tests for Documents API endpoint in impress's core app: children create
"""

from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import pytest
from rest_framework.test import APIClient

from core import factories
from core.models import Document, LinkReachChoices, LinkRoleChoices

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize("depth", [1, 2, 3])
@pytest.mark.parametrize("role", LinkRoleChoices.values)
@pytest.mark.parametrize("reach", LinkReachChoices.values)
def test_api_documents_children_create_anonymous(reach, role, depth):
    """Anonymous users should not be allowed to create children documents."""
    for i in range(depth):
        if i == 0:
            document = factories.DocumentFactory(link_reach=reach, link_role=role)
        else:
            document = factories.DocumentFactory(parent=document)

    response = APIClient().post(
        f"/api/v1.0/documents/{document.id!s}/children/",
        {
            "title": "my document",
        },
    )

    assert Document.objects.count() == depth
    assert response.status_code == 401
    assert response.json() == {
        "detail": "Authentication credentials were not provided."
    }


@pytest.mark.parametrize("depth", [1, 2, 3])
@pytest.mark.parametrize(
    "reach,role",
    [
        ["restricted", "editor"],
        ["restricted", "reader"],
        ["public", "reader"],
        ["authenticated", "reader"],
    ],
)
def test_api_documents_children_create_authenticated_forbidden(reach, role, depth):
    """
    Authenticated users with no write access on a document should not be allowed
    to create a nested document.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    for i in range(depth):
        if i == 0:
            document = factories.DocumentFactory(link_reach=reach, link_role=role)
        else:
            document = factories.DocumentFactory(parent=document, link_role="reader")

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/children/",
        {
            "title": "my document",
        },
    )

    assert response.status_code == 403
    assert Document.objects.count() == depth


@pytest.mark.parametrize("depth", [1, 2, 3])
@pytest.mark.parametrize(
    "reach,role",
    [
        ["public", "editor"],
        ["authenticated", "editor"],
    ],
)
def test_api_documents_children_create_authenticated_success(reach, role, depth):
    """
    Authenticated users with write access on a document should be able
    to create a nested document.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    for i in range(depth):
        if i == 0:
            document = factories.DocumentFactory(link_reach=reach, link_role=role)
        else:
            document = factories.DocumentFactory(
                parent=document, link_reach="restricted"
            )

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/children/",
        {
            "title": "my child",
        },
    )

    assert response.status_code == 201

    child = Document.objects.get(id=response.json()["id"])
    assert child.title == "my child"
    assert child.link_reach == "restricted"
    # Access objects on the child are not necessary
    assert child.accesses.exists() is False


@pytest.mark.parametrize("depth", [1, 2, 3])
def test_api_documents_children_create_related_forbidden(depth):
    """
    Authenticated users with a specific read access on a document should not be allowed
    to create a nested document.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    for i in range(depth):
        if i == 0:
            document = factories.DocumentFactory(link_reach="restricted")
            factories.UserDocumentAccessFactory(
                user=user, document=document, role="reader"
            )
        else:
            document = factories.DocumentFactory(
                parent=document, link_reach="restricted"
            )

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/children/",
        {
            "title": "my document",
        },
    )

    assert response.status_code == 403
    assert Document.objects.count() == depth


@pytest.mark.parametrize("depth", [1, 2, 3])
@pytest.mark.parametrize("role", ["editor", "administrator", "owner"])
def test_api_documents_children_create_related_success(role, depth):
    """
    Authenticated users with a specific write access on a document should be
    able to create a nested document.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    for i in range(depth):
        if i == 0:
            document = factories.DocumentFactory(link_reach="restricted")
            factories.UserDocumentAccessFactory(user=user, document=document, role=role)
        else:
            document = factories.DocumentFactory(
                parent=document, link_reach="restricted"
            )

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/children/",
        {
            "title": "my child",
        },
    )

    assert response.status_code == 201
    child = Document.objects.get(id=response.json()["id"])
    assert child.title == "my child"
    assert child.link_reach == "restricted"
    # Access objects on the child are not necessary
    assert child.accesses.exists() is False


def test_api_documents_children_create_authenticated_title_null():
    """It should be possible to create several nested documents with a null title."""
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    parent = factories.DocumentFactory(
        title=None, link_reach="authenticated", link_role="editor"
    )
    factories.DocumentFactory(title=None, parent=parent)

    response = client.post(
        f"/api/v1.0/documents/{parent.id!s}/children/", {}, format="json"
    )

    assert response.status_code == 201
    assert Document.objects.filter(title__isnull=True).count() == 3


def test_api_documents_children_create_force_id_success():
    """It should be possible to force the document ID when creating a nested document."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    access = factories.UserDocumentAccessFactory(user=user, role="editor")
    forced_id = uuid4()

    response = client.post(
        f"/api/v1.0/documents/{access.document.id!s}/children/",
        {
            "id": str(forced_id),
            "title": "my document",
        },
        format="json",
    )

    assert response.status_code == 201
    assert Document.objects.count() == 2
    assert response.json()["id"] == str(forced_id)


def test_api_documents_children_create_force_id_existing():
    """
    It should not be possible to use the ID of an existing document when forcing ID on creation.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    access = factories.UserDocumentAccessFactory(user=user, role="editor")
    document = factories.DocumentFactory()

    response = client.post(
        f"/api/v1.0/documents/{access.document.id!s}/children/",
        {
            "id": str(document.id),
            "title": "my document",
        },
        format="json",
    )

    assert response.status_code == 400
    assert response.json() == {
        "id": ["A document with this ID already exists. You cannot override it."]
    }


@pytest.mark.django_db(transaction=True)
def test_api_documents_create_document_children_race_condition():
    """
    It should be possible to create several documents at the same time
    without causing any race conditions or data integrity issues.
    """

    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory()

    factories.UserDocumentAccessFactory(user=user, document=document, role="owner")

    def create_document():
        return client.post(
            f"/api/v1.0/documents/{document.id}/children/",
            {
                "title": "my child",
            },
        )

    with ThreadPoolExecutor(max_workers=2) as executor:
        future1 = executor.submit(create_document)
        future2 = executor.submit(create_document)

        response1 = future1.result()
        response2 = future2.result()

        assert response1.status_code == 201
        assert response2.status_code == 201

        document.refresh_from_db()
        assert document.numchild == 2
