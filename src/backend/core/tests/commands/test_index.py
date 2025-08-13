"""
Unit test for `index` command.
"""

from unittest import mock

from django.core.management import call_command
from django.db import transaction

import pytest

from core import factories
from core.services.search_indexers import FindDocumentIndexer


@pytest.mark.django_db
def test_index():
    """Test the command `index` that run the Find app indexer for all the available documents."""
    user = factories.UserFactory()
    indexer = FindDocumentIndexer()

    with transaction.atomic():
        doc = factories.DocumentFactory()
        empty_doc = factories.DocumentFactory(title=None, content="")
        no_title_doc = factories.DocumentFactory(title=None)

        factories.UserDocumentAccessFactory(document=doc, user=user)
        factories.UserDocumentAccessFactory(document=empty_doc, user=user)
        factories.UserDocumentAccessFactory(document=no_title_doc, user=user)

    accesses = {
        str(doc.path): {"users": [user.sub]},
        str(empty_doc.path): {"users": [user.sub]},
        str(no_title_doc.path): {"users": [user.sub]},
    }

    def sortkey(d):
        return d["id"]

    with mock.patch.object(FindDocumentIndexer, "push") as mock_push:
        call_command("index")

        push_call_args = [call.args[0] for call in mock_push.call_args_list]

        assert len(push_call_args) == 1  # called once but with a batch of docs
        assert sorted(push_call_args[0], key=sortkey) == sorted(
            [
                indexer.serialize_document(doc, accesses),
                indexer.serialize_document(no_title_doc, accesses),
            ],
            key=sortkey,
        )
