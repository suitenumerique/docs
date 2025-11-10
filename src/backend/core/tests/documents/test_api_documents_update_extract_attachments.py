"""
Test extract-attachments on document update in docs core app.
"""

import base64
from uuid import uuid4

import pycrdt
import pytest
from rest_framework.test import APIClient

from core import factories

pytestmark = pytest.mark.django_db


def get_ydoc_with_mages(image_keys):
    """Return a ydoc from text for testing purposes."""
    ydoc = pycrdt.Doc()
    fragment = pycrdt.XmlFragment(
        [
            pycrdt.XmlElement("img", {"src": f"http://localhost/media/{key:s}"})
            for key in image_keys
        ]
    )
    ydoc["document-store"] = fragment
    update = ydoc.get_update()
    return base64.b64encode(update).decode("utf-8")


def test_api_documents_update_new_attachment_keys_anonymous(django_assert_num_queries):
    """
    When an anonymous user updates a document, the attachment keys extracted from the
    updated content should be added to the list of "attachments" to the document if these
    attachments are already readable by anonymous users.
    """
    image_keys = [f"{uuid4()!s}/attachments/{uuid4()!s}.png" for _ in range(4)]
    document = factories.DocumentFactory(
        content=get_ydoc_with_mages(image_keys[:1]),
        attachments=[image_keys[0]],
        link_reach="public",
        link_role="editor",
    )

    factories.DocumentFactory(attachments=[image_keys[1]], link_reach="public")
    factories.DocumentFactory(attachments=[image_keys[2]], link_reach="authenticated")
    factories.DocumentFactory(attachments=[image_keys[3]], link_reach="restricted")
    expected_keys = {image_keys[i] for i in [0, 1]}

    with django_assert_num_queries(11):
        response = APIClient().put(
            f"/api/v1.0/documents/{document.id!s}/",
            {"content": get_ydoc_with_mages(image_keys), "websocket": True},
            format="json",
        )
    assert response.status_code == 200

    document.refresh_from_db()
    assert set(document.attachments) == expected_keys

    # Check that the db query to check attachments readability for extracted
    # keys is not done if the content changes but no new keys are found
    with django_assert_num_queries(7):
        response = APIClient().put(
            f"/api/v1.0/documents/{document.id!s}/",
            {"content": get_ydoc_with_mages(image_keys[:2]), "websocket": True},
            format="json",
        )
    assert response.status_code == 200

    document.refresh_from_db()
    assert len(document.attachments) == 2
    assert set(document.attachments) == expected_keys


def test_api_documents_update_new_attachment_keys_authenticated(
    django_assert_num_queries,
):
    """
    When an authenticated user updates a document, the attachment keys extracted from the
    updated content should be added to the list of "attachments" to the document if these
    attachments are already readable by the editing user.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    image_keys = [f"{uuid4()!s}/attachments/{uuid4()!s}.png" for _ in range(5)]
    document = factories.DocumentFactory(
        content=get_ydoc_with_mages(image_keys[:1]),
        attachments=[image_keys[0]],
        users=[(user, "editor")],
    )

    factories.DocumentFactory(attachments=[image_keys[1]], link_reach="public")
    factories.DocumentFactory(attachments=[image_keys[2]], link_reach="authenticated")
    factories.DocumentFactory(attachments=[image_keys[3]], link_reach="restricted")
    factories.DocumentFactory(attachments=[image_keys[4]], users=[user])
    expected_keys = {image_keys[i] for i in [0, 1, 2, 4]}

    with django_assert_num_queries(12):
        response = client.put(
            f"/api/v1.0/documents/{document.id!s}/",
            {"content": get_ydoc_with_mages(image_keys)},
            format="json",
        )
    assert response.status_code == 200

    document.refresh_from_db()
    assert set(document.attachments) == expected_keys

    # Check that the db query to check attachments readability for extracted
    # keys is not done if the content changes but no new keys are found
    with django_assert_num_queries(8):
        response = client.put(
            f"/api/v1.0/documents/{document.id!s}/",
            {"content": get_ydoc_with_mages(image_keys[:2])},
            format="json",
        )
    assert response.status_code == 200

    document.refresh_from_db()
    assert len(document.attachments) == 4
    assert set(document.attachments) == expected_keys


def test_api_documents_update_new_attachment_keys_duplicate():
    """
    Duplicate keys in the content should not result in duplicates in the document's attachments.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    image_key1 = f"{uuid4()!s}/attachments/{uuid4()!s}.png"
    image_key2 = f"{uuid4()!s}/attachments/{uuid4()!s}.png"
    document = factories.DocumentFactory(
        content=get_ydoc_with_mages([image_key1]),
        attachments=[image_key1],
        users=[(user, "editor")],
    )

    factories.DocumentFactory(attachments=[image_key2], users=[user])

    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/",
        {"content": get_ydoc_with_mages([image_key1, image_key2, image_key2])},
        format="json",
    )
    assert response.status_code == 200

    document.refresh_from_db()
    assert len(document.attachments) == 2
    assert set(document.attachments) == {image_key1, image_key2}
