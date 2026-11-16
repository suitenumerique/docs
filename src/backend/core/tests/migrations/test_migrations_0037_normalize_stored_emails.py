"""Module testing migration 0037_normalize_stored_emails."""

from importlib import import_module

from django.contrib.auth.hashers import make_password

import pytest

pytestmark = pytest.mark.django_db

BEFORE = ("core", "0036_delete_covered_ask_for_accesses")
AFTER = ("core", "0037_normalize_stored_emails")


def test_migrations_normalize_stored_emails_users(migrator):
    """
    Only the surrounding spaces and the ASCII case of user emails should change,
    users sharing an email once normalized are kept and the admin email is ignored.
    """
    old_state = migrator.apply_initial_migration(BEFORE)
    OldUser = old_state.apps.get_model("core", "User")

    cases = [
        ("John.Doe@Example.COM", "john.doe@example.com"),
        ("  john.doe@example.com ", "john.doe@example.com"),
        ("john.doe@example.com", "john.doe@example.com"),
        # Non-ASCII letters are kept as is, even those that a Unicode case
        # mapping (PostgreSQL's UPPER(), Python's upper() or lower()) folds
        # into an ASCII letter:
        # U+0131 LATIN SMALL LETTER DOTLESS I (upper() gives "I")
        ("Jane.d\u0131sk@Example.com", "jane.d\u0131sk@example.com"),
        # U+017F LATIN SMALL LETTER LONG S (upper() gives "S")
        ("Jane.\u017fmith@Example.com", "jane.\u017fmith@example.com"),
        # U+212A KELVIN SIGN, which looks like "K" (lower() gives "k")
        ("\u212aevin@Example.com", "\u212aevin@example.com"),
        ("", ""),
        (None, None),
    ]
    expected = {}
    for index, (stored_email, expected_email) in enumerate(cases):
        user = OldUser.objects.create(
            sub=f"user-{index:d}",
            email=stored_email,
            admin_email=f"Admin{index:d}@Example.com",
            password=make_password("password"),
        )
        expected[user.pk] = (expected_email, f"Admin{index:d}@Example.com")

    new_state = migrator.apply_tested_migration(AFTER)
    NewUser = new_state.apps.get_model("core", "User")

    assert {
        pk: (email, admin_email)
        for pk, email, admin_email in NewUser.objects.values_list(
            "pk", "email", "admin_email"
        )
    } == expected


def test_migrations_normalize_stored_emails_invitations(migrator):
    """
    Invitation emails should be normalized, keeping only the most recent invitation
    of a document for a normalized email. An email differing by a non-ASCII letter
    or an invitation to another document is not a duplicate.
    """
    old_state = migrator.apply_initial_migration(BEFORE)
    OldDocument = old_state.apps.get_model("core", "Document")
    OldInvitation = old_state.apps.get_model("core", "Invitation")

    document = OldDocument.objects.create(title="Doc", depth=1, path="0000001")
    other_document = OldDocument.objects.create(title="Other", depth=1, path="0000002")

    def invite(email, invited_document=document):
        return OldInvitation.objects.create(
            document=invited_document, email=email, role="reader"
        ).id

    # Created in this order, so the last one of each email is the most recent
    deleted = [invite("Guest@example.com"), invite(" guest@example.com")]
    kept = {
        invite("guest@example.com"): (document.pk, "guest@example.com"),
        invite("alıce@example.com"): (document.pk, "alıce@example.com"),
        invite("alice@example.com"): (document.pk, "alice@example.com"),
        invite(" Guest@Example.com ", other_document): (
            other_document.pk,
            "guest@example.com",
        ),
    }

    new_state = migrator.apply_tested_migration(AFTER)
    NewInvitation = new_state.apps.get_model("core", "Invitation")

    assert not NewInvitation.objects.filter(id__in=deleted).exists()
    assert {
        pk: (document_id, email)
        for pk, document_id, email in NewInvitation.objects.values_list(
            "pk", "document_id", "email"
        )
    } == kept


def test_migrations_normalize_stored_emails_users_in_batches(migrator, monkeypatch):
    """All the emails should be normalized when there are more than a batch of them."""
    old_state = migrator.apply_initial_migration(BEFORE)
    OldUser = old_state.apps.get_model("core", "User")
    for index in range(5):
        OldUser.objects.create(
            sub=f"user-{index:d}",
            email=f"User{index:d}@Example.com",
            password=make_password("password"),
        )
    monkeypatch.setattr(
        import_module("core.migrations.0037_normalize_stored_emails"), "BATCH_SIZE", 2
    )

    new_state = migrator.apply_tested_migration(AFTER)
    NewUser = new_state.apps.get_model("core", "User")

    assert sorted(NewUser.objects.values_list("email", flat=True)) == [
        f"user{index:d}@example.com" for index in range(5)
    ]
