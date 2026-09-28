"""Tests for the create_tree_node_with_retry utils."""

from unittest import mock

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError

import pytest

from core.factories import UserFactory
from core.models import Document
from core.utils.treebeard import _is_tree_path_collision, create_tree_node_with_retry

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize(
    "exc",
    [
        DjangoValidationError({"path": "not unique"}),
        IntegrityError("impress_document_path_key"),
    ],
)
def test_utils_create_tree_node_with_retry_exceed_max_attempts(settings, exc):
    """Test exceeding the max attempts should reraise the exception."""

    settings.TREEBEARD_PATH_COMPUTE_RETRY_MAX_ATTEMPTS = 2

    create_fn = mock.MagicMock()
    create_fn.side_effect = exc

    with (
        pytest.raises(exc.__class__),
        mock.patch(
            "core.utils.treebeard._is_tree_path_collision"
        ) as mock__is_tree_path_collision,
    ):
        mock__is_tree_path_collision.side_effect = _is_tree_path_collision
        create_tree_node_with_retry(create_fn)

    mock__is_tree_path_collision.assert_called()
    assert mock__is_tree_path_collision.call_count == 2
    assert create_fn.call_count == 2


@pytest.mark.parametrize(
    "exc",
    [
        DjangoValidationError({"foo": "bar"}),
        IntegrityError("not handled"),
    ],
)
def test_utils_create_tree_node_with_retry_exceed_exception_not_handled(settings, exc):
    """Test with an exception not handled should return reraise it immediately."""

    settings.TREEBEARD_PATH_COMPUTE_RETRY_MAX_ATTEMPTS = 2

    create_fn = mock.MagicMock()
    create_fn.side_effect = exc

    with (
        pytest.raises(exc.__class__),
        mock.patch(
            "core.utils.treebeard._is_tree_path_collision"
        ) as mock__is_tree_path_collision,
    ):
        mock__is_tree_path_collision.side_effect = _is_tree_path_collision
        create_tree_node_with_retry(create_fn)

    mock__is_tree_path_collision.assert_called()
    assert mock__is_tree_path_collision.call_count == 1
    assert create_fn.call_count == 1


def test_utils_create_tree_node_with_retry_success():
    """Test executing successfully the create_fn callback."""

    user = UserFactory()

    document = create_tree_node_with_retry(
        lambda: Document.add_root(
            creator=user,
            title="success",
        )
    )

    assert isinstance(document, Document)
    assert document.title == "success"
    assert document.path is not None
