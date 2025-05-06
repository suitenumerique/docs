"""
Test template accesses create API endpoint for users in impress's core app.
"""

import random

import pytest
from rest_framework.test import APIClient

from core import factories, models
from core.tests.conftest import TEAM, USER, VIA

pytestmark = pytest.mark.django_db


def test_api_template_accesses_create_anonymous():
    """Anonymous users should not be allowed to create template accesses."""
    template = factories.TemplateFactory()

    other_user = factories.UserFactory()
    response = APIClient().post(
        f"/api/v1.0/templates/{template.id!s}/accesses/",
        {
            "user": str(other_user.id),
            "template": str(template.id),
            "role": random.choice(models.RoleChoices.values),
        },
        format="json",
    )

    assert response.status_code == 401
    assert response.json() == {
        "detail": "Authentication credentials were not provided."
    }
    assert models.TemplateAccess.objects.exists() is False


def test_api_template_accesses_create_authenticated_unrelated():
    """
    Authenticated users should not be allowed to create template accesses for a template to
    which they are not related.
    """
    user = factories.UserFactory(with_owned_template=True)

    client = APIClient()
    client.force_login(user)

    other_user = factories.UserFactory()
    template = factories.TemplateFactory()

    response = client.post(
        f"/api/v1.0/templates/{template.id!s}/accesses/",
        {
            "user": str(other_user.id),
        },
        format="json",
    )

    assert response.status_code == 403
    assert not models.TemplateAccess.objects.filter(user=other_user).exists()


@pytest.mark.parametrize("role", ["reader", "editor"])
@pytest.mark.parametrize("via", VIA)
def test_api_template_accesses_create_authenticated_editor_or_reader(
    via, role, mock_user_teams
):
    """Editors or readers of a template should not be allowed to create template accesses."""
    user = factories.UserFactory(with_owned_template=True)

    client = APIClient()
    client.force_login(user)

    template = factories.TemplateFactory()
    if via == USER:
        factories.UserTemplateAccessFactory(template=template, user=user, role=role)
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamTemplateAccessFactory(
            template=template, team="lasuite", role=role
        )

    other_user = factories.UserFactory()

    for new_role in [role[0] for role in models.RoleChoices.choices]:
        response = client.post(
            f"/api/v1.0/templates/{template.id!s}/accesses/",
            {
                "user": str(other_user.id),
                "role": new_role,
            },
            format="json",
        )

        assert response.status_code == 403

    assert not models.TemplateAccess.objects.filter(user=other_user).exists()


@pytest.mark.parametrize("via", VIA)
def test_api_template_accesses_create_authenticated_administrator(via, mock_user_teams):
    """
    Administrators of a template should be able to create template accesses
    except for the "owner" role.
    """
    user = factories.UserFactory(with_owned_template=True)

    client = APIClient()
    client.force_login(user)

    template = factories.TemplateFactory()
    if via == USER:
        factories.UserTemplateAccessFactory(
            template=template, user=user, role="administrator"
        )
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamTemplateAccessFactory(
            template=template, team="lasuite", role="administrator"
        )

    other_user = factories.UserFactory()

    # It should not be allowed to create an owner access
    response = client.post(
        f"/api/v1.0/templates/{template.id!s}/accesses/",
        {
            "user": str(other_user.id),
            "role": "owner",
        },
        format="json",
    )

    assert response.status_code == 403
    assert response.json() == {
        "detail": "Only owners of a template can assign other users as owners."
    }

    # It should be allowed to create a lower access
    role = random.choice(
        [role[0] for role in models.RoleChoices.choices if role[0] != "owner"]
    )

    response = client.post(
        f"/api/v1.0/templates/{template.id!s}/accesses/",
        {
            "user": str(other_user.id),
            "role": role,
        },
        format="json",
    )

    assert response.status_code == 201
    assert models.TemplateAccess.objects.filter(user=other_user).count() == 1
    new_template_access = models.TemplateAccess.objects.filter(user=other_user).get()
    assert response.json() == {
        "abilities": new_template_access.get_abilities(user),
        "id": str(new_template_access.id),
        "team": "",
        "role": role,
        "user": str(other_user.id),
    }


@pytest.mark.parametrize("via", VIA)
def test_api_template_accesses_create_authenticated_owner(via, mock_user_teams):
    """
    Owners of a template should be able to create template accesses whatever the role.
    """
    user = factories.UserFactory(with_owned_template=True)

    client = APIClient()
    client.force_login(user)

    template = factories.TemplateFactory()
    if via == USER:
        factories.UserTemplateAccessFactory(template=template, user=user, role="owner")
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamTemplateAccessFactory(
            template=template, team="lasuite", role="owner"
        )

    other_user = factories.UserFactory()

    role = random.choice([role[0] for role in models.RoleChoices.choices])

    response = client.post(
        f"/api/v1.0/templates/{template.id!s}/accesses/",
        {
            "user": str(other_user.id),
            "role": role,
        },
        format="json",
    )

    assert response.status_code == 201
    assert models.TemplateAccess.objects.filter(user=other_user).count() == 1
    new_template_access = models.TemplateAccess.objects.filter(user=other_user).get()
    assert response.json() == {
        "id": str(new_template_access.id),
        "user": str(other_user.id),
        "team": "",
        "role": role,
        "abilities": new_template_access.get_abilities(user),
    }
