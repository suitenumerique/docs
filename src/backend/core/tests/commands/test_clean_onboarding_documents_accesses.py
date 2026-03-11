"""Module testing clean_onboarding_documents_accesses command."""

from django.core.management import call_command

import pytest

from core import factories, models

pytestmark = pytest.mark.django_db


def test_clean_onboarding_documents_accesses(settings):
    """test running the command remove the accesses for non priviliged roles."""

    # Create onboarding documents
    onboarding_documents = factories.DocumentFactory.create_batch(
        2, link_reach=models.LinkReachChoices.PUBLIC
    )

    settings.USER_ONBOARDING_DOCUMENTS = [
        str(document.id) for document in onboarding_documents
    ]

    # Create other documents
    non_onboarding_documents = factories.DocumentFactory.create_batch(
        3, link_reach=models.LinkReachChoices.PUBLIC
    )

    all_documents = onboarding_documents + non_onboarding_documents

    # for every documents create 2 priviliged role, an owner and an admin
    for document in all_documents:
        factories.UserDocumentAccessFactory(
            document=document, role=models.RoleChoices.OWNER
        )
        factories.UserDocumentAccessFactory(
            document=document, role=models.RoleChoices.ADMIN
        )

    # for every documents, create non privileged roles
    for document in all_documents:
        factories.UserDocumentAccessFactory.create_batch(
            10, document=document, role=models.RoleChoices.READER
        )
        factories.UserDocumentAccessFactory.create_batch(
            10, document=document, role=models.RoleChoices.EDITOR
        )
        factories.UserDocumentAccessFactory.create_batch(
            10, document=document, role=models.RoleChoices.COMMENTER
        )

    # All documents should have 32 accesses, so 160 accesses created
    assert models.DocumentAccess.objects.count() == 160
    assert (
        models.DocumentAccess.objects.filter(document__in=onboarding_documents)
        .exclude(role__in=models.PRIVILEGED_ROLES)
        .count()
        == 60
    )
    assert (
        models.DocumentAccess.objects.filter(
            document__in=onboarding_documents, role__in=models.PRIVILEGED_ROLES
        ).count()
        == 4
    )
    assert (
        models.DocumentAccess.objects.filter(document__in=non_onboarding_documents)
        .exclude(role__in=models.PRIVILEGED_ROLES)
        .count()
        == 90
    )
    assert (
        models.DocumentAccess.objects.filter(
            document__in=non_onboarding_documents, role__in=models.PRIVILEGED_ROLES
        ).count()
        == 6
    )

    # Run the command
    call_command("clean_onboarding_documents_accesses")

    # 60 accesses should have been removed, 30 for each onboarding docs
    assert models.DocumentAccess.objects.count() == 100

    # Non privileged roles should have been deleted on the onboarding documents
    assert (
        models.DocumentAccess.objects.filter(document__in=onboarding_documents)
        .exclude(role__in=models.PRIVILEGED_ROLES)
        .count()
        == 0
    )

    # Priviliged roles should have been kept
    assert (
        models.DocumentAccess.objects.filter(
            document__in=onboarding_documents, role__in=models.PRIVILEGED_ROLES
        ).count()
        == 4
    )

    # On other documents, all accesses should remain
    assert (
        models.DocumentAccess.objects.filter(document__in=non_onboarding_documents)
        .exclude(role__in=models.PRIVILEGED_ROLES)
        .count()
        == 90
    )

    # Priviliged roles should have been kept
    assert (
        models.DocumentAccess.objects.filter(
            document__in=non_onboarding_documents, role__in=models.PRIVILEGED_ROLES
        ).count()
        == 6
    )


def test_clean_onboarding_documents_accesses_no_onboarding_documents(settings):
    """test running the command without onboarding documents should stop it."""
    settings.USER_ONBOARDING_DOCUMENTS = None

    factories.UserDocumentAccessFactory.create_batch(10)

    assert models.DocumentAccess.objects.count() == 10

    # Run the command
    call_command("clean_onboarding_documents_accesses")

    assert models.DocumentAccess.objects.count() == 10
