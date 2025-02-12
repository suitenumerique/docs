import pytest

from core import factories


@pytest.mark.django_db
def test_update_blank_title_migration(migrator):
    """
    Test that the migration fixes the titles of documents that are
    "Untitled document", "Unbenanntes Dokument" or "Document sans titre"
    """
    migrator.apply_initial_migration(("core", "0017_add_fields_for_soft_delete"))

    english_doc = factories.DocumentFactory(title="Untitled document")
    german_doc = factories.DocumentFactory(title="Unbenanntes Dokument")
    french_doc = factories.DocumentFactory(title="Document sans titre")
    other_doc = factories.DocumentFactory(title="My document")

    assert english_doc.title == "Untitled document"
    assert german_doc.title == "Unbenanntes Dokument"
    assert french_doc.title == "Document sans titre"
    assert other_doc.title == "My document"

    # Apply the migration
    migrator.apply_tested_migration(("core", "0018_update_blank_title"))

    english_doc.refresh_from_db()
    german_doc.refresh_from_db()
    french_doc.refresh_from_db()
    other_doc.refresh_from_db()

    assert english_doc.title == None
    assert german_doc.title == None
    assert french_doc.title == None
    assert other_doc.title == "My document"
