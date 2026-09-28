"""
Unit tests for the User model
"""

import uuid
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch

from django.core.exceptions import ValidationError
from django.db import DatabaseError, connection
from django.test.utils import override_settings

import pytest

from core import factories, models

pytestmark = pytest.mark.django_db


def test_models_users_str():
    """The str representation should be the email."""
    user = factories.UserFactory()
    assert str(user) == user.email


def test_models_users_id_unique():
    """The "id" field should be unique."""
    user = factories.UserFactory()
    with pytest.raises(ValidationError, match="User with this Id already exists."):
        factories.UserFactory(id=user.id)


@pytest.mark.parametrize(
    "sub,is_valid",
    [
        ("valid_sub.@+-:=/", True),
        ("invalid süb", False),
        (12345, True),
    ],
)
def test_models_users_sub_validator(sub, is_valid):
    """The "sub" field should be validated."""
    user = factories.UserFactory()
    user.sub = sub
    if is_valid:
        user.full_clean()
    else:
        with pytest.raises(
            ValidationError,
            match=("Enter a valid sub. This value should be ASCII only."),
        ):
            user.full_clean()


def test_modes_users_convert_valid_invitations():
    """
    The "convert_valid_invitations" method should convert valid invitations to document accesses.
    """
    email = "test@example.com"
    document = factories.DocumentFactory()
    other_document = factories.DocumentFactory()
    invitation_document = factories.InvitationFactory(email=email, document=document)
    invitation_other_document = factories.InvitationFactory(
        email="Test@example.coM", document=other_document
    )
    other_email_invitation = factories.InvitationFactory(
        email="pre_test@example.com", document=document
    )

    assert document.accesses.count() == 0
    assert other_document.accesses.count() == 0

    user = factories.UserFactory(email=email)

    assert document.accesses.filter(user=user).count() == 1
    assert other_document.accesses.filter(user=user).count() == 1

    assert not models.Invitation.objects.filter(id=invitation_document.id).exists()
    assert not models.Invitation.objects.filter(
        id=invitation_other_document.id
    ).exists()
    assert models.Invitation.objects.filter(id=other_email_invitation.id).exists()


@override_settings(USER_ONBOARDING_DOCUMENTS=[])
def test_models_users_handle_onboarding_documents_access_empty_setting():
    """
    When USER_ONBOARDING_DOCUMENTS is empty, no accesses should be created.
    """
    user = factories.UserFactory()
    assert models.DocumentAccess.objects.filter(user=user).count() == 0


def test_models_users_handle_onboarding_document_link_trace_with_single_document():
    """
    When USER_ONBOARDING_DOCUMENTS has a valid document ID,
    a LinkTrace should be created for the new user.

    The document should be pinned as a favorite for the user.
    """
    document = factories.DocumentFactory(link_reach=models.LinkReachChoices.PUBLIC)

    with override_settings(USER_ONBOARDING_DOCUMENTS=[str(document.id)]):
        user = factories.UserFactory()

    assert models.LinkTrace.objects.filter(user=user, document=document).count() == 1

    user_favorites = models.DocumentFavorite.objects.filter(user=user)
    assert user_favorites.count() == 1
    assert user_favorites.filter(document=document).exists()


def test_models_users_handle_onboarding_documents_access_with_multiple_documents():
    """
    When USER_ONBOARDING_DOCUMENTS has multiple valid document IDs,
    accesses should be created for all documents.

    All accesses should have the READER role.
    All documents should be pinned as favorites for the user.
    """
    document1 = factories.DocumentFactory(
        title="Document 1", link_reach=models.LinkReachChoices.PUBLIC
    )
    document2 = factories.DocumentFactory(
        title="Document 2", link_reach=models.LinkReachChoices.AUTHENTICATED
    )
    document3 = factories.DocumentFactory(
        title="Document 3", link_reach=models.LinkReachChoices.PUBLIC
    )

    with override_settings(
        USER_ONBOARDING_DOCUMENTS=[
            str(document1.id),
            str(document2.id),
            str(document3.id),
        ]
    ):
        user = factories.UserFactory()

    link_traces = models.LinkTrace.objects.filter(user=user)
    assert link_traces.count() == 3

    assert models.LinkTrace.objects.filter(user=user, document=document1).exists()
    assert models.LinkTrace.objects.filter(user=user, document=document2).exists()
    assert models.LinkTrace.objects.filter(user=user, document=document3).exists()

    user_favorites = models.DocumentFavorite.objects.filter(user=user)
    assert user_favorites.count() == 3
    assert user_favorites.filter(document=document1).exists()
    assert user_favorites.filter(document=document2).exists()
    assert user_favorites.filter(document=document3).exists()


def test_models_users_handle_onboarding_documents_access_with_invalid_document_id():
    """
    When USER_ONBOARDING_DOCUMENTS has an invalid document ID,
    it should be skipped and logged, but not raise an exception.
    """
    invalid_id = uuid.uuid4()

    with override_settings(USER_ONBOARDING_DOCUMENTS=[str(invalid_id)]):
        with patch("core.models.logger") as mock_logger:
            user = factories.UserFactory()

            mock_logger.warning.assert_called_once()
            call_args = mock_logger.warning.call_args
            assert "Onboarding document with id" in call_args[0][0]

    assert models.LinkTrace.objects.filter(user=user).count() == 0


def test_models_users_handle_onboarding_documents_access_duplicate_prevention():
    """
    If the same document is listed multiple times in USER_ONBOARDING_DOCUMENTS,
    it should only create one access (or handle duplicates gracefully).
    """
    document = factories.DocumentFactory(link_reach=models.LinkReachChoices.PUBLIC)

    with override_settings(
        USER_ONBOARDING_DOCUMENTS=[str(document.id), str(document.id)]
    ):
        user = factories.UserFactory()

    link_traces = models.LinkTrace.objects.filter(user=user, document=document)

    assert link_traces.count() == 1


def test_models_users_handle_onboarding_documents_on_restricted_document_is_not_allowed():
    """On-boarding document can be used when restricted"""

    document = factories.DocumentFactory(link_reach=models.LinkReachChoices.RESTRICTED)
    with override_settings(USER_ONBOARDING_DOCUMENTS=[str(document.id)]):
        user = factories.UserFactory()

    assert not models.LinkTrace.objects.filter(user=user, document=document).exists()


def test_models_users_handle_onboarding_documents_computed_link_reach_not_restricted():
    """Test that the computed_link_reach is used to check the real link_reach is used."""

    parent = factories.DocumentFactory(link_reach=models.LinkReachChoices.PUBLIC)
    document = factories.DocumentFactory(
        parent=parent, link_reach=models.LinkReachChoices.RESTRICTED
    )

    assert document.computed_link_reach == models.LinkReachChoices.PUBLIC

    with override_settings(USER_ONBOARDING_DOCUMENTS=[str(document.id)]):
        user = factories.UserFactory()

    assert models.LinkTrace.objects.filter(user=user, document=document).exists()
    user_favorites = models.DocumentFavorite.objects.filter(user=user)
    assert user_favorites.count() == 1
    assert user_favorites.filter(document=document).exists()


@override_settings(USER_ONBOARDING_SANDBOX_DOCUMENT=None)
def test_models_users_duplicate_onboarding_sandbox_document_no_setting():
    """
    When USER_ONBOARDING_SANDBOX_DOCUMENT is not set, no sandbox document should be created.
    """
    user = factories.UserFactory()

    assert (
        models.Document.objects.filter(creator=user, title__icontains="Sandbox").count()
        == 0
    )

    initial_accesses = models.DocumentAccess.objects.filter(user=user).count()
    assert initial_accesses == 0


def test_models_users_duplicate_onboarding_sandbox_document_creates_sandbox():
    """
    When USER_ONBOARDING_SANDBOX_DOCUMENT is set with a valid template document,
    a new sandbox document should be created for the user with OWNER access.
    """
    documents_before = factories.DocumentFactory.create_batch(20)
    template_document = factories.DocumentFactory(title="Getting started with Docs")
    documents_after = factories.DocumentFactory.create_batch(20)

    all_documents = documents_before + [template_document] + documents_after

    paths = {document.pk: document.path for document in all_documents}

    with override_settings(USER_ONBOARDING_SANDBOX_DOCUMENT=str(template_document.id)):
        user = factories.UserFactory()

    sandbox_docs = models.Document.objects.filter(
        creator=user, title="Getting started with Docs"
    )
    assert sandbox_docs.count() == 1

    sandbox_doc = sandbox_docs.first()
    assert sandbox_doc.creator == user
    assert sandbox_doc.duplicated_from == template_document

    access = models.DocumentAccess.objects.get(user=user, document=sandbox_doc)
    assert access.role == models.RoleChoices.OWNER

    for document in all_documents:
        document.refresh_from_db()
        assert document.path == paths[document.id]


def test_models_users_duplicate_onboarding_sandbox_document_with_invalid_template_id():
    """
    When USER_ONBOARDING_SANDBOX_DOCUMENT has an invalid document ID,
    it should be skipped and logged, but not raise an exception.
    """
    invalid_id = uuid.uuid4()

    with override_settings(USER_ONBOARDING_SANDBOX_DOCUMENT=str(invalid_id)):
        with patch("core.models.logger") as mock_logger:
            user = factories.UserFactory()

            mock_logger.warning.assert_called_once()
            call_args = mock_logger.warning.call_args
            assert "Onboarding sandbox document with id" in call_args[0][0]

    sandbox_docs = models.Document.objects.filter(creator=user)
    assert sandbox_docs.count() == 0


def test_models_users_duplicate_onboarding_sandbox_document_creates_unique_sandbox_per_user():
    """
    Each new user should get their own independent sandbox document.
    """
    template_document = factories.DocumentFactory(title="Getting started with Docs")

    with override_settings(USER_ONBOARDING_SANDBOX_DOCUMENT=str(template_document.id)):
        user1 = factories.UserFactory()
        user2 = factories.UserFactory()

    sandbox_docs_user1 = models.Document.objects.filter(
        creator=user1, title="Getting started with Docs"
    )
    sandbox_docs_user2 = models.Document.objects.filter(
        creator=user2, title="Getting started with Docs"
    )

    assert sandbox_docs_user1.count() == 1
    assert sandbox_docs_user2.count() == 1

    assert sandbox_docs_user1.first().id != sandbox_docs_user2.first().id


def test_models_users_duplicate_onboarding_sandbox_document_integration_with_other_methods():
    """
    Verify that sandbox creation works alongside other onboarding methods.
    """
    template_document = factories.DocumentFactory(title="Getting started with Docs")
    onboarding_doc = factories.DocumentFactory(
        title="Onboarding Document", link_reach=models.LinkReachChoices.AUTHENTICATED
    )

    with override_settings(
        USER_ONBOARDING_SANDBOX_DOCUMENT=str(template_document.id),
        USER_ONBOARDING_DOCUMENTS=[str(onboarding_doc.id)],
    ):
        user = factories.UserFactory()

    sandbox_doc = models.Document.objects.filter(
        creator=user, title="Getting started with Docs"
    ).first()

    assert models.DocumentAccess.objects.filter(user=user).count() == 1
    assert models.LinkTrace.objects.filter(user=user).count() == 1

    assert models.DocumentAccess.objects.filter(
        document=sandbox_doc, user=user, role=models.RoleChoices.OWNER
    ).exists()
    assert models.LinkTrace.objects.filter(document=onboarding_doc, user=user).exists()


@pytest.mark.django_db(transaction=True)
def test_models_users_duplicate_onboarding_sandbox_race_condition():
    """
    It should be possible to create several documents at the same time
    without causing any race conditions or data integrity issues.
    """

    def create_user():
        try:
            return factories.UserFactory()
        finally:
            # Each worker thread gets its own thread-local database connection.
            # Close it explicitly so it does not linger and block dropping the
            # test database during teardown (OperationalError: "database is being
            # accessed by other users").
            connection.close()

    template_document = factories.DocumentFactory(title="Getting started with Docs")
    with (
        override_settings(
            USER_ONBOARDING_SANDBOX_DOCUMENT=str(template_document.id),
        ),
        ThreadPoolExecutor(max_workers=2) as executor,
    ):
        future1 = executor.submit(create_user)
        future2 = executor.submit(create_user)

        user1 = future1.result()
        user2 = future2.result()

        assert isinstance(user1, models.User)
        assert isinstance(user2, models.User)


@pytest.mark.django_db(transaction=True)
def test_task_user_delete():
    """test user_delete task with a complete scenario"""

    user_to_delete = factories.UserFactory()
    other_user = factories.UserFactory()

    # Documents where the user is the sole owner
    documents_to_delete = factories.DocumentFactory.create_batch(
        3, creator=user_to_delete, users=[(user_to_delete, models.RoleChoices.OWNER)]
    )
    # Documents where the user is not the sole owner
    documents_to_keep = factories.DocumentFactory.create_batch(
        4,
        creator=other_user,
        users=[
            (user_to_delete, models.RoleChoices.OWNER),
            (other_user, models.RoleChoices.OWNER),
        ],
    )
    # descendants of a document to delete should also be removed
    depth = 5
    for _ in range(depth + 1):
        documents_to_delete.append(
            factories.DocumentFactory(parent=documents_to_delete[-1])
        )

    # Documents created by the user to delete and should be set to null
    documents_creator_set_to_null = factories.DocumentFactory.create_batch(
        3, creator=user_to_delete
    )

    # Non creator nor owner document but with accesses to delete
    for role in models.RoleChoices.values:
        if role == models.RoleChoices.OWNER.value:
            continue

        factories.DocumentFactory(users=[(user_to_delete, role)])

    # create 3 link traces
    #
    factories.DocumentFactory.create_batch(3, link_traces=[user_to_delete, other_user])
    # Create other link traces for the other user
    #
    factories.DocumentFactory.create_batch(3, link_traces=[other_user])

    # Threads created by the user to delete should be set to null
    threads_owned_by_user_to_delete = factories.ThreadFactory.create_batch(
        2, creator=user_to_delete
    )
    # Threads created by the other user should not change
    threads_owned_by_other_user = factories.ThreadFactory.create_batch(
        2, creator=other_user
    )

    # create comments for both users in all existing threads
    comments = []
    for thread in threads_owned_by_user_to_delete + threads_owned_by_other_user:
        comments.append(factories.CommentFactory(thread=thread, user=user_to_delete))
        comments.append(factories.CommentFactory(thread=thread, user=other_user))

    assert models.DocumentAccess.objects.filter(user=user_to_delete).count() == 11
    assert models.Document.objects.all().count() == 30
    assert models.LinkTrace.objects.all().count() == 9
    assert models.Thread.objects.all().count() == 4
    assert models.Comment.objects.all().count() == 8
    assert len(documents_to_delete) == 9

    user_to_delete.delete()

    for document in documents_to_delete:
        assert models.Document.objects.filter(id=document.id).exists() is False

    for document in documents_to_keep:
        assert models.Document.objects.filter(id=document.id).exists()

    for document in documents_creator_set_to_null:
        document.refresh_from_db()
        assert document.creator is None

    assert models.DocumentAccess.objects.filter(user_id=user_to_delete.id).count() == 0
    assert (
        models.Document.objects.all().count() == 21
    )  # models.Document.objects.all().count() - len(documents_to_delete)
    assert models.LinkTrace.objects.all().count() == 6

    # Number of threads and comments should not have changed
    assert models.Thread.objects.all().count() == 4
    assert models.Comment.objects.all().count() == 8

    for thread in threads_owned_by_user_to_delete:
        thread.refresh_from_db()
        assert thread.creator is None

        assert (
            models.Comment.objects.filter(thread=thread, user__isnull=True).count() == 1
        )
        assert (
            models.Comment.objects.filter(thread=thread, user=other_user).count() == 1
        )

    for thread in threads_owned_by_other_user:
        thread.refresh_from_db()
        assert thread.creator == other_user
        assert (
            models.Comment.objects.filter(thread=thread, user__isnull=True).count() == 1
        )
        assert (
            models.Comment.objects.filter(thread=thread, user=other_user).count() == 1
        )

    assert models.User.objects.filter(id=user_to_delete.id).exists() is False


@pytest.mark.django_db(transaction=True)
def test_tasks_user_delete_nothing_to_delete():
    """Delete a user not having creating data yet."""

    user_to_delete = factories.UserFactory()
    other_user = factories.UserFactory()

    factories.DocumentFactory.create_batch(
        4,
        creator=other_user,
        users=[
            (other_user, models.RoleChoices.OWNER),
        ],
    )

    # Create other link traces for the other user
    #
    factories.DocumentFactory.create_batch(3, link_traces=[other_user])

    threads_owned_by_other_user = factories.ThreadFactory.create_batch(
        2, creator=other_user
    )

    # create comments for bot users in all existing threads
    comments = []
    for thread in threads_owned_by_other_user:
        comments.append(factories.CommentFactory(thread=thread, user=other_user))

    assert models.DocumentAccess.objects.count() == 4
    assert models.Document.objects.all().count() == 9
    assert models.LinkTrace.objects.all().count() == 3
    assert models.Thread.objects.all().count() == 2
    assert models.Comment.objects.all().count() == 2

    user_to_delete.delete()

    assert models.DocumentAccess.objects.count() == 4
    assert models.Document.objects.all().count() == 9
    assert models.LinkTrace.objects.all().count() == 3
    assert models.Thread.objects.all().count() == 2
    assert models.Comment.objects.all().count() == 2
    assert models.User.objects.filter(id=user_to_delete.id).exists() is False


@pytest.mark.django_db(transaction=True)
def test_tasks_user_delete_only_owner_but_not_creator():
    """Test delete a user who is sole owner of a document but not the creator should work."""

    user_to_delete = factories.UserFactory()
    other_user = factories.UserFactory()

    document_to_delete = factories.DocumentFactory(
        creator=other_user, users=[(user_to_delete, models.RoleChoices.OWNER)]
    )

    document_to_keep = factories.DocumentFactory(
        creator=other_user,
        users=[
            (other_user, models.RoleChoices.OWNER),
            (user_to_delete, models.RoleChoices.OWNER),
        ],
    )

    assert models.DocumentAccess.objects.filter(user=user_to_delete).count() == 2
    assert models.Document.objects.all().count() == 2

    user_to_delete.delete()

    assert models.DocumentAccess.objects.filter(user_id=user_to_delete.id).count() == 0
    assert models.Document.objects.all().count() == 1

    assert models.Document.objects.filter(id=document_to_delete.id).exists() is False
    assert models.Document.objects.filter(id=document_to_keep.id).exists() is True

    assert models.User.objects.filter(id=user_to_delete.id).exists() is False


@pytest.mark.django_db(transaction=True)
def test_tasks_user_delete_error_during_deletion_should_rollback_deletion(monkeypatch):
    """Test transaction is correctly working by forcing an error during user deletion."""

    user_to_delete = factories.UserFactory()
    other_user = factories.UserFactory()

    # Documents where the user is the sole owner
    documents_to_delete = factories.DocumentFactory.create_batch(
        3, creator=user_to_delete, users=[(user_to_delete, models.RoleChoices.OWNER)]
    )
    # Documents where the user is not the sole owner
    factories.DocumentFactory.create_batch(
        4,
        creator=other_user,
        users=[
            (user_to_delete, models.RoleChoices.OWNER),
            (other_user, models.RoleChoices.OWNER),
        ],
    )
    # descendants of a document to delete should also be removed
    depth = 5
    for _ in range(depth + 1):
        documents_to_delete.append(
            factories.DocumentFactory(parent=documents_to_delete[-1])
        )

    # Documents created by the user to delete and should be set to null
    factories.DocumentFactory.create_batch(3, creator=user_to_delete)

    # Non creator nor owner document but with accesses to delete
    for role in models.RoleChoices.values:
        if role == models.RoleChoices.OWNER.value:
            continue

        factories.DocumentFactory(users=[(user_to_delete, role)])

    # create 3 link traces
    #
    factories.DocumentFactory.create_batch(3, link_traces=[user_to_delete, other_user])
    # Create other link traces for the other user
    #
    factories.DocumentFactory.create_batch(3, link_traces=[other_user])

    # Threads created by the user to delete should be set to null
    threads_owned_by_user_to_delete = factories.ThreadFactory.create_batch(
        2, creator=user_to_delete
    )
    # Threads created by the other user should not change
    threads_owned_by_other_user = factories.ThreadFactory.create_batch(
        2, creator=other_user
    )

    # create comments for bot users in all existing threads
    comments = []
    for thread in threads_owned_by_user_to_delete + threads_owned_by_other_user:
        comments.append(factories.CommentFactory(thread=thread, user=user_to_delete))
        comments.append(factories.CommentFactory(thread=thread, user=other_user))

    assert models.DocumentAccess.objects.filter(user=user_to_delete).count() == 11
    assert models.Document.objects.all().count() == 30
    assert models.LinkTrace.objects.all().count() == 9
    assert models.Thread.objects.all().count() == 4
    assert models.Comment.objects.all().count() == 8
    assert len(documents_to_delete) == 9

    def mock_clear_user_created_documents(self):
        raise DatabaseError()

    monkeypatch.setattr(
        models.User, "_clear_user_created_documents", mock_clear_user_created_documents
    )

    with pytest.raises(DatabaseError):
        user_to_delete.delete()

    assert models.DocumentAccess.objects.filter(user=user_to_delete).count() == 11
    assert models.Document.objects.all().count() == 30
    assert models.LinkTrace.objects.all().count() == 9
    assert models.Thread.objects.all().count() == 4
    assert models.Comment.objects.all().count() == 8
    assert len(documents_to_delete) == 9

    assert models.User.objects.filter(id=user_to_delete.id).exists() is True
