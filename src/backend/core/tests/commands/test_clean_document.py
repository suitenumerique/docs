"""Unit tests for the `clean_document` management command."""

import random
from unittest import mock
from uuid import uuid4

from django.core.management import CommandError, call_command

import pytest
from botocore.exceptions import ClientError

from core import choices, factories, models
from core.choices import LinkReachChoices, LinkRoleChoices

pytestmark = pytest.mark.django_db


def purged_keys(mock_storage):
    """
    Return the set of object keys whose versions were purged from S3, i.e. the
    keys passed to ``bucket.object_versions.filter(Prefix=...)``.
    """
    return {
        call.kwargs["Prefix"]
        for call in mock_storage.bucket.object_versions.filter.call_args_list
    }


def test_clean_document_with_descendants(settings):
    """The command should reset the root (keeping title) and delete descendants."""
    settings.DEBUG = True

    # Create a root document with subdocuments
    root = factories.DocumentFactory(
        title="Root",
        link_reach=LinkReachChoices.PUBLIC,
        link_role=LinkRoleChoices.EDITOR,
    )
    child = factories.DocumentFactory(
        parent=root,
        title="Child",
        link_reach=LinkReachChoices.AUTHENTICATED,
        link_role=LinkRoleChoices.EDITOR,
    )
    grandchild = factories.DocumentFactory(
        parent=child,
        title="Grandchild",
    )

    # Create accesses and invitations
    factories.UserDocumentAccessFactory.create_batch(
        5,
        document=root,
        role=random.choice(
            [
                role
                for role in choices.RoleChoices
                if role not in choices.PRIVILEGED_ROLES
            ],
        ),
    )
    # One owner role
    factories.UserDocumentAccessFactory(document=root, role=choices.RoleChoices.OWNER)
    factories.UserDocumentAccessFactory(document=child)
    factories.InvitationFactory(document=root)
    factories.InvitationFactory(document=child)
    factories.ThreadFactory.create_batch(5, document=root)

    assert models.Invitation.objects.filter(document=root).exists()
    assert models.Thread.objects.filter(document=root).exists()
    assert models.DocumentAccess.objects.filter(document=root).exists()

    with mock.patch(
        "core.management.commands.clean_document.default_storage"
    ) as mock_storage:
        call_command("clean_document", str(root.id), "--force")

    # Root document should still exist with title kept and other fields reset
    root.refresh_from_db()
    assert root.title == "Root"
    assert root.excerpt is None
    assert root.link_reach == LinkReachChoices.RESTRICTED
    assert root.link_role == LinkRoleChoices.READER
    assert root.attachments == []

    # Accesses and invitations on root should be deleted. Only owner should be kept
    keeping_accesses = list(models.DocumentAccess.objects.filter(document=root))
    assert len(keeping_accesses) == 1
    assert keeping_accesses[0].role == models.RoleChoices.OWNER
    assert not models.Invitation.objects.filter(document=root).exists()
    assert not models.Thread.objects.filter(document=root).exists()

    # Descendants should be deleted entirely
    assert not models.Document.objects.filter(id__in=[child.id, grandchild.id]).exists()

    # Root should have no descendants
    root.refresh_from_db()
    assert root.get_descendants().count() == 0

    # Every version of the 3 document files should have been purged from S3
    assert purged_keys(mock_storage) == {
        root.file_key,
        child.file_key,
        grandchild.file_key,
    }


def test_clean_document_invalid_uuid(settings):
    """The command should raise an error for a non-existent document."""
    settings.DEBUG = True

    fake_id = str(uuid4())
    with pytest.raises(CommandError, match=f"Document {fake_id} does not exist."):
        call_command("clean_document", fake_id, "--force")


def test_clean_document_no_force_in_production(settings):
    """The command should require --force when DEBUG is False."""
    settings.DEBUG = False

    doc = factories.DocumentFactory()
    with pytest.raises(CommandError, match="not meant to be used in production"):
        call_command("clean_document", str(doc.id))


def test_clean_document_resets_has_deleted_children(settings):
    """
    Cleaning a document with a soft-deleted child must leave the root as a
    leaf again: `has_deleted_children` reset and `numchild` back to zero.
    """
    settings.DEBUG = True

    root = factories.DocumentFactory(title="Root")
    child = factories.DocumentFactory(parent=root)
    child.soft_delete()

    root.refresh_from_db()
    assert root.has_deleted_children is True
    assert root.is_leaf() is False

    with mock.patch("core.management.commands.clean_document.default_storage"):
        call_command("clean_document", str(root.id), "--force")

    assert not models.Document.objects.filter(id=child.id).exists()

    root.refresh_from_db()
    assert root.has_deleted_children is False
    assert root.numchild == 0
    assert root.is_leaf() is True


def test_clean_document_clears_root_relations(settings):
    """
    Cleaning a document should also remove its favorites, link traces and
    pending access requests, not only accesses/invitations/threads.
    """
    settings.DEBUG = True

    users = factories.UserFactory.create_batch(3)
    root = factories.DocumentFactory(
        favorited_by=users,
        link_traces=users,
    )
    factories.DocumentAskForAccessFactory.create_batch(2, document=root)

    assert models.DocumentFavorite.objects.filter(document=root).exists()
    assert models.LinkTrace.objects.filter(document=root).exists()
    assert models.DocumentAskForAccess.objects.filter(document=root).exists()

    with mock.patch("core.management.commands.clean_document.default_storage"):
        call_command("clean_document", str(root.id), "--force")

    assert not models.DocumentFavorite.objects.filter(document=root).exists()
    assert not models.LinkTrace.objects.filter(document=root).exists()
    assert not models.DocumentAskForAccess.objects.filter(document=root).exists()


def test_clean_document_single_document(settings):
    """The command should work on a single document without children."""
    settings.DEBUG = True

    doc = factories.DocumentFactory(
        title="Single",
        link_reach=LinkReachChoices.PUBLIC,
        link_role=LinkRoleChoices.EDITOR,
    )
    factories.UserDocumentAccessFactory.create_batch(
        5,
        document=doc,
        role=random.choice(
            [
                role
                for role in choices.RoleChoices
                if role not in choices.PRIVILEGED_ROLES
            ],
        ),
    )
    # One owner role
    factories.UserDocumentAccessFactory(document=doc, role=choices.RoleChoices.OWNER)
    factories.ThreadFactory.create_batch(5, document=doc)
    factories.InvitationFactory(document=doc)

    with mock.patch(
        "core.management.commands.clean_document.default_storage"
    ) as mock_storage:
        call_command("clean_document", str(doc.id), "--force")

    # Accesses and invitations on root should be deleted. Only owner should be kept
    keeping_accesses = list(models.DocumentAccess.objects.filter(document=doc))
    assert len(keeping_accesses) == 1
    assert keeping_accesses[0].role == models.RoleChoices.OWNER
    assert not models.Invitation.objects.filter(document=doc).exists()
    assert not models.Thread.objects.filter(document=doc).exists()

    doc.refresh_from_db()
    assert doc.title == "Single"
    assert doc.excerpt is None
    assert doc.link_reach == LinkReachChoices.RESTRICTED
    assert doc.link_role == LinkRoleChoices.READER
    assert doc.attachments == []

    assert purged_keys(mock_storage) == {doc.file_key}


def test_clean_document_with_title_option(settings):
    """The --title option should update the document title."""
    settings.DEBUG = True

    doc = factories.DocumentFactory(
        title="Old Title",
        link_reach=LinkReachChoices.PUBLIC,
        link_role=LinkRoleChoices.EDITOR,
    )

    with mock.patch("core.management.commands.clean_document.default_storage"):
        call_command("clean_document", str(doc.id), "--force", "--title", "New Title")

    doc.refresh_from_db()
    assert doc.title == "New Title"
    assert doc.excerpt is None
    assert doc.link_reach == LinkReachChoices.RESTRICTED
    assert doc.link_role == LinkRoleChoices.READER
    assert doc.attachments == []


def test_clean_document_deletes_attachments_from_s3(settings):
    """The command should delete attachment files from S3."""
    settings.DEBUG = True

    root = factories.DocumentFactory(
        attachments=["root-id/attachments/file1.png", "root-id/attachments/file2.pdf"],
    )
    child = factories.DocumentFactory(
        parent=root,
        attachments=["child-id/attachments/file3.png"],
    )

    with mock.patch(
        "core.management.commands.clean_document.default_storage"
    ) as mock_storage:
        call_command("clean_document", str(root.id), "--force")

    # Every document file and every attachment key should have been purged
    # (all versions of each key are removed via object_versions.filter().delete())
    assert purged_keys(mock_storage) == {
        root.file_key,
        child.file_key,
        "root-id/attachments/file1.png",
        "root-id/attachments/file2.pdf",
        "child-id/attachments/file3.png",
    }


def test_clean_document_s3_errors_do_not_stop_command(settings):
    """S3 deletion errors should be logged but not stop the command."""
    settings.DEBUG = True

    doc = factories.DocumentFactory(
        attachments=["doc-id/attachments/file1.png"],
    )

    with mock.patch(
        "core.management.commands.clean_document.default_storage"
    ) as mock_storage:
        mock_storage.bucket.object_versions.filter.return_value.delete.side_effect = (
            ClientError(
                {"Error": {"Code": "500", "Message": "Internal Error"}},
                "DeleteObjects",
            )
        )
        # Command should complete without raising
        call_command("clean_document", str(doc.id), "--force")


def test_clean_document_with_options(settings):
    """Run the command using optional argument link_reach and link_role."""

    settings.DEBUG = True

    # Create a root document with subdocuments
    root = factories.DocumentFactory(
        title="Root",
        link_reach=LinkReachChoices.PUBLIC,
        link_role=LinkRoleChoices.READER,
    )
    child = factories.DocumentFactory(
        parent=root,
        title="Child",
        link_reach=LinkReachChoices.AUTHENTICATED,
        link_role=LinkRoleChoices.EDITOR,
    )
    grandchild = factories.DocumentFactory(
        parent=child,
        title="Grandchild",
    )

    # Create accesses and invitations
    factories.UserDocumentAccessFactory.create_batch(
        5,
        document=root,
        role=random.choice(
            [
                role
                for role in choices.RoleChoices
                if role not in choices.PRIVILEGED_ROLES
            ],
        ),
    )
    # One owner role
    factories.UserDocumentAccessFactory(document=root, role=choices.RoleChoices.OWNER)
    factories.UserDocumentAccessFactory(document=child)
    factories.InvitationFactory(document=root)
    factories.InvitationFactory(document=child)
    factories.ThreadFactory.create_batch(5, document=root)

    assert models.Invitation.objects.filter(document=root).exists()
    assert models.Thread.objects.filter(document=root).exists()
    assert models.DocumentAccess.objects.filter(document=root).exists()

    with mock.patch(
        "core.management.commands.clean_document.default_storage"
    ) as mock_storage:
        call_command(
            "clean_document",
            str(root.id),
            "--force",
            "--link_reach",
            "public",
            "--link_role",
            "editor",
        )

    # Root document should still exist with title kept and other fields reset
    root.refresh_from_db()
    assert root.title == "Root"
    assert root.excerpt is None
    assert root.link_reach == LinkReachChoices.PUBLIC
    assert root.link_role == LinkRoleChoices.EDITOR
    assert root.attachments == []

    # Accesses and invitations on root should be deleted. Only owner should be kept
    keeping_accesses = list(models.DocumentAccess.objects.filter(document=root))
    assert len(keeping_accesses) == 1
    assert keeping_accesses[0].role == models.RoleChoices.OWNER
    assert not models.Invitation.objects.filter(document=root).exists()
    assert not models.Thread.objects.filter(document=root).exists()

    # Descendants should be deleted entirely
    assert not models.Document.objects.filter(id__in=[child.id, grandchild.id]).exists()

    # Root should have no descendants
    root.refresh_from_db()
    assert root.get_descendants().count() == 0

    # Every version of the 3 document files should have been purged from S3
    assert purged_keys(mock_storage) == {
        root.file_key,
        child.file_key,
        grandchild.file_key,
    }
