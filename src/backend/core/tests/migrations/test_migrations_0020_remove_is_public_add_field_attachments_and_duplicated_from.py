import base64
import uuid

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage

import pytest
import y_py

from core import models


@pytest.mark.django_db
def test_populate_attachments_on_all_documents(migrator):
    """Test that the migration populates attachments on existing documents."""
    old_state = migrator.apply_initial_migration(
        ("core", "0019_alter_user_language_default_to_null")
    )
    OldDocument = old_state.apps.get_model("core", "Document")

    old_doc_without_attachments = OldDocument.objects.create(
        title="Doc without attachments", depth=1, path="0000002"
    )
    old_doc_with_attachments = OldDocument.objects.create(
        title="Doc with attachments", depth=1, path="0000001"
    )

    # Create document content with an image
    file_key = f"{old_doc_with_attachments.id!s}/file"
    ydoc = y_py.YDoc()  # pylint: disable=no-member
    image_key = f"{old_doc_with_attachments.id!s}/attachments/{uuid.uuid4()!s}.png"
    with ydoc.begin_transaction() as txn:
        xml_fragment = ydoc.get_xml_element("document-store")
        xml_fragment.push_xml_element(txn, "image").set_attribute(
            txn, "src", f"http://localhost/media/{image_key:s}"
        )
    update = y_py.encode_state_as_update(ydoc)  # pylint: disable=no-member
    base64_content = base64.b64encode(update).decode("utf-8")
    bytes_content = base64_content.encode("utf-8")
    content_file = ContentFile(bytes_content)
    default_storage.save(file_key, content_file)

    # Apply the migration
    new_state = migrator.apply_tested_migration(
        ("core", "0020_remove_is_public_add_field_attachments_and_duplicated_from")
    )
    NewDocument = new_state.apps.get_model("core", "Document")

    new_doc_with_attachments = NewDocument.objects.get(pk=old_doc_with_attachments.pk)
    new_doc_without_attachments = NewDocument.objects.get(
        pk=old_doc_without_attachments.pk
    )

    assert new_doc_without_attachments.attachments == []
    assert new_doc_with_attachments.attachments == [image_key]
