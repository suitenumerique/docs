"""Module testing migration 0036_delete_covered_ask_for_accesses."""

from django.contrib.auth.hashers import make_password

import pytest


@pytest.mark.django_db
def test_delete_covered_ask_for_accesses(migrator):
    """
    The requests whose user holds the role requested or a higher one on the document
    are deleted, the others are kept.
    """
    old_state = migrator.apply_initial_migration(("core", "0035_mention"))

    OldUser = old_state.apps.get_model("core", "User")
    OldDocument = old_state.apps.get_model("core", "Document")
    OldDocumentAccess = old_state.apps.get_model("core", "DocumentAccess")
    OldDocumentAskForAccess = old_state.apps.get_model("core", "DocumentAskForAccess")

    document = OldDocument.objects.create(title="Doc", depth=1, path="0000001")
    other_document = OldDocument.objects.create(title="Other", depth=1, path="0000002")

    def ask(name, requested_role, access_role=None, access_document=document):
        user = OldUser.objects.create(
            email=f"{name}@example.com", sub=name, password=make_password("password")
        )
        if access_role:
            OldDocumentAccess.objects.create(
                document=access_document, user=user, role=access_role
            )
        return OldDocumentAskForAccess.objects.create(
            document=document, user=user, role=requested_role
        ).id

    deleted = [
        # the case of the report: the requester was then made owner directly
        ask("owner", "reader", "owner"),
        ask("same-role", "editor", "editor"),
        ask("admin", "editor", "administrator"),
    ]
    kept = [
        ask("lower-role", "editor", "reader"),
        ask("admin-asks-owner", "owner", "administrator"),
        ask("no-access", "reader"),
        ask("other-document", "reader", "owner", other_document),
    ]
    # An access given to a team names no user: it covers no request
    OldDocumentAccess.objects.create(document=document, team="lasuite", role="owner")

    new_state = migrator.apply_tested_migration(
        ("core", "0036_delete_covered_ask_for_accesses")
    )
    NewDocumentAskForAccess = new_state.apps.get_model("core", "DocumentAskForAccess")

    assert not NewDocumentAskForAccess.objects.filter(id__in=deleted).exists()
    assert set(NewDocumentAskForAccess.objects.values_list("id", flat=True)) == set(
        kept
    )
