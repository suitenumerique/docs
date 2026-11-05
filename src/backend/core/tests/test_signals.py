"""
Tests of the signals of the core application: the changes of accesses reported
to the collaboration server, whichever code changed them, and the Find token
exchanged at login and revoked at logout.
"""

import time
from unittest import mock

from django.contrib import auth
from django.contrib.auth.signals import user_logged_in, user_logged_out
from django.db import transaction

import pytest
from rest_framework.test import APIClient

from core import factories, models
from core.authentication.backends import OIDCAuthenticationBackend

pytestmark = pytest.mark.django_db


def test_signals_document_access_created(
    mock_reset_service_connections, capture_service_resets
):
    """Creating an access should have the user's connections re-checked."""
    document = factories.DocumentFactory()
    user = factories.UserFactory()

    with capture_service_resets():
        models.DocumentAccess.objects.create(
            document=document, user=user, role="editor"
        )

    mock_reset_service_connections.assert_called_once_with(
        str(document.id), str(user.id)
    )


def test_signals_document_access_created_for_a_team(
    mock_reset_service_connections, capture_service_resets
):
    """An access granted to a team names nobody: every connection is re-checked."""
    document = factories.DocumentFactory()

    with capture_service_resets():
        models.DocumentAccess.objects.create(
            document=document, team="lasuite", role="reader"
        )

    mock_reset_service_connections.assert_called_once_with(str(document.id), None)


def test_signals_document_access_updated(
    mock_reset_service_connections, capture_service_resets
):
    """Saving an access, from wherever, should have the connections re-checked."""
    access = factories.UserDocumentAccessFactory(role="reader")

    with capture_service_resets():
        access.role = "editor"
        access.save()

    mock_reset_service_connections.assert_called_once_with(
        str(access.document_id), str(access.user_id)
    )


def test_signals_document_access_deleted(
    mock_reset_service_connections, capture_service_resets
):
    """Deleting an access should have the user's connections re-checked."""
    access = factories.UserDocumentAccessFactory()
    document_id, user_id = access.document_id, access.user_id

    with capture_service_resets():
        access.delete()

    mock_reset_service_connections.assert_called_once_with(
        str(document_id), str(user_id)
    )


def test_signals_document_accesses_deleted_in_bulk(
    mock_reset_service_connections, capture_service_resets
):
    """A queryset deletion goes through the signal for each access."""
    document = factories.DocumentFactory()
    accesses = factories.UserDocumentAccessFactory.create_batch(3, document=document)

    with capture_service_resets():
        models.DocumentAccess.objects.filter(document=document).delete()

    assert sorted(mock_reset_service_connections.call_args_list, key=str) == sorted(
        [mock.call(str(document.id), str(access.user_id)) for access in accesses],
        key=str,
    )


def test_signals_document_reset_is_queued_on_commit(mock_reset_service_connections):
    """Nothing is queued before the transaction is committed."""
    document = factories.DocumentFactory()

    models.DocumentAccess.objects.create(
        document=document, user=factories.UserFactory(), role="editor"
    )

    mock_reset_service_connections.assert_not_called()


def test_signals_document_link_definition_changed(
    mock_reset_service_connections, capture_service_resets
):
    """Changing the link definition of a document re-checks every connection."""
    document = factories.DocumentFactory(link_reach="restricted", link_role="reader")
    document = models.Document.objects.get(pk=document.pk)

    with capture_service_resets():
        document.link_reach = "public"
        document.save()

    mock_reset_service_connections.assert_called_once_with(str(document.id), None)


def test_signals_document_link_role_changed(
    mock_reset_service_connections, capture_service_resets
):
    """The link role is part of the link definition."""
    document = factories.DocumentFactory(link_reach="public", link_role="reader")
    document = models.Document.objects.get(pk=document.pk)

    with capture_service_resets():
        document.link_role = "editor"
        document.save()

    mock_reset_service_connections.assert_called_once_with(str(document.id), None)


def test_signals_document_link_definition_unchanged(
    mock_reset_service_connections, capture_service_resets
):
    """Saving a document without touching its link definition queues nothing."""
    document = factories.DocumentFactory(link_reach="public", link_role="reader")
    document = models.Document.objects.get(pk=document.pk)

    with capture_service_resets():
        document.title = "renamed"
        document.save()
        document.link_reach = "public"  # the value it already has
        document.save()

    mock_reset_service_connections.assert_not_called()


def test_signals_document_link_definition_saved_twice(
    mock_reset_service_connections, capture_service_resets
):
    """A change is reported once: the resets of a transaction are coalesced."""
    document = factories.DocumentFactory(link_reach="restricted", link_role="reader")
    document = models.Document.objects.get(pk=document.pk)

    with capture_service_resets():
        document.link_reach = "authenticated"
        document.save()
        document.save()

    mock_reset_service_connections.assert_called_once_with(str(document.id), None)


def test_signals_document_link_definition_snapshot_follows_the_commit(
    mock_reset_service_connections, capture_service_resets
):
    """Once committed, saving the same value again reports no change."""
    document = factories.DocumentFactory(link_reach="restricted", link_role="reader")
    document = models.Document.objects.get(pk=document.pk)

    with capture_service_resets():
        document.link_reach = "authenticated"
        document.save()
    with capture_service_resets():
        document.save()

    mock_reset_service_connections.assert_not_called()


def test_signals_document_link_definition_saved_in_a_rolled_back_savepoint(
    mock_reset_service_connections, capture_service_resets
):
    """
    A save rolled back with its savepoint leaves no snapshot behind: saving
    the same value again is a change, and is reported.
    """
    document = factories.DocumentFactory(link_reach="restricted", link_role="reader")
    document = models.Document.objects.get(pk=document.pk)

    with capture_service_resets():
        with pytest.raises(RuntimeError), transaction.atomic():
            document.link_role = "editor"
            document.save()
            raise RuntimeError("rolled back")
        document.save()

    mock_reset_service_connections.assert_called_once_with(str(document.id), None)


def test_signals_document_link_definition_refreshed(
    mock_reset_service_connections, capture_service_resets
):
    """Refreshing from the database takes a new snapshot."""
    document = factories.DocumentFactory(link_reach="restricted", link_role="reader")
    models.Document.objects.filter(pk=document.pk).update(link_reach="public")
    document.refresh_from_db()

    with capture_service_resets():
        document.save()

    mock_reset_service_connections.assert_not_called()


def test_signals_document_link_definition_partly_refreshed(
    mock_reset_service_connections, capture_service_resets
):
    """
    Reloading one link field, as reading a deferred one does, must not take
    the unsaved value of the other one for the saved one.
    """
    document = factories.DocumentFactory(link_reach="public", link_role="reader")
    document = models.Document.objects.get(pk=document.pk)
    document.link_role = "editor"
    document.refresh_from_db(fields=["link_reach"])

    with capture_service_resets():
        document.save()

    mock_reset_service_connections.assert_called_once_with(str(document.id), None)


def test_signals_document_link_definition_deferred_field_read(
    mock_reset_service_connections, capture_service_resets
):
    """The same, through Django loading a deferred field on read."""
    document = factories.DocumentFactory(link_reach="public", link_role="reader")
    document = models.Document.objects.defer("link_reach").get(pk=document.pk)
    document.link_role = "editor"
    assert document.link_reach == "public"  # loads the deferred field

    with capture_service_resets():
        document.save()

    mock_reset_service_connections.assert_called_once_with(str(document.id), None)


def test_signals_document_created(
    mock_reset_service_connections, capture_service_resets
):
    """A new document has no connection to re-check."""
    with capture_service_resets():
        factories.DocumentFactory(link_reach="public")

    mock_reset_service_connections.assert_not_called()


# Login and logout


def test_signals_login_exchanges_a_find_token():
    """
    Logging in through the OIDC callback should exchange the access token of the
    identity provider, already stored in the session, for the logged-in user.
    """
    user = factories.UserFactory()
    client = APIClient()
    session = client.session
    session["oidc_states"] = {
        "the-state": {
            "nonce": "the-nonce",
            "code_verifier": None,
            "added_on": time.time(),
        }
    }
    session.save()

    def authenticate(self, request, **kwargs):  # pylint: disable=unused-argument
        # mozilla-django-oidc stores the tokens in the session, then returns the user
        request.session["oidc_access_token"] = "idp-access-token"
        return user

    seen = {}

    def exchange(request):
        seen["access_token"] = request.session.get("oidc_access_token")
        seen["user"] = request.user

    with (
        mock.patch.object(OIDCAuthenticationBackend, "authenticate", authenticate),
        mock.patch(
            "core.signals.exchange_find_token", side_effect=exchange
        ) as mock_exchange,
    ):
        response = client.get(
            "/api/v1.0/callback/", {"code": "the-code", "state": "the-state"}
        )

    assert response.status_code == 302
    assert client.session[auth.SESSION_KEY] == str(user.pk)
    mock_exchange.assert_called_once()
    assert seen == {"access_token": "idp-access-token", "user": user}


def test_signals_logout_revokes_the_find_token(settings):
    """
    Logging out should revoke the Find token while the session still holds it,
    before Django flushes it.
    """
    settings.OIDC_OP_LOGOUT_ENDPOINT = None
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)
    session = client.session
    session["find_access_token"] = "encrypted-find-token"
    session.save()

    seen = {}

    def revoke(request):
        seen["find_access_token"] = request.session.get("find_access_token")
        seen["user"] = request.session.get(auth.SESSION_KEY)

    with mock.patch(
        "core.signals.revoke_find_token", side_effect=revoke
    ) as mock_revoke:
        response = client.post("/api/v1.0/logout/")

    assert response.status_code == 302
    mock_revoke.assert_called_once()
    assert seen == {"find_access_token": "encrypted-find-token", "user": str(user.pk)}
    assert "find_access_token" not in client.session
    assert auth.SESSION_KEY not in client.session


@mock.patch("core.signals.revoke_find_token")
@mock.patch("core.signals.exchange_find_token")
def test_signals_login_and_logout_without_request(mock_exchange, mock_revoke):
    """
    The login and logout signals sent without a request, as code outside a view
    may do, have no session to read: nothing should be exchanged nor revoked.
    """
    user = factories.UserFactory()

    user_logged_in.send(sender=user.__class__, request=None, user=user)
    user_logged_out.send(sender=user.__class__, request=None, user=user)

    assert not mock_exchange.called
    assert not mock_revoke.called
