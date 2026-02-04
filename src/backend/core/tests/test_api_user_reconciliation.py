"""
Unit tests for the ReconciliationConfirmView API view.
"""

import uuid

from django.conf import settings

import pytest
from rest_framework.test import APIClient

from core import factories, models

pytestmark = pytest.mark.django_db


def test_reconciliation_confirm_view_sets_active_checked():
    """GETting the active confirmation endpoint should set active_email_checked."""
    user = factories.UserFactory(email="user.confirm1@example.com")
    other = factories.UserFactory(email="user.confirm2@example.com")
    rec = models.UserReconciliation.objects.create(
        active_email=user.email,
        inactive_email=other.email,
        active_user=user,
        inactive_user=other,
        active_email_checked=False,
        inactive_email_checked=False,
        status="ready",
    )

    client = APIClient()
    conf_id = rec.active_email_confirmation_id
    url = f"/api/{settings.API_VERSION}/user-reconciliations/active/{conf_id}/"
    resp = client.get(url)
    assert resp.status_code == 200
    assert resp.json() == {"detail": "Confirmation received"}

    rec.refresh_from_db()
    assert rec.active_email_checked is True


def test_reconciliation_confirm_view_sets_inactive_checked():
    """GETting the inactive confirmation endpoint should set inactive_email_checked."""
    user = factories.UserFactory(email="user.confirm3@example.com")
    other = factories.UserFactory(email="user.confirm4@example.com")
    rec = models.UserReconciliation.objects.create(
        active_email=user.email,
        inactive_email=other.email,
        active_user=user,
        inactive_user=other,
        active_email_checked=False,
        inactive_email_checked=False,
        status="ready",
    )

    client = APIClient()
    conf_id = rec.inactive_email_confirmation_id
    url = f"/api/{settings.API_VERSION}/user-reconciliations/inactive/{conf_id}/"
    resp = client.get(url)
    assert resp.status_code == 200
    assert resp.json() == {"detail": "Confirmation received"}

    rec.refresh_from_db()
    assert rec.inactive_email_checked is True


def test_reconciliation_confirm_view_invalid_user_type_returns_400():
    """GETting with an invalid user_type should return 400."""
    client = APIClient()
    # Use a valid uuid format but invalid user_type

    url = f"/api/{settings.API_VERSION}/user-reconciliations/other/{uuid.uuid4()}/"
    resp = client.get(url)
    assert resp.status_code == 400
    assert resp.json() == {"detail": "Invalid user_type"}


def test_reconciliation_confirm_view_not_found_returns_404():
    """GETting with a non-existing confirmation_id should return 404."""
    client = APIClient()

    url = f"/api/{settings.API_VERSION}/user-reconciliations/active/{uuid.uuid4()}/"
    resp = client.get(url)
    assert resp.status_code == 404
    assert resp.json() == {"detail": "Reconciliation entry not found"}
