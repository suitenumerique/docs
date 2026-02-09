"""Tests for utils.users_sharing_documents_with function."""

from django.utils import timezone

import pytest

from core import factories, utils

pytestmark = pytest.mark.django_db


def test_utils_users_sharing_documents_with():
    """Test users_sharing_documents_with function."""

    user = factories.UserFactory(
        email="martin.bernard@anct.gouv.fr", full_name="Martin Bernard"
    )

    pierre_1 = factories.UserFactory(
        email="pierre.dupont@beta.gouv.fr", full_name="Pierre Dupont"
    )
    pierre_2 = factories.UserFactory(
        email="pierre.durand@impots.gouv.fr", full_name="Pierre Durand"
    )

    now = timezone.now()
    yesterday = now - timezone.timedelta(days=1)
    last_week = now - timezone.timedelta(days=7)
    last_month = now - timezone.timedelta(days=30)

    document_1 = factories.DocumentFactory(creator=user)
    document_2 = factories.DocumentFactory(creator=user)
    document_3 = factories.DocumentFactory(creator=user)

    factories.UserDocumentAccessFactory(user=user, document=document_1)
    factories.UserDocumentAccessFactory(user=user, document=document_2)
    factories.UserDocumentAccessFactory(user=user, document=document_3)

    # The factory cannot set the created_at directly, so we force it after creation
    doc_1_pierre_1 = factories.UserDocumentAccessFactory(
        user=pierre_1, document=document_1, created_at=last_week
    )
    doc_1_pierre_1.created_at = last_week
    doc_1_pierre_1.save()
    doc_2_pierre_2 = factories.UserDocumentAccessFactory(
        user=pierre_2, document=document_2
    )
    doc_2_pierre_2.created_at = last_month
    doc_2_pierre_2.save()

    doc_3_pierre_2 = factories.UserDocumentAccessFactory(
        user=pierre_2, document=document_3
    )
    doc_3_pierre_2.created_at = yesterday
    doc_3_pierre_2.save()

    shared_map = utils.users_sharing_documents_with(user)

    assert shared_map == {
        pierre_1.id: last_week,
        pierre_2.id: yesterday,
    }
