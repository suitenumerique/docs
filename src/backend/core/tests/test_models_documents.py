"""
Unit tests for the Document model
"""
# pylint: disable=too-many-lines

import random
import smtplib
from logging import Logger
from unittest import mock

from django.contrib.auth.models import AnonymousUser
from django.core import mail
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.files.storage import default_storage
from django.test.utils import override_settings
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


@override_settings(
    AI_ALLOW_REACH_FROM=random.choice(["public", "authenticated", "restricted"])
)
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
        "descendants": False,
        "cors_proxy": False,
        "destroy": False,
        "duplicate": False,
        "favorite": False,
        "invite_owner": False,
        "media_auth": False,
        "media_check": False,
        "move": False,
        "link_configuration": False,
        "link_select_options": {
            "authenticated": ["reader", "editor"],
            "public": ["reader", "editor"],
            "restricted": None,
        },
        "partial_update": False,
        "restore": False,
        "retrieve": False,
        "tree": False,
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


@override_settings(
    AI_ALLOW_REACH_FROM=random.choice(["public", "authenticated", "restricted"])
)
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
        "descendants": True,
        "cors_proxy": True,
        "destroy": False,
        "duplicate": True,
        "favorite": is_authenticated,
        "invite_owner": False,
        "link_configuration": False,
        "link_select_options": {
            "authenticated": ["reader", "editor"],
            "public": ["reader", "editor"],
            "restricted": None,
        },
        "media_auth": True,
        "media_check": True,
        "move": False,
        "partial_update": False,
        "restore": False,
        "retrieve": True,
        "tree": True,
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
    assert all(
        value is False
        for key, value in document.get_abilities(user).items()
        if key not in ["link_select_options", "ancestors_links_definition"]
    )


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
        "ai_transform": is_authenticated,
        "ai_translate": is_authenticated,
        "attachment_upload": True,
        "children_create": is_authenticated,
        "children_list": True,
        "collaboration_auth": True,
        "descendants": True,
        "cors_proxy": True,
        "destroy": False,
        "duplicate": True,
        "favorite": is_authenticated,
        "invite_owner": False,
        "link_configuration": False,
        "link_select_options": {
            "authenticated": ["reader", "editor"],
            "public": ["reader", "editor"],
            "restricted": None,
        },
        "media_auth": True,
        "media_check": True,
        "move": False,
        "partial_update": True,
        "restore": False,
        "retrieve": True,
        "tree": True,
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
    assert all(
        value is False
        for key, value in document.get_abilities(user).items()
        if key not in ["link_select_options", "ancestors_links_definition"]
    )


@override_settings(
    AI_ALLOW_REACH_FROM=random.choice(["public", "authenticated", "restricted"])
)
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
        "descendants": True,
        "cors_proxy": True,
        "destroy": True,
        "duplicate": True,
        "favorite": True,
        "invite_owner": True,
        "link_configuration": True,
        "link_select_options": {
            "authenticated": ["reader", "editor"],
            "public": ["reader", "editor"],
            "restricted": None,
        },
        "media_auth": True,
        "media_check": True,
        "move": True,
        "partial_update": True,
        "restore": True,
        "retrieve": True,
        "tree": True,
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


@override_settings(
    AI_ALLOW_REACH_FROM=random.choice(["public", "authenticated", "restricted"])
)
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
        "descendants": True,
        "cors_proxy": True,
        "destroy": False,
        "duplicate": True,
        "favorite": True,
        "invite_owner": False,
        "link_configuration": True,
        "link_select_options": {
            "authenticated": ["reader", "editor"],
            "public": ["reader", "editor"],
            "restricted": None,
        },
        "media_auth": True,
        "media_check": True,
        "move": True,
        "partial_update": True,
        "restore": False,
        "retrieve": True,
        "tree": True,
        "update": True,
        "versions_destroy": True,
        "versions_list": True,
        "versions_retrieve": True,
    }
    with django_assert_num_queries(1):
        assert document.get_abilities(user) == expected_abilities

    document.soft_delete()
    document.refresh_from_db()
    assert all(
        value is False
        for key, value in document.get_abilities(user).items()
        if key not in ["link_select_options", "ancestors_links_definition"]
    )


@override_settings(
    AI_ALLOW_REACH_FROM=random.choice(["public", "authenticated", "restricted"])
)
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
        "descendants": True,
        "cors_proxy": True,
        "destroy": False,
        "duplicate": True,
        "favorite": True,
        "invite_owner": False,
        "link_configuration": False,
        "link_select_options": {
            "authenticated": ["reader", "editor"],
            "public": ["reader", "editor"],
            "restricted": None,
        },
        "media_auth": True,
        "media_check": True,
        "move": False,
        "partial_update": True,
        "restore": False,
        "retrieve": True,
        "tree": True,
        "update": True,
        "versions_destroy": False,
        "versions_list": True,
        "versions_retrieve": True,
    }
    with django_assert_num_queries(1):
        assert document.get_abilities(user) == expected_abilities

    document.soft_delete()
    document.refresh_from_db()
    assert all(
        value is False
        for key, value in document.get_abilities(user).items()
        if key not in ["link_select_options", "ancestors_links_definition"]
    )


@pytest.mark.parametrize("ai_access_setting", ["public", "authenticated", "restricted"])
def test_models_documents_get_abilities_reader_user(
    ai_access_setting, django_assert_num_queries
):
    """Check abilities returned for the reader of a document."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(users=[(user, "reader")])

    access_from_link = (
        document.link_reach != "restricted" and document.link_role == "editor"
    )

    expected_abilities = {
        "accesses_manage": False,
        "accesses_view": True,
        # If you get your editor rights from the link role and not your access role
        # You should not access AI if it's restricted to users with specific access
        "ai_transform": access_from_link and ai_access_setting != "restricted",
        "ai_translate": access_from_link and ai_access_setting != "restricted",
        "attachment_upload": access_from_link,
        "children_create": access_from_link,
        "children_list": True,
        "collaboration_auth": True,
        "descendants": True,
        "cors_proxy": True,
        "destroy": False,
        "duplicate": True,
        "favorite": True,
        "invite_owner": False,
        "link_configuration": False,
        "link_select_options": {
            "authenticated": ["reader", "editor"],
            "public": ["reader", "editor"],
            "restricted": None,
        },
        "media_auth": True,
        "media_check": True,
        "move": False,
        "partial_update": access_from_link,
        "restore": False,
        "retrieve": True,
        "tree": True,
        "update": access_from_link,
        "versions_destroy": False,
        "versions_list": True,
        "versions_retrieve": True,
    }

    with override_settings(AI_ALLOW_REACH_FROM=ai_access_setting):
        with django_assert_num_queries(1):
            assert document.get_abilities(user) == expected_abilities

        document.soft_delete()
        document.refresh_from_db()
        assert all(
            value is False
            for key, value in document.get_abilities(user).items()
            if key not in ["link_select_options", "ancestors_links_definition"]
        )


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
        "descendants": True,
        "cors_proxy": True,
        "destroy": False,
        "duplicate": True,
        "favorite": True,
        "invite_owner": False,
        "link_configuration": False,
        "link_select_options": {
            "authenticated": ["reader", "editor"],
            "public": ["reader", "editor"],
            "restricted": None,
        },
        "media_auth": True,
        "media_check": True,
        "move": False,
        "partial_update": False,
        "restore": False,
        "retrieve": True,
        "tree": True,
        "update": False,
        "versions_destroy": False,
        "versions_list": True,
        "versions_retrieve": True,
    }


@override_settings(AI_ALLOW_REACH_FROM="public")
@pytest.mark.parametrize(
    "is_authenticated,reach",
    [
        (True, "public"),
        (False, "public"),
        (True, "authenticated"),
    ],
)
def test_models_document_get_abilities_ai_access_authenticated(is_authenticated, reach):
    """Validate AI abilities when AI is available to any anonymous user with editor rights."""
    user = factories.UserFactory() if is_authenticated else AnonymousUser()
    document = factories.DocumentFactory(link_reach=reach, link_role="editor")

    abilities = document.get_abilities(user)
    assert abilities["ai_transform"] is True
    assert abilities["ai_translate"] is True


@override_settings(AI_ALLOW_REACH_FROM="authenticated")
@pytest.mark.parametrize(
    "is_authenticated,reach",
    [
        (True, "public"),
        (False, "public"),
        (True, "authenticated"),
    ],
)
def test_models_document_get_abilities_ai_access_public(is_authenticated, reach):
    """Validate AI abilities when AI is available only to authenticated users with editor rights."""
    user = factories.UserFactory() if is_authenticated else AnonymousUser()
    document = factories.DocumentFactory(link_reach=reach, link_role="editor")

    abilities = document.get_abilities(user)
    assert abilities["ai_transform"] == is_authenticated
    assert abilities["ai_translate"] == is_authenticated


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


def test_models_documents__email_invitation__success_empty_title():
    """
    The email invitation is sent successfully.
    """
    document = factories.DocumentFactory(title=None)

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

    assert "Test sender shared a document with you!" in email.subject
    assert (
        "Test Sender (sender@example.com) invited you with the role &quot;editor&quot; "
        "on the following document: Untitled Document" in email_content
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
        f"sur le document suivant : {document.title}" in email_content
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


def test_models_documents_nb_accesses_cache_is_set_and_retrieved_ancestors(
    django_assert_num_queries,
):
    """Test that nb_accesses is cached when calling nb_accesses_ancestors."""
    parent = factories.DocumentFactory()
    document = factories.DocumentFactory(parent=parent)
    key = f"document_{document.id!s}_nb_accesses"
    nb_accesses_parent = random.randint(1, 4)
    factories.UserDocumentAccessFactory.create_batch(
        nb_accesses_parent, document=parent
    )
    nb_accesses_direct = random.randint(1, 4)
    factories.UserDocumentAccessFactory.create_batch(
        nb_accesses_direct, document=document
    )
    factories.UserDocumentAccessFactory()  # An unrelated access should not be counted

    # Initially, the nb_accesses should not be cached
    assert cache.get(key) is None

    # Compute the nb_accesses for the first time (this should set the cache)
    nb_accesses_ancestors = nb_accesses_parent + nb_accesses_direct
    with django_assert_num_queries(2):
        assert document.nb_accesses_ancestors == nb_accesses_ancestors

    # Ensure that the nb_accesses is now cached
    with django_assert_num_queries(0):
        assert document.nb_accesses_ancestors == nb_accesses_ancestors
    assert cache.get(key) == (nb_accesses_direct, nb_accesses_ancestors)

    # The cache value should be invalidated when a document access is created
    models.DocumentAccess.objects.create(
        document=document, user=factories.UserFactory(), role="reader"
    )
    assert cache.get(key) is None  # Cache should be invalidated
    with django_assert_num_queries(2):
        assert document.nb_accesses_ancestors == nb_accesses_ancestors + 1
    assert cache.get(key) == (nb_accesses_direct + 1, nb_accesses_ancestors + 1)


def test_models_documents_nb_accesses_cache_is_set_and_retrieved_direct(
    django_assert_num_queries,
):
    """Test that nb_accesses is cached when calling nb_accesses_direct."""
    parent = factories.DocumentFactory()
    document = factories.DocumentFactory(parent=parent)
    key = f"document_{document.id!s}_nb_accesses"
    nb_accesses_parent = random.randint(1, 4)
    factories.UserDocumentAccessFactory.create_batch(
        nb_accesses_parent, document=parent
    )
    nb_accesses_direct = random.randint(1, 4)
    factories.UserDocumentAccessFactory.create_batch(
        nb_accesses_direct, document=document
    )
    factories.UserDocumentAccessFactory()  # An unrelated access should not be counted

    # Initially, the nb_accesses should not be cached
    assert cache.get(key) is None

    # Compute the nb_accesses for the first time (this should set the cache)
    nb_accesses_ancestors = nb_accesses_parent + nb_accesses_direct
    with django_assert_num_queries(2):
        assert document.nb_accesses_direct == nb_accesses_direct

    # Ensure that the nb_accesses is now cached
    with django_assert_num_queries(0):
        assert document.nb_accesses_direct == nb_accesses_direct
    assert cache.get(key) == (nb_accesses_direct, nb_accesses_ancestors)

    # The cache value should be invalidated when a document access is created
    models.DocumentAccess.objects.create(
        document=document, user=factories.UserFactory(), role="reader"
    )
    assert cache.get(key) is None  # Cache should be invalidated
    with django_assert_num_queries(2):
        assert document.nb_accesses_direct == nb_accesses_direct + 1
    assert cache.get(key) == (nb_accesses_direct + 1, nb_accesses_ancestors + 1)


@pytest.mark.parametrize("field", ["nb_accesses_ancestors", "nb_accesses_direct"])
def test_models_documents_nb_accesses_cache_is_invalidated_on_access_removal(
    field,
    django_assert_num_queries,
):
    """Test that the cache is invalidated when a document access is deleted."""
    document = factories.DocumentFactory()
    key = f"document_{document.id!s}_nb_accesses"
    access = factories.UserDocumentAccessFactory(document=document)

    # Initially, the nb_accesses should be cached
    assert getattr(document, field) == 1
    assert cache.get(key) == (1, 1)

    # Remove the access and check if cache is invalidated
    access.delete()
    assert cache.get(key) is None  # Cache should be invalidated

    # Recompute the nb_accesses (this should trigger a cache set)
    with django_assert_num_queries(2):
        new_nb_accesses = getattr(document, field)
    assert new_nb_accesses == 0
    assert cache.get(key) == (0, 0)  # Cache should now contain the new value


@pytest.mark.parametrize("field", ["nb_accesses_ancestors", "nb_accesses_direct"])
def test_models_documents_nb_accesses_cache_is_invalidated_on_document_soft_delete_restore(
    field,
    django_assert_num_queries,
):
    """Test that the cache is invalidated when a document access is deleted."""
    document = factories.DocumentFactory()
    key = f"document_{document.id!s}_nb_accesses"
    factories.UserDocumentAccessFactory(document=document)

    # Initially, the nb_accesses should be cached
    assert getattr(document, field) == 1
    assert cache.get(key) == (1, 1)

    # Soft delete the document and check if cache is invalidated
    document.soft_delete()
    assert cache.get(key) is None  # Cache should be invalidated

    # Recompute the nb_accesses (this should trigger a cache set)
    with django_assert_num_queries(2):
        new_nb_accesses = getattr(document, field)
    assert new_nb_accesses == (1 if field == "nb_accesses_direct" else 0)
    assert cache.get(key) == (1, 0)  # Cache should now contain the new value

    document.restore()

    # Recompute the nb_accesses (this should trigger a cache set)
    with django_assert_num_queries(2):
        new_nb_accesses = getattr(document, field)
    assert new_nb_accesses == 1
    assert cache.get(key) == (1, 1)  # Cache should now contain the new value


def test_models_documents_numchild_deleted_from_instance():
    """the "numchild" field should not include documents deleted from the instance."""
    document = factories.DocumentFactory()
    child1, _child2 = factories.DocumentFactory.create_batch(2, parent=document)
    assert document.numchild == 2

    child1.delete()

    document.refresh_from_db()
    assert document.numchild == 1


def test_models_documents_numchild_deleted_from_queryset():
    """the "numchild" field should not include documents deleted from a queryset."""
    document = factories.DocumentFactory()
    child1, _child2 = factories.DocumentFactory.create_batch(2, parent=document)
    assert document.numchild == 2

    models.Document.objects.filter(pk=child1.pk).delete()

    document.refresh_from_db()
    assert document.numchild == 1


def test_models_documents_numchild_soft_deleted_and_restore():
    """the "numchild" field should not include soft deleted documents."""
    document = factories.DocumentFactory()
    child1, _child2 = factories.DocumentFactory.create_batch(2, parent=document)

    assert document.numchild == 2

    child1.soft_delete()

    document.refresh_from_db()
    assert document.numchild == 1

    child1.restore()

    document.refresh_from_db()
    assert document.numchild == 2


def test_models_documents_soft_delete_tempering_with_instance():
    """
    Soft deleting should fail if the document is already deleted in database even though the
    instance "deleted_at" attributes where tempered with.
    """
    document = factories.DocumentFactory()
    document.soft_delete()

    document.deleted_at = None
    document.ancestors_deleted_at = None
    with pytest.raises(
        RuntimeError, match="This document is already deleted or has deleted ancestors."
    ):
        document.soft_delete()


def test_models_documents_restore_tempering_with_instance():
    """
    Soft deleting should fail if the document is already deleted in database even though the
    instance "deleted_at" attributes where tempered with.
    """
    document = factories.DocumentFactory()

    if random.choice([False, True]):
        document.deleted_at = timezone.now()
    else:
        document.ancestors_deleted_at = timezone.now()

    with pytest.raises(RuntimeError, match="This document is not deleted."):
        document.restore()


def test_models_documents_restore(django_assert_num_queries):
    """The restore method should restore a soft-deleted document."""
    document = factories.DocumentFactory()
    document.soft_delete()
    document.refresh_from_db()
    assert document.deleted_at is not None
    assert document.ancestors_deleted_at == document.deleted_at

    with django_assert_num_queries(8):
        document.restore()
    document.refresh_from_db()
    assert document.deleted_at is None
    assert document.ancestors_deleted_at == document.deleted_at


def test_models_documents_restore_complex(django_assert_num_queries):
    """The restore method should restore a soft-deleted document and its ancestors."""
    grand_parent = factories.DocumentFactory()
    parent = factories.DocumentFactory(parent=grand_parent)
    document = factories.DocumentFactory(parent=parent)

    child1 = factories.DocumentFactory(parent=document)
    child2 = factories.DocumentFactory(parent=document)

    # Soft delete first the document
    document.soft_delete()
    document.refresh_from_db()
    child1.refresh_from_db()
    child2.refresh_from_db()
    assert document.deleted_at is not None
    assert document.ancestors_deleted_at == document.deleted_at
    assert child1.ancestors_deleted_at == document.deleted_at
    assert child2.ancestors_deleted_at == document.deleted_at

    # Soft delete the grand parent
    grand_parent.soft_delete()
    grand_parent.refresh_from_db()
    parent.refresh_from_db()
    assert grand_parent.deleted_at is not None
    assert grand_parent.ancestors_deleted_at == grand_parent.deleted_at
    assert parent.ancestors_deleted_at == grand_parent.deleted_at
    # item, child1 and child2 should not be affected
    document.refresh_from_db()
    child1.refresh_from_db()
    child2.refresh_from_db()
    assert document.deleted_at is not None
    assert document.ancestors_deleted_at == document.deleted_at
    assert child1.ancestors_deleted_at == document.deleted_at
    assert child2.ancestors_deleted_at == document.deleted_at

    # Restore the item
    with django_assert_num_queries(11):
        document.restore()
    document.refresh_from_db()
    child1.refresh_from_db()
    child2.refresh_from_db()
    grand_parent.refresh_from_db()
    assert document.deleted_at is None
    assert document.ancestors_deleted_at == grand_parent.deleted_at
    # child 1 and child 2 should now have the same ancestors_deleted_at as the grand parent
    assert child1.ancestors_deleted_at == grand_parent.deleted_at
    assert child2.ancestors_deleted_at == grand_parent.deleted_at


def test_models_documents_restore_complex_bis(django_assert_num_queries):
    """The restore method should restore a soft-deleted item and its ancestors."""
    grand_parent = factories.DocumentFactory()
    parent = factories.DocumentFactory(parent=grand_parent)
    document = factories.DocumentFactory(parent=parent)

    child1 = factories.DocumentFactory(parent=document)
    child2 = factories.DocumentFactory(parent=document)

    # Soft delete first the document
    document.soft_delete()
    document.refresh_from_db()
    child1.refresh_from_db()
    child2.refresh_from_db()
    assert document.deleted_at is not None
    assert document.ancestors_deleted_at == document.deleted_at
    assert child1.ancestors_deleted_at == document.deleted_at
    assert child2.ancestors_deleted_at == document.deleted_at

    # Soft delete the grand parent
    grand_parent.soft_delete()
    grand_parent.refresh_from_db()
    parent.refresh_from_db()
    assert grand_parent.deleted_at is not None
    assert grand_parent.ancestors_deleted_at == grand_parent.deleted_at
    assert parent.ancestors_deleted_at == grand_parent.deleted_at
    # item, child1 and child2 should not be affected
    document.refresh_from_db()
    child1.refresh_from_db()
    child2.refresh_from_db()
    assert document.deleted_at is not None
    assert document.ancestors_deleted_at == document.deleted_at
    assert child1.ancestors_deleted_at == document.deleted_at
    assert child2.ancestors_deleted_at == document.deleted_at

    # Restoring the grand parent should not restore the document
    # as it was deleted before the grand parent
    with django_assert_num_queries(9):
        grand_parent.restore()

    grand_parent.refresh_from_db()
    parent.refresh_from_db()
    document.refresh_from_db()
    child1.refresh_from_db()
    child2.refresh_from_db()
    assert grand_parent.deleted_at is None
    assert grand_parent.ancestors_deleted_at is None
    assert parent.deleted_at is None
    assert parent.ancestors_deleted_at is None
    assert document.deleted_at is not None
    assert document.ancestors_deleted_at == document.deleted_at
    assert child1.ancestors_deleted_at == document.deleted_at
    assert child2.ancestors_deleted_at == document.deleted_at


@pytest.mark.parametrize(
    "reach, role, select_options",
    [
        # One ancestor
        (
            "public",
            "reader",
            {
                "public": ["reader", "editor"],
            },
        ),
        ("public", "editor", {"public": ["editor"]}),
        (
            "authenticated",
            "reader",
            {
                "authenticated": ["reader", "editor"],
                "public": ["reader", "editor"],
            },
        ),
        (
            "authenticated",
            "editor",
            {"authenticated": ["editor"], "public": ["reader", "editor"]},
        ),
        (
            "restricted",
            "reader",
            {
                "restricted": None,
                "authenticated": ["reader", "editor"],
                "public": ["reader", "editor"],
            },
        ),
        (
            "restricted",
            "editor",
            {
                "restricted": None,
                "authenticated": ["reader", "editor"],
                "public": ["reader", "editor"],
            },
        ),
        # No ancestors (edge case)
        (
            "public",
            None,
            {
                "public": ["reader", "editor"],
                "authenticated": ["reader", "editor"],
                "restricted": None,
            },
        ),
        (
            None,
            "reader",
            {
                "public": ["reader", "editor"],
                "authenticated": ["reader", "editor"],
                "restricted": None,
            },
        ),
        (
            None,
            None,
            {
                "public": ["reader", "editor"],
                "authenticated": ["reader", "editor"],
                "restricted": None,
            },
        ),
    ],
)
def test_models_documents_get_select_options(reach, role, select_options):
    """Validate that the "get_select_options" method operates as expected."""
    assert models.LinkReachChoices.get_select_options(reach, role) == select_options


def test_models_documents_compute_ancestors_links_paths_mapping_single(
    django_assert_num_queries,
):
    """Test the compute_ancestors_links_paths_mapping method on a single document."""
    document = factories.DocumentFactory(link_reach="public")
    with django_assert_num_queries(1):
        assert document.compute_ancestors_links_paths_mapping() == {
            document.path: [{"link_reach": "public", "link_role": document.link_role}]
        }


def test_models_documents_compute_ancestors_links_paths_mapping_structure(
    django_assert_num_queries,
):
    """Test the compute_ancestors_links_paths_mapping method on a tree of documents."""
    user = factories.UserFactory()
    other_user = factories.UserFactory()

    root = factories.DocumentFactory(link_reach="restricted", users=[user])
    document = factories.DocumentFactory(
        parent=root,
        link_reach="authenticated",
        link_role="editor",
        users=[user, other_user],
    )
    sibling = factories.DocumentFactory(parent=root, link_reach="public", users=[user])
    child = factories.DocumentFactory(
        parent=document,
        link_reach="authenticated",
        link_role="reader",
        users=[user, other_user],
    )

    # Child
    with django_assert_num_queries(1):
        assert child.compute_ancestors_links_paths_mapping() == {
            root.path: [{"link_reach": "restricted", "link_role": root.link_role}],
            document.path: [
                {"link_reach": "restricted", "link_role": root.link_role},
                {"link_reach": document.link_reach, "link_role": document.link_role},
            ],
            child.path: [
                {"link_reach": "restricted", "link_role": root.link_role},
                {"link_reach": document.link_reach, "link_role": document.link_role},
                {"link_reach": child.link_reach, "link_role": child.link_role},
            ],
        }

    # Sibling
    with django_assert_num_queries(1):
        assert sibling.compute_ancestors_links_paths_mapping() == {
            root.path: [{"link_reach": "restricted", "link_role": root.link_role}],
            sibling.path: [
                {"link_reach": "restricted", "link_role": root.link_role},
                {"link_reach": sibling.link_reach, "link_role": sibling.link_role},
            ],
        }
