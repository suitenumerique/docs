"""
Unit test for `index` command.
"""

from operator import itemgetter
from unittest import mock

from django.core.management import CommandError, call_command
from django.db import transaction

import pytest

from core import factories
from core.services.search_indexers import FindDocumentIndexer


@pytest.mark.django_db
@pytest.mark.usefixtures("indexer_settings")
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

    with mock.patch.object(FindDocumentIndexer, "push") as mock_push:
        call_command("index")

        push_call_args = [call.args[0] for call in mock_push.call_args_list]

        # called once but with a batch of docs
        mock_push.assert_called_once()

        assert sorted(push_call_args[0], key=itemgetter("id")) == sorted(
            [
                indexer.serialize_document(doc, accesses),
                indexer.serialize_document(no_title_doc, accesses),
            ],
            key=itemgetter("id"),
        )


@pytest.mark.django_db
@pytest.mark.usefixtures("indexer_settings")
def test_index_improperly_configured(indexer_settings):
    """The command should raise an exception if the indexer is not configured"""
    indexer_settings.SEARCH_INDEXER_CLASS = None

    with pytest.raises(CommandError) as err:
        call_command("index")

    assert str(err.value) == "The indexer is not enabled or properly configured."
