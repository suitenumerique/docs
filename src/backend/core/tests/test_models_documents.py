"""
Unit tests for the Document model
"""

import random
import smtplib
from logging import Logger
from unittest import mock

from django.contrib.auth.models import AnonymousUser
from django.core import mail
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.files.storage import default_storage
from django.utils import timezone

import pytest

from core import factories, models

pytestmark = pytest.mark.django_db


def test_models_documents_str():
    """The str representation should be the title of the document."""
    document = factories.DocumentFactory(title="admins")
    assert str(document) == "admins"


def test_models_documents_id_unique():
    """The "id" field should be unique."""
    document = factories.DocumentFactory()
    with pytest.raises(ValidationError, match="Document with this Id already exists."):
        factories.DocumentFactory(id=document.id)


def test_models_documents_creator_required():
    """No field should be required on the Document model."""
    models.Document.add_root()


def test_models_documents_title_null():
    """The "title" field can be null."""
    document = models.Document.add_root(title=None, creator=factories.UserFactory())
    assert document.title is None


def test_models_documents_title_empty():
    """The "title" field can be empty."""
    document = models.Document.add_root(title="", creator=factories.UserFactory())
    assert document.title == ""


def test_models_documents_title_max_length():
    """The "title" field should be 100 characters maximum."""
    factories.DocumentFactory(title="a" * 255)
    with pytest.raises(
        ValidationError,
        match=r"Ensure this value has at most 255 characters \(it has 256\)\.",
    ):
        factories.DocumentFactory(title="a" * 256)


def test_models_documents_file_key():
    """The file key should be built from the instance uuid."""
    document = factories.DocumentFactory(id="9531a5f1-42b1-496c-b3f4-1c09ed139b3c")
    assert document.file_key == "9531a5f1-42b1-496c-b3f4-1c09ed139b3c/file"


def test_models_documents_tree_alphabet():
    """Test the creation of documents with treebeard methods."""
    models.Document.load_bulk(
        [
            {
                "data": {
                    "title": f"document-{i}",
                }
            }
            for i in range(len(models.Document.alphabet) * 2)
        ]
    )

    assert models.Document.objects.count() == 124


@pytest.mark.parametrize("depth", range(5))
def test_models_documents_soft_delete(depth):
    """Trying to delete a document that is already deleted or is a descendant of
    a deleted document should raise an error.
    """
    documents = []
    for i in range(depth + 1):
        documents.append(
            factories.DocumentFactory()
            if i == 0
            else factories.DocumentFactory(parent=documents[-1])
        )
    assert models.Document.objects.count() == depth + 1

    # Delete any one of the documents...
    deleted_document = random.choice(documents)
    deleted_document.soft_delete()

    with pytest.raises(RuntimeError):
        documents[-1].soft_delete()

    assert deleted_document.deleted_at is not None
    assert deleted_document.ancestors_deleted_at == deleted_document.deleted_at

    descendants = deleted_document.get_descendants()
    for child in descendants:
        assert child.deleted_at is None
        assert child.ancestors_deleted_at is not None
        assert child.ancestors_deleted_at == deleted_document.deleted_at

    ancestors = deleted_document.get_ancestors()
    for parent in ancestors:
        assert parent.deleted_at is None
        assert parent.ancestors_deleted_at is None

    assert len(ancestors) + len(descendants) == depth


# get_abilities


@pytest.mark.parametrize(
    "is_authenticated,reach,role",
    [
        (True, "restricted", "reader"),
        (True, "restricted", "editor"),
        (False, "restricted", "reader"),
        (False, "restricted", "editor"),
        (False, "authenticated", "reader"),
        (False, "authenticated", "editor"),
    ],
)
def test_models_documents_get_abilities_forbidden(
    is_authenticated, reach, role, django_assert_num_queries
):
    """
    Check abilities returned for a document giving insufficient roles to link holders
    i.e anonymous users or authenticated users who have no specific role on the document.
    """
    document = factories.DocumentFactory(link_reach=reach, link_role=role)
    user = factories.UserFactory() if is_authenticated else AnonymousUser()
    expected_abilities = {
        "accesses_manage": False,
        "accesses_view": False,
        "ai_transform": False,
        "ai_translate": False,
        "attachment_upload": False,
        "children_create": False,
        "children_list": False,
        "collaboration_auth": False,
        "destroy": False,
        "favorite": False,
        "invite_owner": False,
        "media_auth": False,
        "move": False,
        "link_configuration": False,
        "partial_update": False,
        "restore": False,
        "retrieve": False,
        "update": False,
        "versions_destroy": False,
        "versions_list": False,
        "versions_retrieve": False,
    }
    nb_queries = 1 if is_authenticated else 0
    with django_assert_num_queries(nb_queries):
        assert document.get_abilities(user) == expected_abilities
    document.soft_delete()
    document.refresh_from_db()
    assert document.get_abilities(user) == expected_abilities


@pytest.mark.parametrize(
    "is_authenticated,reach",
    [
        (True, "public"),
        (False, "public"),
        (True, "authenticated"),
    ],
)
def test_models_documents_get_abilities_reader(
    is_authenticated, reach, django_assert_num_queries
):
    """
    Check abilities returned for a document giving reader role to link holders
    i.e anonymous users or authenticated users who have no specific role on the document.
    """
    document = factories.DocumentFactory(link_reach=reach, link_role="reader")
    user = factories.UserFactory() if is_authenticated else AnonymousUser()
    expected_abilities = {
        "accesses_manage": False,
        "accesses_view": False,
        "ai_transform": False,
        "ai_translate": False,
        "attachment_upload": False,
        "children_create": False,
        "children_list": True,
        "collaboration_auth": True,
        "destroy": False,
        "favorite": is_authenticated,
        "invite_owner": False,
        "link_configuration": False,
        "media_auth": True,
        "move": False,
        "partial_update": False,
        "restore": False,
        "retrieve": True,
        "update": False,
        "versions_destroy": False,
        "versions_list": False,
        "versions_retrieve": False,
    }
    nb_queries = 1 if is_authenticated else 0
    with django_assert_num_queries(nb_queries):
        assert document.get_abilities(user) == expected_abilities
    document.soft_delete()
    document.refresh_from_db()
    assert all(value is False for value in document.get_abilities(user).values())


@pytest.mark.parametrize(
    "is_authenticated,reach",
    [
        (True, "public"),
        (False, "public"),
        (True, "authenticated"),
    ],
)
def test_models_documents_get_abilities_editor(
    is_authenticated, reach, django_assert_num_queries
):
    """
    Check abilities returned for a document giving editor role to link holders
    i.e anonymous users or authenticated users who have no specific role on the document.
    """
    document = factories.DocumentFactory(link_reach=reach, link_role="editor")
    user = factories.UserFactory() if is_authenticated else AnonymousUser()
    expected_abilities = {
        "accesses_manage": False,
        "accesses_view": False,
        "ai_transform": True,
        "ai_translate": True,
        "attachment_upload": True,
        "children_create": is_authenticated,
        "children_list": True,
        "collaboration_auth": True,
        "destroy": False,
        "favorite": is_authenticated,
        "invite_owner": False,
        "link_configuration": False,
        "media_auth": True,
        "move": False,
        "partial_update": True,
        "restore": False,
        "retrieve": True,
        "update": True,
        "versions_destroy": False,
        "versions_list": False,
        "versions_retrieve": False,
    }
    nb_queries = 1 if is_authenticated else 0
    with django_assert_num_queries(nb_queries):
        assert document.get_abilities(user) == expected_abilities
    document.soft_delete()
    document.refresh_from_db()
    assert all(value is False for value in document.get_abilities(user).values())


def test_models_documents_get_abilities_owner(django_assert_num_queries):
    """Check abilities returned for the owner of a document."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(users=[(user, "owner")])
    expected_abilities = {
        "accesses_manage": True,
        "accesses_view": True,
        "ai_transform": True,
        "ai_translate": True,
        "attachment_upload": True,
        "children_create": True,
        "children_list": True,
        "collaboration_auth": True,
        "destroy": True,
        "favorite": True,
        "invite_owner": True,
        "link_configuration": True,
        "media_auth": True,
        "move": True,
        "partial_update": True,
        "restore": True,
        "retrieve": True,
        "update": True,
        "versions_destroy": True,
        "versions_list": True,
        "versions_retrieve": True,
    }
    with django_assert_num_queries(1):
        assert document.get_abilities(user) == expected_abilities
    document.soft_delete()
    document.refresh_from_db()
    expected_abilities["move"] = False
    assert document.get_abilities(user) == expected_abilities


def test_models_documents_get_abilities_administrator(django_assert_num_queries):
    """Check abilities returned for the administrator of a document."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(users=[(user, "administrator")])
    expected_abilities = {
        "accesses_manage": True,
        "accesses_view": True,
        "ai_transform": True,
        "ai_translate": True,
        "attachment_upload": True,
        "children_create": True,
        "children_list": True,
        "collaboration_auth": True,
        "destroy": False,
        "favorite": True,
        "invite_owner": False,
        "link_configuration": True,
        "media_auth": True,
        "move": True,
        "partial_update": True,
        "restore": False,
        "retrieve": True,
        "update": True,
        "versions_destroy": True,
        "versions_list": True,
        "versions_retrieve": True,
    }
    with django_assert_num_queries(1):
        assert document.get_abilities(user) == expected_abilities
    document.soft_delete()
    document.refresh_from_db()
    assert all(value is False for value in document.get_abilities(user).values())


def test_models_documents_get_abilities_editor_user(django_assert_num_queries):
    """Check abilities returned for the editor of a document."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(users=[(user, "editor")])
    expected_abilities = {
        "accesses_manage": False,
        "accesses_view": True,
        "ai_transform": True,
        "ai_translate": True,
        "attachment_upload": True,
        "children_create": True,
        "children_list": True,
        "collaboration_auth": True,
        "destroy": False,
        "favorite": True,
        "invite_owner": False,
        "link_configuration": False,
        "media_auth": True,
        "move": False,
        "partial_update": True,
        "restore": False,
        "retrieve": True,
        "update": True,
        "versions_destroy": False,
        "versions_list": True,
        "versions_retrieve": True,
    }
    with django_assert_num_queries(1):
        assert document.get_abilities(user) == expected_abilities
    document.soft_delete()
    document.refresh_from_db()
    assert all(value is False for value in document.get_abilities(user).values())


def test_models_documents_get_abilities_reader_user(django_assert_num_queries):
    """Check abilities returned for the reader of a document."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(users=[(user, "reader")])
    access_from_link = (
        document.link_reach != "restricted" and document.link_role == "editor"
    )
    expected_abilities = {
        "accesses_manage": False,
        "accesses_view": True,
        "ai_transform": access_from_link,
        "ai_translate": access_from_link,
        "attachment_upload": access_from_link,
        "children_create": access_from_link,
        "children_list": True,
        "collaboration_auth": True,
        "destroy": False,
        "favorite": True,
        "invite_owner": False,
        "link_configuration": False,
        "media_auth": True,
        "move": False,
        "partial_update": access_from_link,
        "restore": False,
        "retrieve": True,
        "update": access_from_link,
        "versions_destroy": False,
        "versions_list": True,
        "versions_retrieve": True,
    }
    with django_assert_num_queries(1):
        assert document.get_abilities(user) == expected_abilities
    document.soft_delete()
    document.refresh_from_db()
    assert all(value is False for value in document.get_abilities(user).values())


def test_models_documents_get_abilities_preset_role(django_assert_num_queries):
    """No query is done if the role is preset e.g. with query annotation."""
    access = factories.UserDocumentAccessFactory(
        role="reader", document__link_role="reader"
    )
    access.document.user_roles = ["reader"]

    with django_assert_num_queries(0):
        abilities = access.document.get_abilities(access.user)

    assert abilities == {
        "accesses_manage": False,
        "accesses_view": True,
        "ai_transform": False,
        "ai_translate": False,
        "attachment_upload": False,
        "children_create": False,
        "children_list": True,
        "collaboration_auth": True,
        "destroy": False,
        "favorite": True,
        "invite_owner": False,
        "link_configuration": False,
        "media_auth": True,
        "move": False,
        "partial_update": False,
        "restore": False,
        "retrieve": True,
        "update": False,
        "versions_destroy": False,
        "versions_list": True,
        "versions_retrieve": True,
    }


def test_models_documents_get_versions_slice_pagination(settings):
    """
    The "get_versions_slice" method should allow navigating all versions of
    the document with pagination.
    """
    settings.DOCUMENT_VERSIONS_PAGE_SIZE = 4

    # Create a document with 7 versions
    document = factories.DocumentFactory()
    for i in range(6):
        document.content = f"bar{i:d}"
        document.save()

    # Add a document version not related to the first document
    factories.DocumentFactory()

    # - Get default max versions
    response = document.get_versions_slice()
    assert response["is_truncated"] is True
    assert len(response["versions"]) == 4
    assert response["next_version_id_marker"] != ""

    expected_keys = ["etag", "is_latest", "last_modified", "version_id"]
    for i in range(4):
        assert list(response["versions"][i].keys()) == expected_keys

    # - Get page 2
    response = document.get_versions_slice(
        from_version_id=response["next_version_id_marker"]
    )
    assert response["is_truncated"] is False
    assert len(response["versions"]) == 2
    assert response["next_version_id_marker"] == ""

    # - Get custom max versions
    response = document.get_versions_slice(page_size=2)
    assert response["is_truncated"] is True
    assert len(response["versions"]) == 2
    assert response["next_version_id_marker"] != ""


def test_models_documents_get_versions_slice_min_datetime():
    """
    The "get_versions_slice" method should filter out versions anterior to
    the from_datetime passed in argument and the current version.
    """
    document = factories.DocumentFactory()
    from_dt = []
    for i in range(6):
        from_dt.append(timezone.now())
        document.content = f"bar{i:d}"
        document.save()

    response = document.get_versions_slice(min_datetime=from_dt[2])

    assert len(response["versions"]) == 3
    for version in response["versions"]:
        assert version["last_modified"] > from_dt[2]

    response = document.get_versions_slice(min_datetime=from_dt[4])

    assert len(response["versions"]) == 1
    assert response["versions"][0]["last_modified"] > from_dt[4]


def test_models_documents_version_duplicate():
    """A new version should be created in object storage only if the content has changed."""
    document = factories.DocumentFactory()

    file_key = str(document.pk)
    response = default_storage.connection.meta.client.list_object_versions(
        Bucket=default_storage.bucket_name, Prefix=file_key
    )
    assert len(response["Versions"]) == 1

    # Save again with the same content
    document.save()

    response = default_storage.connection.meta.client.list_object_versions(
        Bucket=default_storage.bucket_name, Prefix=file_key
    )
    assert len(response["Versions"]) == 1

    # Save modified content
    document.content = "new content"
    document.save()

    response = default_storage.connection.meta.client.list_object_versions(
        Bucket=default_storage.bucket_name, Prefix=file_key
    )
    assert len(response["Versions"]) == 2


def test_models_documents__email_invitation__success():
    """
    The email invitation is sent successfully.
    """
    document = factories.DocumentFactory()

    # pylint: disable-next=no-member
    assert len(mail.outbox) == 0

    sender = factories.UserFactory(full_name="Test Sender", email="sender@example.com")
    document.send_invitation_email(
        "guest@example.com", models.RoleChoices.EDITOR, sender, "en"
    )

    # pylint: disable-next=no-member
    assert len(mail.outbox) == 1

    # pylint: disable-next=no-member
    email = mail.outbox[0]

    assert email.to == ["guest@example.com"]
    email_content = " ".join(email.body.split())

    assert (
        f"Test Sender (sender@example.com) invited you with the role &quot;editor&quot; "
        f"on the following document: {document.title}" in email_content
    )
    assert f"docs/{document.id}/" in email_content


def test_models_documents__email_invitation__success_fr():
    """
    The email invitation is sent successfully in french.
    """
    document = factories.DocumentFactory()

    # pylint: disable-next=no-member
    assert len(mail.outbox) == 0

    sender = factories.UserFactory(
        full_name="Test Sender2", email="sender2@example.com"
    )
    document.send_invitation_email(
        "guest2@example.com",
        models.RoleChoices.OWNER,
        sender,
        "fr-fr",
    )

    # pylint: disable-next=no-member
    assert len(mail.outbox) == 1

    # pylint: disable-next=no-member
    email = mail.outbox[0]

    assert email.to == ["guest2@example.com"]
    email_content = " ".join(email.body.split())

    assert (
        f"Test Sender2 (sender2@example.com) vous a invité avec le rôle &quot;propriétaire&quot; "
        f"sur le document suivant: {document.title}" in email_content
    )
    assert f"docs/{document.id}/" in email_content


@mock.patch(
    "core.models.send_mail",
    side_effect=smtplib.SMTPException("Error SMTPException"),
)
@mock.patch.object(Logger, "error")
def test_models_documents__email_invitation__failed(mock_logger, _mock_send_mail):
    """Check mail behavior when an SMTP error occurs when sent an email invitation."""
    document = factories.DocumentFactory()

    # pylint: disable-next=no-member
    assert len(mail.outbox) == 0

    sender = factories.UserFactory()
    document.send_invitation_email(
        "guest3@example.com",
        models.RoleChoices.ADMIN,
        sender,
        "en",
    )

    # No email has been sent
    # pylint: disable-next=no-member
    assert len(mail.outbox) == 0

    # Logger should be called
    mock_logger.assert_called_once()

    (
        _,
        emails,
        exception,
    ) = mock_logger.call_args.args

    assert emails == ["guest3@example.com"]
    assert isinstance(exception, smtplib.SMTPException)


# Document number of accesses


def test_models_documents_nb_accesses_cache_is_set_and_retrieved(
    django_assert_num_queries,
):
    """Test that nb_accesses is cached after the first computation."""
    document = factories.DocumentFactory()
    key = f"document_{document.id!s}_nb_accesses"
    nb_accesses = random.randint(1, 4)
    factories.UserDocumentAccessFactory.create_batch(nb_accesses, document=document)
    factories.UserDocumentAccessFactory()  # An unrelated access should not be counted

    # Initially, the nb_accesses should not be cached
    assert cache.get(key) is None

    # Compute the nb_accesses for the first time (this should set the cache)
    with django_assert_num_queries(1):
        assert document.nb_accesses == nb_accesses

    # Ensure that the nb_accesses is now cached
    with django_assert_num_queries(0):
        assert document.nb_accesses == nb_accesses
    assert cache.get(key) == nb_accesses

    # The cache value should be invalidated when a document access is created
    models.DocumentAccess.objects.create(
        document=document, user=factories.UserFactory(), role="reader"
    )
    assert cache.get(key) is None  # Cache should be invalidated
    with django_assert_num_queries(1):
        new_nb_accesses = document.nb_accesses
    assert new_nb_accesses == nb_accesses + 1
    assert cache.get(key) == new_nb_accesses  # Cache should now contain the new value


def test_models_documents_nb_accesses_cache_is_invalidated_on_access_removal(
    django_assert_num_queries,
):
    """Test that the cache is invalidated when a document access is deleted."""
    document = factories.DocumentFactory()
    key = f"document_{document.id!s}_nb_accesses"
    access = factories.UserDocumentAccessFactory(document=document)

    # Initially, the nb_accesses should be cached
    assert document.nb_accesses == 1
    assert cache.get(key) == 1

    # Remove the access and check if cache is invalidated
    access.delete()
    assert cache.get(key) is None  # Cache should be invalidated

    # Recompute the nb_accesses (this should trigger a cache set)
    with django_assert_num_queries(1):
        new_nb_accesses = document.nb_accesses
    assert new_nb_accesses == 0
    assert cache.get(key) == 0  # Cache should now contain the new value
