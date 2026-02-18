"""
Test file uploads API endpoint for users in impress's core app.
"""

import base64
import uuid
from io import BytesIO
from urllib.parse import urlparse

from django.conf import settings
from django.core.files.storage import default_storage
from django.utils import timezone

import pycrdt
import pytest
import requests
from freezegun import freeze_time
from rest_framework.test import APIClient

from core import factories, models

pytestmark = pytest.mark.django_db

PIXEL = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00"
    b"\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\xf8\xff\xff?\x00\x05\xfe\x02\xfe"
    b"\xa7V\xbd\xfa\x00\x00\x00\x00IEND\xaeB`\x82"
)


def get_image_refs(document_id):
    """Generate an image key for testing."""
    image_key = f"{document_id!s}/attachments/{uuid.uuid4()!s}.png"
    default_storage.connection.meta.client.put_object(
        Bucket=default_storage.bucket_name,
        Key=image_key,
        Body=BytesIO(PIXEL),
        ContentType="image/png",
    )
    return image_key, f"http://localhost/media/{image_key:s}"


def test_api_documents_duplicate_forbidden():
    """A user who doesn't have read access to a document should not be allowed to duplicate it."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(
        link_reach="restricted",
        users=[factories.UserFactory()],
        title="my document",
    )

    response = client.post(f"/api/v1.0/documents/{document.id!s}/duplicate/")

    assert response.status_code == 403
    assert models.Document.objects.count() == 1


def test_api_documents_duplicate_anonymous():
    """Anonymous users should not be able to duplicate documents even with read access."""

    document = factories.DocumentFactory(link_reach="public", link_role="reader")

    response = APIClient().post(f"/api/v1.0/documents/{document.id!s}/duplicate/")

    assert response.status_code == 401
    assert models.Document.objects.count() == 1


@pytest.mark.parametrize("index", range(3))
def test_api_documents_duplicate_success(index):
    """
    Anonymous users should be able to retrieve attachments linked to a public document.
    Accesses should not be duplicated if the user does not request it specifically.
    Attachments that are not in the content should not be passed for access in the
    duplicated document's "attachments" list.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document_ids = [uuid.uuid4() for _ in range(3)]
    image_refs = [get_image_refs(doc_id) for doc_id in document_ids]

    # Create document content with the first image only
    ydoc = pycrdt.Doc()
    fragment = pycrdt.XmlFragment(
        [
            pycrdt.XmlElement("img", {"src": image_refs[0][1]}),
        ]
    )
    ydoc["document-store"] = fragment
    update = ydoc.get_update()
    base64_content = base64.b64encode(update).decode("utf-8")

    # Create documents
    document = factories.DocumentFactory(
        id=document_ids[index],
        content=base64_content,
        link_reach="restricted",
        users=[user, factories.UserFactory()],
        title="document with an image",
        attachments=[key for key, _ in image_refs],
    )
    factories.DocumentFactory(id=document_ids[(index + 1) % 3])
    # Don't create document for third ID to check that it doesn't impact access to attachments

    # Duplicate the document via the API endpoint
    response = client.post(f"/api/v1.0/documents/{document.id}/duplicate/")

    assert response.status_code == 201

    duplicated_document = models.Document.objects.get(id=response.json()["id"])
    assert duplicated_document.title == "Copy of document with an image"
    assert duplicated_document.content == document.content
    assert duplicated_document.creator == user
    assert duplicated_document.link_reach == "restricted"
    assert duplicated_document.link_role == "reader"
    assert duplicated_document.duplicated_from == document
    assert duplicated_document.attachments == [
        image_refs[0][0]
    ]  # Only the first image key
    assert duplicated_document.get_parent() == document.get_parent()
    assert duplicated_document.path == document.get_next_sibling().path

    # Check that accesses were not duplicated.
    # The user who did the duplicate is forced as owner
    assert duplicated_document.accesses.count() == 1
    access = duplicated_document.accesses.first()
    assert access.user == user
    assert access.role == "owner"

    # Ensure access persists after the owner loses access to the original document
    models.DocumentAccess.objects.filter(document=document).delete()

    now = timezone.now()
    with freeze_time(now):
        response = client.get(
            "/api/v1.0/documents/media-auth/", HTTP_X_ORIGINAL_URL=image_refs[0][1]
        )

    assert response.status_code == 200
    assert response["X-Amz-Date"] == now.strftime("%Y%m%dT%H%M%SZ")
    authorization = response["Authorization"]
    assert "AWS4-HMAC-SHA256 Credential=" in authorization
    assert (
        "SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature="
        in authorization
    )

    s3_url = urlparse(settings.AWS_S3_ENDPOINT_URL)
    response = requests.get(
        f"{settings.AWS_S3_ENDPOINT_URL:s}/impress-media-storage/{image_refs[0][0]:s}",
        headers={
            "authorization": authorization,
            "x-amz-date": response["x-amz-date"],
            "x-amz-content-sha256": response["x-amz-content-sha256"],
            "Host": f"{s3_url.hostname:s}:{s3_url.port:d}",
        },
        timeout=1,
    )
    assert response.content == PIXEL

    # Ensure the other images are not accessible
    for _, url in image_refs[1:]:
        response = client.get(
            "/api/v1.0/documents/media-auth/", HTTP_X_ORIGINAL_URL=url
        )
        assert response.status_code == 403


@pytest.mark.parametrize("role", ["owner", "administrator"])
def test_api_documents_duplicate_with_accesses_admin(role):
    """
    Accesses should be duplicated if the user requests it specifically and is owner or admin.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(
        users=[(user, role)],
        title="document with accesses",
    )
    user_access = factories.UserDocumentAccessFactory(document=document)
    team_access = factories.TeamDocumentAccessFactory(document=document)

    # Duplicate the document via the API endpoint requesting to duplicate accesses
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/duplicate/",
        {"with_accesses": True},
        format="json",
    )

    assert response.status_code == 201

    duplicated_document = models.Document.objects.get(id=response.json()["id"])
    assert duplicated_document.title == "Copy of document with accesses"
    assert duplicated_document.content == document.content
    assert duplicated_document.link_reach == document.link_reach
    assert duplicated_document.link_role == document.link_role
    assert duplicated_document.creator == user
    assert duplicated_document.duplicated_from == document
    assert duplicated_document.attachments == []

    # Check that accesses were duplicated and the user who did the duplicate is forced as owner
    duplicated_accesses = duplicated_document.accesses
    assert duplicated_accesses.count() == 3
    assert duplicated_accesses.get(user=user).role == "owner"
    assert duplicated_accesses.get(user=user_access.user).role == user_access.role
    assert duplicated_accesses.get(team=team_access.team).role == team_access.role


@pytest.mark.parametrize("role", ["editor", "reader"])
def test_api_documents_duplicate_with_accesses_non_admin(role):
    """
    Accesses should not be duplicated if the user requests it specifically and is not owner
    or admin.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(
        users=[(user, role)],
        title="document with accesses",
    )
    factories.UserDocumentAccessFactory(document=document)
    factories.TeamDocumentAccessFactory(document=document)

    # Duplicate the document via the API endpoint requesting to duplicate accesses
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/duplicate/",
        {"with_accesses": True},
        format="json",
    )

    assert response.status_code == 201

    duplicated_document = models.Document.objects.get(id=response.json()["id"])
    assert duplicated_document.title == "Copy of document with accesses"
    assert duplicated_document.content == document.content
    assert duplicated_document.link_reach == document.link_reach
    assert duplicated_document.link_role == document.link_role
    assert duplicated_document.creator == user
    assert duplicated_document.duplicated_from == document
    assert duplicated_document.attachments == []

    # Check that accesses were duplicated and the user who did the duplicate is forced as owner
    duplicated_accesses = duplicated_document.accesses
    assert duplicated_accesses.count() == 1
    assert duplicated_accesses.get(user=user).role == "owner"


@pytest.mark.parametrize("role", ["editor", "reader"])
def test_api_documents_duplicate_non_root_document(role):
    """
    Non-root documents can be duplicated but without accesses.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(users=[(user, "owner")])
    child = factories.DocumentFactory(
        parent=document, users=[(user, role)], title="document with accesses"
    )

    assert child.accesses.count() == 1

    # Duplicate the document via the API endpoint requesting to duplicate accesses
    response = client.post(
        f"/api/v1.0/documents/{child.id!s}/duplicate/",
        {"with_accesses": True},
        format="json",
    )

    assert response.status_code == 201

    duplicated_document = models.Document.objects.get(id=response.json()["id"])
    assert duplicated_document.title == "Copy of document with accesses"
    assert duplicated_document.content == child.content
    assert duplicated_document.link_reach == child.link_reach
    assert duplicated_document.link_role == child.link_role
    assert duplicated_document.creator == user
    assert duplicated_document.duplicated_from == child
    assert duplicated_document.attachments == []

    # No access should be created for non root documents
    duplicated_accesses = duplicated_document.accesses
    assert duplicated_accesses.count() == 0
    assert duplicated_document.is_sibling_of(child)
    assert duplicated_document.is_child_of(document)


def test_api_documents_duplicate_reader_non_root_document():
    """
    Reader users should be able to duplicate non-root documents but will be
    created as a root document.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(users=[(user, "reader")])
    child = factories.DocumentFactory(parent=document)

    assert child.get_role(user) == "reader"

    response = client.post(
        f"/api/v1.0/documents/{child.id!s}/duplicate/", format="json"
    )
    assert response.status_code == 201

    duplicated_document = models.Document.objects.get(id=response.json()["id"])
    assert duplicated_document.is_root()
    assert duplicated_document.accesses.count() == 1
    assert duplicated_document.accesses.get(user=user).role == "owner"


def test_api_documents_duplicate_with_descendants_simple():
    """
    Duplicating a document with descendants flag should recursively duplicate all children.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    # Create document tree
    root = factories.DocumentFactory(
        users=[(user, "owner")],
        title="Root Document",
    )
    child1 = factories.DocumentFactory(
        parent=root,
        title="Child 1",
    )
    child2 = factories.DocumentFactory(
        parent=root,
        title="Child 2",
    )

    initial_count = models.Document.objects.count()
    assert initial_count == 3

    # Duplicate with descendants
    response = client.post(
        f"/api/v1.0/documents/{root.id!s}/duplicate/",
        {"with_descendants": True},
        format="json",
    )

    assert response.status_code == 201
    duplicated_root = models.Document.objects.get(id=response.json()["id"])

    # Check that all documents were duplicated (6 total: 3 original + 3 duplicated)
    assert models.Document.objects.count() == 6

    # Check root duplication
    assert duplicated_root.title == "Copy of Root Document"
    assert duplicated_root.creator == user
    assert duplicated_root.duplicated_from == root
    assert duplicated_root.get_children().count() == 2

    # Check children duplication
    duplicated_children = duplicated_root.get_children().order_by("title")
    assert duplicated_children.count() == 2

    duplicated_child1 = duplicated_children.first()
    assert duplicated_child1.title == "Copy of Child 1"
    assert duplicated_child1.creator == user
    assert duplicated_child1.duplicated_from == child1
    assert duplicated_child1.get_parent() == duplicated_root

    duplicated_child2 = duplicated_children.last()
    assert duplicated_child2.title == "Copy of Child 2"
    assert duplicated_child2.creator == user
    assert duplicated_child2.duplicated_from == child2
    assert duplicated_child2.get_parent() == duplicated_root


def test_api_documents_duplicate_with_descendants_multi_level():
    """
    Duplicating should recursively handle multiple levels of nesting.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    root = factories.DocumentFactory(
        users=[(user, "owner")],
        title="Level 0",
    )
    child = factories.DocumentFactory(
        parent=root,
        title="Level 1",
    )
    grandchild = factories.DocumentFactory(
        parent=child,
        title="Level 2",
    )
    great_grandchild = factories.DocumentFactory(
        parent=grandchild,
        title="Level 3",
    )

    initial_count = models.Document.objects.count()
    assert initial_count == 4

    # Duplicate with descendants
    response = client.post(
        f"/api/v1.0/documents/{root.id!s}/duplicate/",
        {"with_descendants": True},
        format="json",
    )

    assert response.status_code == 201
    duplicated_root = models.Document.objects.get(id=response.json()["id"])

    # Check that all documents were duplicated
    assert models.Document.objects.count() == 8

    # Verify the tree structure
    assert duplicated_root.depth == root.depth
    dup_children = duplicated_root.get_children()
    assert dup_children.count() == 1

    dup_child = dup_children.first()
    assert dup_child.title == "Copy of Level 1"
    assert dup_child.duplicated_from == child
    dup_grandchildren = dup_child.get_children()
    assert dup_grandchildren.count() == 1

    dup_grandchild = dup_grandchildren.first()
    assert dup_grandchild.title == "Copy of Level 2"
    assert dup_grandchild.duplicated_from == grandchild
    dup_great_grandchildren = dup_grandchild.get_children()
    assert dup_great_grandchildren.count() == 1

    dup_great_grandchild = dup_great_grandchildren.first()
    assert dup_great_grandchild.title == "Copy of Level 3"
    assert dup_great_grandchild.duplicated_from == great_grandchild


def test_api_documents_duplicate_with_descendants_and_attachments():
    """
    Duplicating with descendants should properly handle attachments in all children.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    # Create documents with attachments
    root_id = uuid.uuid4()
    child_id = uuid.uuid4()
    image_key_root, image_url_root = get_image_refs(root_id)
    image_key_child, image_url_child = get_image_refs(child_id)

    # Create root document with attachment
    ydoc = pycrdt.Doc()
    fragment = pycrdt.XmlFragment(
        [
            pycrdt.XmlElement("img", {"src": image_url_root}),
        ]
    )
    ydoc["document-store"] = fragment
    update = ydoc.get_update()
    root_content = base64.b64encode(update).decode("utf-8")

    root = factories.DocumentFactory(
        id=root_id,
        users=[(user, "owner")],
        title="Root with Image",
        content=root_content,
        attachments=[image_key_root],
    )

    # Create child with different attachment
    ydoc_child = pycrdt.Doc()
    fragment_child = pycrdt.XmlFragment(
        [
            pycrdt.XmlElement("img", {"src": image_url_child}),
        ]
    )
    ydoc_child["document-store"] = fragment_child
    update_child = ydoc_child.get_update()
    child_content = base64.b64encode(update_child).decode("utf-8")

    child = factories.DocumentFactory(
        id=child_id,
        parent=root,
        title="Child with Image",
        content=child_content,
        attachments=[image_key_child],
    )

    # Duplicate with descendants
    response = client.post(
        f"/api/v1.0/documents/{root.id!s}/duplicate/",
        {"with_descendants": True},
        format="json",
    )

    assert response.status_code == 201
    duplicated_root = models.Document.objects.get(id=response.json()["id"])

    # Check root attachments
    assert duplicated_root.attachments == [image_key_root]
    assert duplicated_root.content == root_content

    # Check child attachments
    dup_children = duplicated_root.get_children()
    assert dup_children.count() == 1
    dup_child = dup_children.first()
    assert dup_child.attachments == [image_key_child]
    assert dup_child.content == child_content


def test_api_documents_duplicate_with_descendants_and_accesses():
    """
    Duplicating with descendants and accesses should propagate accesses to all children.
    """
    user = factories.UserFactory()
    other_user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    # Create document tree with accesses
    root = factories.DocumentFactory(
        users=[(user, "owner"), (other_user, "editor")],
        title="Root",
    )
    child = factories.DocumentFactory(
        parent=root,
        title="Child",
    )
    factories.UserDocumentAccessFactory(document=child, user=other_user, role="reader")

    # Duplicate with descendants and accesses
    response = client.post(
        f"/api/v1.0/documents/{root.id!s}/duplicate/",
        {"with_descendants": True, "with_accesses": True},
        format="json",
    )

    assert response.status_code == 201
    duplicated_root = models.Document.objects.get(id=response.json()["id"])

    # Check root accesses (should be duplicated)
    root_accesses = duplicated_root.accesses.order_by("user_id")
    assert root_accesses.count() == 2
    assert root_accesses.get(user=user).role == "owner"
    assert root_accesses.get(user=other_user).role == "editor"

    # Check child accesses (should be duplicated)
    dup_children = duplicated_root.get_children()
    dup_child = dup_children.first()
    child_accesses = dup_child.accesses.order_by("user_id")
    assert child_accesses.count() == 1
    assert child_accesses.get(user=other_user).role == "reader"


@pytest.mark.parametrize("role", ["editor", "reader"])
def test_api_documents_duplicate_with_descendants_non_root_document_becomes_root(role):
    """
    When duplicating a non-root document with descendants as a reader/editor,
    it should become a root document and still duplicate its children.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    parent = factories.DocumentFactory(users=[(user, "owner")])
    child = factories.DocumentFactory(
        parent=parent,
        users=[(user, role)],
        title="Sub Document",
    )
    grandchild = factories.DocumentFactory(
        parent=child,
        title="Grandchild",
    )

    assert child.is_child_of(parent)

    # Duplicate the child (non-root) with descendants
    response = client.post(
        f"/api/v1.0/documents/{child.id!s}/duplicate/",
        {"with_descendants": True},
        format="json",
    )

    assert response.status_code == 201
    duplicated_child = models.Document.objects.get(id=response.json()["id"])

    assert duplicated_child.title == "Copy of Sub Document"

    dup_grandchildren = duplicated_child.get_children()
    assert dup_grandchildren.count() == 1
    dup_grandchild = dup_grandchildren.first()
    assert dup_grandchild.title == "Copy of Grandchild"
    assert dup_grandchild.duplicated_from == grandchild


def test_api_documents_duplicate_without_descendants_should_not_duplicate_children():
    """
    When with_descendants is not set or False, children should not be duplicated.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    # Create document tree
    root = factories.DocumentFactory(
        users=[(user, "owner")],
        title="Root",
    )
    child = factories.DocumentFactory(
        parent=root,
        title="Child",
    )

    initial_count = models.Document.objects.count()
    assert initial_count == 2

    # Duplicate without descendants (default behavior)
    response = client.post(
        f"/api/v1.0/documents/{root.id!s}/duplicate/",
        format="json",
    )

    assert response.status_code == 201
    duplicated_root = models.Document.objects.get(id=response.json()["id"])

    # Only root should be duplicated, not children
    assert models.Document.objects.count() == 3
    assert duplicated_root.get_children().count() == 0


def test_api_documents_duplicate_with_descendants_preserves_link_configuration():
    """
    Duplicating with descendants should preserve link configuration (link_reach, link_role)
    for all children when with_accesses is True.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    # Create document tree with specific link configurations
    root = factories.DocumentFactory(
        users=[(user, "owner")],
        title="Root",
        link_reach="public",
        link_role="reader",
    )
    child = factories.DocumentFactory(
        parent=root,
        title="Child",
        link_reach="restricted",
        link_role="editor",
    )

    # Duplicate with descendants and accesses
    response = client.post(
        f"/api/v1.0/documents/{root.id!s}/duplicate/",
        {"with_descendants": True, "with_accesses": True},
        format="json",
    )

    assert response.status_code == 201
    duplicated_root = models.Document.objects.get(id=response.json()["id"])

    # Check root link configuration
    assert duplicated_root.link_reach == root.link_reach
    assert duplicated_root.link_role == root.link_role

    # Check child link configuration
    dup_children = duplicated_root.get_children()
    dup_child = dup_children.first()
    assert dup_child.link_reach == child.link_reach
    assert dup_child.link_role == child.link_role


def test_api_documents_duplicate_with_descendants_complex_tree():
    """
    Test duplication of a complex tree structure with multiple branches.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    # Create a complex tree:
    #     root
    #    /    \
    #   c1     c2
    #  /  \     \
    # gc1 gc2   gc3
    root = factories.DocumentFactory(
        users=[(user, "owner")],
        title="Root",
    )
    child1 = factories.DocumentFactory(parent=root, title="Child 1")
    child2 = factories.DocumentFactory(parent=root, title="Child 2")
    _grandchild1 = factories.DocumentFactory(parent=child1, title="GrandChild 1")
    _grandchild2 = factories.DocumentFactory(parent=child1, title="GrandChild 2")
    _grandchild3 = factories.DocumentFactory(parent=child2, title="GrandChild 3")

    initial_count = models.Document.objects.count()
    assert initial_count == 6

    # Duplicate with descendants
    response = client.post(
        f"/api/v1.0/documents/{root.id!s}/duplicate/",
        {"with_descendants": True},
        format="json",
    )

    assert response.status_code == 201
    duplicated_root = models.Document.objects.get(id=response.json()["id"])

    # All documents should be duplicated
    assert models.Document.objects.count() == 12

    # Check structure is preserved
    dup_children = duplicated_root.get_children().order_by("title")
    assert dup_children.count() == 2

    dup_child1 = dup_children.first()
    assert dup_child1.title == "Copy of Child 1"
    dup_grandchildren1 = dup_child1.get_children().order_by("title")
    assert dup_grandchildren1.count() == 2
    assert dup_grandchildren1.first().title == "Copy of GrandChild 1"
    assert dup_grandchildren1.last().title == "Copy of GrandChild 2"

    dup_child2 = dup_children.last()
    assert dup_child2.title == "Copy of Child 2"
    dup_grandchildren2 = dup_child2.get_children()
    assert dup_grandchildren2.count() == 1
    assert dup_grandchildren2.first().title == "Copy of GrandChild 3"
