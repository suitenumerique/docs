"""
Tests for Documents API endpoint in impress's core app: create
"""

from concurrent.futures import ThreadPoolExecutor
from unittest import mock
from uuid import uuid4

from django.db import connection

import pytest
from rest_framework.test import APIClient

from core import factories
from core.models import Document
from core.utils.analytics import PosthogEventName

pytestmark = pytest.mark.django_db


def test_api_documents_create_anonymous():
    """Anonymous users should not be allowed to create documents."""
    response = APIClient().post(
        "/api/v1.0/documents/",
        {
            "title": "my document",
        },
    )

    assert response.status_code == 401
    assert not Document.objects.exists()


def test_api_documents_create_authenticated_success():
    """
    Authenticated users should be able to create documents and should automatically be declared
    as the owner of the newly created document.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    with mock.patch("core.api.viewsets.posthog_capture") as mock_capture:
        response = client.post(
            "/api/v1.0/documents/",
            {
                "title": "my document",
            },
            format="json",
        )

    assert response.status_code == 201
    document = Document.objects.get()
    assert document.title == "my document"
    assert document.link_reach == "restricted"
    assert document.accesses.filter(role="owner", user=user).exists()

    mock_capture.assert_called_once_with(
        PosthogEventName.DOC_CREATED,
        user,
        {},
        document=document,
    )


@pytest.mark.django_db(transaction=True)
def test_api_documents_create_document_race_condition():
    """
    It should be possible to create several documents at the same time
    without causing any race conditions or data integrity issues.
    """

    def create_document(title):
        try:
            user = factories.UserFactory()
            client = APIClient()
            client.force_login(user)
            return client.post(
                "/api/v1.0/documents/",
                {
                    "title": title,
                },
                format="json",
            )
        finally:
            # Close this worker thread's thread-local database connection so it
            # does not linger and block dropping the test database at teardown.
            connection.close()

    with ThreadPoolExecutor(max_workers=2) as executor:
        future1 = executor.submit(create_document, "my document 1")
        future2 = executor.submit(create_document, "my document 2")

        response1 = future1.result()
        response2 = future2.result()

        assert response1.status_code == 201
        assert response2.status_code == 201


def test_api_documents_create_authenticated_title_null():
    """It should be possible to create several documents with a null title."""
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    factories.DocumentFactory(title=None)

    response = client.post("/api/v1.0/documents/", {}, format="json")

    assert response.status_code == 201
    assert Document.objects.filter(title__isnull=True).count() == 2


def test_api_documents_create_force_id_success():
    """It should be possible to force the document ID when creating a document."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    forced_id = uuid4()

    response = client.post(
        "/api/v1.0/documents/",
        {
            "id": str(forced_id),
            "title": "my document",
        },
        format="json",
    )

    assert response.status_code == 201
    documents = Document.objects.all()
    assert len(documents) == 1
    assert documents[0].id == forced_id


def test_api_documents_create_force_id_existing():
    """
    It should not be possible to use the ID of an existing document when forcing ID on creation.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory()

    response = client.post(
        "/api/v1.0/documents/",
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


@pytest.mark.parametrize(
    "forced_id",
    [
        # Nil UUID: every bit is zero, including the version nibble.
        "00000000-0000-0000-0000-000000000000",
        # Max UUID: version nibble is 0xf, not in {1, 3, 4, 5}.
        "ffffffff-ffff-ffff-ffff-ffffffffffff",
        # Non-RFC-4122 variant (Microsoft GUID): `.version` returns None.
        "f47ac10b-58cc-4372-c567-0e02b2c3d479",
        # RFC-4122 v2 (DCE security): valid variant but version not in {1, 3, 4, 5}.
        "f47ac10b-58cc-2372-a567-0e02b2c3d479",
    ],
)
def test_api_documents_create_force_id_invalid_uuid(forced_id):
    """Forcing an ID with a non-standard UUID (nil, wrong variant, wrong version) is refused."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    response = client.post(
        "/api/v1.0/documents/",
        {
            "id": forced_id,
            "title": "my document",
        },
        format="json",
    )

    assert response.status_code == 400
    assert response.json() == {"id": ["The provided ID is not a valid UUID."]}
    assert not Document.objects.exists()
