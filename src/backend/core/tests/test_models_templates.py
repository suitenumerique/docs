"""
Unit tests for the Template model
"""

from django.contrib.auth.models import AnonymousUser
from django.core.exceptions import ValidationError

import pytest

from core import factories, models

pytestmark = pytest.mark.django_db


def test_models_templates_str():
    """The str representation should be the title of the template."""
    template = factories.TemplateFactory(title="admins")
    assert str(template) == "admins"


def test_models_templates_id_unique():
    """The "id" field should be unique."""
    template = factories.TemplateFactory()
    with pytest.raises(ValidationError, match="Template with this Id already exists."):
        factories.TemplateFactory(id=template.id)


def test_models_templates_title_null():
    """The "title" field should not be null."""
    with pytest.raises(ValidationError, match="This field cannot be null."):
        models.Template.objects.create(title=None)


def test_models_templates_title_empty():
    """The "title" field should not be empty."""
    with pytest.raises(ValidationError, match="This field cannot be blank."):
        models.Template.objects.create(title="")


def test_models_templates_title_max_length():
    """The "title" field should be 100 characters maximum."""
    factories.TemplateFactory(title="a" * 255)
    with pytest.raises(
        ValidationError,
        match=r"Ensure this value has at most 255 characters \(it has 256\)\.",
    ):
        factories.TemplateFactory(title="a" * 256)


# get_abilities


def test_models_templates_get_abilities_anonymous_public():
    """Check abilities returned for an anonymous user if the template is public."""
    template = factories.TemplateFactory(is_public=True)
    abilities = template.get_abilities(AnonymousUser())
    assert abilities == {
        "destroy": False,
        "retrieve": True,
        "update": False,
        "accesses_manage": False,
        "partial_update": False,
        "generate_document": True,
    }


def test_models_templates_get_abilities_anonymous_not_public():
    """Check abilities returned for an anonymous user if the template is private."""
    template = factories.TemplateFactory(is_public=False)
    abilities = template.get_abilities(AnonymousUser())
    assert abilities == {
        "destroy": False,
        "retrieve": False,
        "update": False,
        "accesses_manage": False,
        "partial_update": False,
        "generate_document": False,
    }


def test_models_templates_get_abilities_authenticated_public():
    """Check abilities returned for an authenticated user if the user is public."""
    template = factories.TemplateFactory(is_public=True)
    abilities = template.get_abilities(factories.UserFactory())
    assert abilities == {
        "destroy": False,
        "retrieve": True,
        "update": False,
        "accesses_manage": False,
        "partial_update": False,
        "generate_document": True,
    }


def test_models_templates_get_abilities_authenticated_not_public():
    """Check abilities returned for an authenticated user if the template is private."""
    template = factories.TemplateFactory(is_public=False)
    abilities = template.get_abilities(factories.UserFactory())
    assert abilities == {
        "destroy": False,
        "retrieve": False,
        "update": False,
        "accesses_manage": False,
        "partial_update": False,
        "generate_document": False,
    }


def test_models_templates_get_abilities_owner():
    """Check abilities returned for the owner of a template."""
    user = factories.UserFactory()
    access = factories.UserTemplateAccessFactory(role="owner", user=user)
    abilities = access.template.get_abilities(access.user)
    assert abilities == {
        "destroy": True,
        "retrieve": True,
        "update": True,
        "accesses_manage": True,
        "partial_update": True,
        "generate_document": True,
    }


def test_models_templates_get_abilities_administrator():
    """Check abilities returned for the administrator of a template."""
    access = factories.UserTemplateAccessFactory(role="administrator")
    abilities = access.template.get_abilities(access.user)
    assert abilities == {
        "destroy": False,
        "retrieve": True,
        "update": True,
        "accesses_manage": True,
        "partial_update": True,
        "generate_document": True,
    }


def test_models_templates_get_abilities_editor_user(django_assert_num_queries):
    """Check abilities returned for the editor of a template."""
    access = factories.UserTemplateAccessFactory(role="editor")

    with django_assert_num_queries(1):
        abilities = access.template.get_abilities(access.user)

    assert abilities == {
        "destroy": False,
        "retrieve": True,
        "update": True,
        "accesses_manage": False,
        "partial_update": True,
        "generate_document": True,
    }


def test_models_templates_get_abilities_reader_user(django_assert_num_queries):
    """Check abilities returned for the reader of a template."""
    access = factories.UserTemplateAccessFactory(role="reader")

    with django_assert_num_queries(1):
        abilities = access.template.get_abilities(access.user)

    assert abilities == {
        "destroy": False,
        "retrieve": True,
        "update": False,
        "accesses_manage": False,
        "partial_update": False,
        "generate_document": True,
    }


def test_models_templates_get_abilities_preset_role(django_assert_num_queries):
    """No query is done if the role is preset e.g. with query annotation."""
    access = factories.UserTemplateAccessFactory(role="reader")
    access.template.user_roles = ["reader"]

    with django_assert_num_queries(0):
        abilities = access.template.get_abilities(access.user)

    assert abilities == {
        "destroy": False,
        "retrieve": True,
        "update": False,
        "accesses_manage": False,
        "partial_update": False,
        "generate_document": True,
    }
