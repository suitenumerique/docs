import pytest

from core import models


@pytest.mark.django_db
def test_update_blank_title_migration(migrator):
    """
    Test that the migration fixes the titles of documents that are
    "Untitled document", "Unbenanntes Dokument" or "Document sans titre"
    """
    old_state = migrator.apply_initial_migration(
        ("core", "0017_add_fields_for_soft_delete")
    )
    OldDocument = old_state.apps.get_model("core", "Document")

    old_english_doc = OldDocument.objects.create(
        title="Untitled document", depth=1, path="0000001"
    )
    old_german_doc = OldDocument.objects.create(
        title="Unbenanntes Dokument", depth=1, path="0000002"
    )
    old_french_doc = OldDocument.objects.create(
        title="Document sans titre", depth=1, path="0000003"
    )
    old_other_doc = OldDocument.objects.create(
        title="My document", depth=1, path="0000004"
    )

    assert old_english_doc.title == "Untitled document"
    assert old_german_doc.title == "Unbenanntes Dokument"
    assert old_french_doc.title == "Document sans titre"
    assert old_other_doc.title == "My document"

    # Apply the migration
    new_state = migrator.apply_tested_migration(("core", "0018_update_blank_title"))
    NewDocument = new_state.apps.get_model("core", "Document")

    new_english_doc = NewDocument.objects.get(pk=old_english_doc.pk)
    new_german_doc = NewDocument.objects.get(pk=old_german_doc.pk)
    new_french_doc = NewDocument.objects.get(pk=old_french_doc.pk)
    new_other_doc = NewDocument.objects.get(pk=old_other_doc.pk)

    assert new_english_doc.title == None
    assert new_german_doc.title == None
    assert new_french_doc.title == None
    assert new_other_doc.title == "My document"
