"""Module testing migration 0031_clean_onboarding_accesses."""

from django.contrib.auth.hashers import make_password

import pytest


def create_user(OldUser, n):
    """Create a user with a unique sub and email based on the given index."""
    return OldUser.objects.create(
        email=f"user-{n}@example.com",
        sub=f"user-{n}",
        password=make_password("password"),
    )


@pytest.mark.django_db
def test_clean_onboarding_accesses(migrator, settings):
    """Test migration 0031_clean_onboarding_accesses."""
    old_state = migrator.apply_initial_migration(
        ("core", "0030_user_is_first_connection")
    )

    OldUser = old_state.apps.get_model("core", "User")
    OldDocument = old_state.apps.get_model("core", "Document")
    OldDocumentAccess = old_state.apps.get_model("core", "DocumentAccess")

    # Create onboarding documents
    onboarding_doc_1 = OldDocument.objects.create(
        title="Onboarding Doc 1", depth=1, path="0000001", link_reach="public"
    )
    onboarding_doc_2 = OldDocument.objects.create(
        title="Onboarding Doc 2", depth=1, path="0000002", link_reach="public"
    )
    onboarding_documents = [onboarding_doc_1, onboarding_doc_2]

    settings.USER_ONBOARDING_DOCUMENTS = [str(doc.id) for doc in onboarding_documents]

    # Create other documents
    non_onboarding_doc_1 = OldDocument.objects.create(
        title="Non-Onboarding Doc 1", depth=1, path="0000003", link_reach="public"
    )
    non_onboarding_doc_2 = OldDocument.objects.create(
        title="Non-Onboarding Doc 2", depth=1, path="0000004", link_reach="public"
    )
    non_onboarding_doc_3 = OldDocument.objects.create(
        title="Non-Onboarding Doc 3", depth=1, path="0000005", link_reach="public"
    )
    non_onboarding_documents = [
        non_onboarding_doc_1,
        non_onboarding_doc_2,
        non_onboarding_doc_3,
    ]

    all_documents = onboarding_documents + non_onboarding_documents

    user_counter = 0

    # For every document create privileged roles: owner and admin
    for document in all_documents:
        OldDocumentAccess.objects.create(
            document=document,
            user=create_user(OldUser, user_counter),
            role="owner",
        )
        user_counter += 1
        OldDocumentAccess.objects.create(
            document=document,
            user=create_user(OldUser, user_counter),
            role="administrator",
        )
        user_counter += 1

    # For every document, create non-privileged roles
    for document in all_documents:
        for role in ["reader", "editor", "commenter"]:
            for _ in range(10):
                OldDocumentAccess.objects.create(
                    document=document,
                    user=create_user(OldUser, user_counter),
                    role=role,
                )
                user_counter += 1

    onboarding_ids = [doc.id for doc in onboarding_documents]
    non_onboarding_ids = [doc.id for doc in non_onboarding_documents]

    # All documents should have 32 accesses each, so 160 accesses total
    assert OldDocumentAccess.objects.count() == 160
    assert (
        OldDocumentAccess.objects.filter(document_id__in=onboarding_ids)
        .exclude(role__in=["administrator", "owner"])
        .count()
        == 60
    )
    assert (
        OldDocumentAccess.objects.filter(
            document_id__in=onboarding_ids, role__in=["administrator", "owner"]
        ).count()
        == 4
    )
    assert (
        OldDocumentAccess.objects.filter(document_id__in=non_onboarding_ids)
        .exclude(role__in=["administrator", "owner"])
        .count()
        == 90
    )
    assert (
        OldDocumentAccess.objects.filter(
            document_id__in=non_onboarding_ids, role__in=["administrator", "owner"]
        ).count()
        == 6
    )

    # Apply the migration
    new_state = migrator.apply_tested_migration(
        ("core", "0031_clean_onboarding_accesses")
    )

    NewDocumentAccess = new_state.apps.get_model("core", "DocumentAccess")

    # 60 accesses should have been removed (30 non-privileged for each onboarding doc)
    assert NewDocumentAccess.objects.count() == 100

    # Non-privileged roles should have been deleted on the onboarding documents
    assert (
        NewDocumentAccess.objects.filter(document_id__in=onboarding_ids)
        .exclude(role__in=["administrator", "owner"])
        .count()
        == 0
    )

    # Privileged roles should have been kept
    assert (
        NewDocumentAccess.objects.filter(
            document_id__in=onboarding_ids, role__in=["administrator", "owner"]
        ).count()
        == 4
    )

    # On other documents, all accesses should remain
    assert (
        NewDocumentAccess.objects.filter(document_id__in=non_onboarding_ids)
        .exclude(role__in=["administrator", "owner"])
        .count()
        == 90
    )

    # Privileged roles should have been kept
    assert (
        NewDocumentAccess.objects.filter(
            document_id__in=non_onboarding_ids, role__in=["administrator", "owner"]
        ).count()
        == 6
    )


@pytest.mark.django_db
def test_clean_onboarding_accesses_no_setting(migrator, settings):
    """Test migration 0031 does not delete any access when USER_ONBOARDING_DOCUMENTS is empty."""
    old_state = migrator.apply_initial_migration(
        ("core", "0030_user_is_first_connection")
    )

    OldUser = old_state.apps.get_model("core", "User")
    OldDocument = old_state.apps.get_model("core", "Document")
    OldDocumentAccess = old_state.apps.get_model("core", "DocumentAccess")

    settings.USER_ONBOARDING_DOCUMENTS = []

    doc_1 = OldDocument.objects.create(title="Doc 1", depth=1, path="0000001")
    doc_2 = OldDocument.objects.create(title="Doc 2", depth=1, path="0000002")

    user_counter = 0
    for document in [doc_1, doc_2]:
        for role in ["owner", "administrator", "reader", "editor", "commenter"]:
            OldDocumentAccess.objects.create(
                document=document,
                user=create_user(OldUser, user_counter),
                role=role,
            )
            user_counter += 1

    assert OldDocumentAccess.objects.count() == 10

    new_state = migrator.apply_tested_migration(
        ("core", "0031_clean_onboarding_accesses")
    )

    NewDocumentAccess = new_state.apps.get_model("core", "DocumentAccess")

    # No accesses should have been deleted
    assert NewDocumentAccess.objects.count() == 10
