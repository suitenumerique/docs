"""
Test template accesses API endpoints for users in impress's core app.
"""

import random
from uuid import uuid4

import pytest
from rest_framework.test import APIClient

from core import factories, models
from core.api import serializers
from core.tests.conftest import TEAM, USER, VIA

pytestmark = pytest.mark.django_db


def test_api_template_accesses_list_anonymous():
    """Anonymous users should not be allowed to list template accesses."""
    template = factories.TemplateFactory()
    factories.UserTemplateAccessFactory.create_batch(2, template=template)

    response = APIClient().get(f"/api/v1.0/templates/{template.id!s}/accesses/")
    assert response.status_code == 401
    assert response.json() == {
        "detail": "Authentication credentials were not provided."
    }


def test_api_template_accesses_list_authenticated_unrelated():
    """
    Authenticated users should not be allowed to list template accesses for a template
    to which they are not related.
    """
    user = factories.UserFactory(with_owned_template=True)

    client = APIClient()
    client.force_login(user)

    template = factories.TemplateFactory()
    factories.UserTemplateAccessFactory.create_batch(3, template=template)

    # Accesses for other templates to which the user is related should not be listed either
    other_access = factories.UserTemplateAccessFactory(user=user)
    factories.UserTemplateAccessFactory(template=other_access.template)

    response = client.get(
        f"/api/v1.0/templates/{template.id!s}/accesses/",
    )
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.parametrize("via", VIA)
def test_api_template_accesses_list_authenticated_related(via, mock_user_teams):
    """
    Authenticated users should be able to list template accesses for a template
    to which they are directly related, whatever their role in the template.
    """
    user = factories.UserFactory(with_owned_template=True)

    client = APIClient()
    client.force_login(user)

    template = factories.TemplateFactory()
    user_access = None
    if via == USER:
        user_access = models.TemplateAccess.objects.create(
            template=template,
            user=user,
            role=random.choice(models.RoleChoices.values),
        )
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        user_access = models.TemplateAccess.objects.create(
            template=template,
            team="lasuite",
            role=random.choice(models.RoleChoices.values),
        )

    access1 = factories.TeamTemplateAccessFactory(template=template)
    access2 = factories.UserTemplateAccessFactory(template=template)

    # Accesses for other templates to which the user is related should not be listed either
    other_access = factories.UserTemplateAccessFactory(user=user)
    factories.UserTemplateAccessFactory(template=other_access.template)

    response = client.get(
        f"/api/v1.0/templates/{template.id!s}/accesses/",
    )

    assert response.status_code == 200
    content = response.json()
    assert len(content) == 3
    assert sorted(content, key=lambda x: x["id"]) == sorted(
        [
            {
                "id": str(user_access.id),
                "user": str(user.id) if via == "user" else None,
                "team": "lasuite" if via == "team" else "",
                "role": user_access.role,
                "abilities": user_access.get_abilities(user),
            },
            {
                "id": str(access1.id),
                "user": None,
                "team": access1.team,
                "role": access1.role,
                "abilities": access1.get_abilities(user),
            },
            {
                "id": str(access2.id),
                "user": str(access2.user.id),
                "team": "",
                "role": access2.role,
                "abilities": access2.get_abilities(user),
            },
        ],
        key=lambda x: x["id"],
    )


def test_api_template_accesses_retrieve_anonymous():
    """
    Anonymous users should not be allowed to retrieve a template access.
    """
    access = factories.UserTemplateAccessFactory()

    response = APIClient().get(
        f"/api/v1.0/templates/{access.template_id!s}/accesses/{access.id!s}/",
    )

    assert response.status_code == 401
    assert response.json() == {
        "detail": "Authentication credentials were not provided."
    }


def test_api_template_accesses_retrieve_authenticated_unrelated():
    """
    Authenticated users should not be allowed to retrieve a template access for
    a template to which they are not related.
    """
    user = factories.UserFactory(with_owned_template=True)

    client = APIClient()
    client.force_login(user)

    template = factories.TemplateFactory()
    access = factories.UserTemplateAccessFactory(template=template)

    response = client.get(
        f"/api/v1.0/templates/{template.id!s}/accesses/{access.id!s}/",
    )
    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }

    # Accesses related to another template should be excluded even if the user is related to it
    for access in [
        factories.UserTemplateAccessFactory(),
        factories.UserTemplateAccessFactory(user=user),
    ]:
        response = client.get(
            f"/api/v1.0/templates/{template.id!s}/accesses/{access.id!s}/",
        )

        assert response.status_code == 404
        assert response.json() == {
            "detail": "No TemplateAccess matches the given query."
        }


@pytest.mark.parametrize("via", VIA)
def test_api_template_accesses_retrieve_authenticated_related(via, mock_user_teams):
    """
    A user who is related to a template should be allowed to retrieve the
    associated template user accesses.
    """
    user = factories.UserFactory(with_owned_template=True)

    client = APIClient()
    client.force_login(user)

    template = factories.TemplateFactory()
    if via == USER:
        factories.UserTemplateAccessFactory(template=template, user=user)
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamTemplateAccessFactory(template=template, team="lasuite")

    access = factories.UserTemplateAccessFactory(template=template)

    response = client.get(
        f"/api/v1.0/templates/{template.id!s}/accesses/{access.id!s}/",
    )

    assert response.status_code == 200
    assert response.json() == {
        "id": str(access.id),
        "user": str(access.user.id),
        "team": "",
        "role": access.role,
        "abilities": access.get_abilities(user),
    }


def test_api_template_accesses_update_anonymous():
    """Anonymous users should not be allowed to update a template access."""
    access = factories.UserTemplateAccessFactory()
    old_values = serializers.TemplateAccessSerializer(instance=access).data

    new_values = {
        "id": uuid4(),
        "user": factories.UserFactory().id,
        "role": random.choice(models.RoleChoices.values),
    }

    api_client = APIClient()
    for field, value in new_values.items():
        response = api_client.put(
            f"/api/v1.0/templates/{access.template_id!s}/accesses/{access.id!s}/",
            {**old_values, field: value},
            format="json",
        )
        assert response.status_code == 401

    access.refresh_from_db()
    updated_values = serializers.TemplateAccessSerializer(instance=access).data
    assert updated_values == old_values


def test_api_template_accesses_update_authenticated_unrelated():
    """
    Authenticated users should not be allowed to update a template access for a template to which
    they are not related.
    """
    user = factories.UserFactory(with_owned_template=True)

    client = APIClient()
    client.force_login(user)

    access = factories.UserTemplateAccessFactory()

    old_values = serializers.TemplateAccessSerializer(instance=access).data
    new_values = {
        "id": uuid4(),
        "user": factories.UserFactory().id,
        "role": random.choice(models.RoleChoices.values),
    }

    for field, value in new_values.items():
        response = client.put(
            f"/api/v1.0/templates/{access.template_id!s}/accesses/{access.id!s}/",
            {**old_values, field: value},
            format="json",
        )
        assert response.status_code == 403

    access.refresh_from_db()
    updated_values = serializers.TemplateAccessSerializer(instance=access).data
    assert updated_values == old_values


@pytest.mark.parametrize("role", ["reader", "editor"])
@pytest.mark.parametrize("via", VIA)
def test_api_template_accesses_update_authenticated_editor_or_reader(
    via, role, mock_user_teams
):
    """Editors or readers of a template should not be allowed to update its accesses."""
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

    access = factories.UserTemplateAccessFactory(template=template)
    old_values = serializers.TemplateAccessSerializer(instance=access).data

    new_values = {
        "id": uuid4(),
        "user": factories.UserFactory().id,
        "role": random.choice(models.RoleChoices.values),
    }

    for field, value in new_values.items():
        response = client.put(
            f"/api/v1.0/templates/{access.template_id!s}/accesses/{access.id!s}/",
            {**old_values, field: value},
            format="json",
        )
        assert response.status_code == 403

    access.refresh_from_db()
    updated_values = serializers.TemplateAccessSerializer(instance=access).data
    assert updated_values == old_values


@pytest.mark.parametrize("via", VIA)
def test_api_template_accesses_update_administrator_except_owner(via, mock_user_teams):
    """
    A user who is a direct administrator in a template should be allowed to update a user
    access for this template, as long as they don't try to set the role to owner.
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

    access = factories.UserTemplateAccessFactory(
        template=template,
        role=random.choice(["administrator", "editor", "reader"]),
    )

    old_values = serializers.TemplateAccessSerializer(instance=access).data
    new_values = {
        "id": uuid4(),
        "user_id": factories.UserFactory().id,
        "role": random.choice(["administrator", "editor", "reader"]),
    }

    for field, value in new_values.items():
        new_data = {**old_values, field: value}
        response = client.put(
            f"/api/v1.0/templates/{template.id!s}/accesses/{access.id!s}/",
            data=new_data,
            format="json",
        )

        if (
            new_data["role"] == old_values["role"]
        ):  # we are not really updating the role
            assert response.status_code == 403
        else:
            assert response.status_code == 200

        access.refresh_from_db()
        updated_values = serializers.TemplateAccessSerializer(instance=access).data
        if field == "role":
            assert updated_values == {**old_values, "role": new_values["role"]}
        else:
            assert updated_values == old_values


@pytest.mark.parametrize("via", VIA)
def test_api_template_accesses_update_administrator_from_owner(via, mock_user_teams):
    """
    A user who is an administrator in a template, should not be allowed to update
    the user access of an "owner" for this template.
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
    access = factories.UserTemplateAccessFactory(
        template=template, user=other_user, role="owner"
    )

    old_values = serializers.TemplateAccessSerializer(instance=access).data
    new_values = {
        "id": uuid4(),
        "user_id": factories.UserFactory().id,
        "role": random.choice(models.RoleChoices.values),
    }

    for field, value in new_values.items():
        response = client.put(
            f"/api/v1.0/templates/{template.id!s}/accesses/{access.id!s}/",
            data={**old_values, field: value},
            format="json",
        )

        assert response.status_code == 403
        access.refresh_from_db()
        updated_values = serializers.TemplateAccessSerializer(instance=access).data
        assert updated_values == old_values


@pytest.mark.parametrize("via", VIA)
def test_api_template_accesses_update_administrator_to_owner(via, mock_user_teams):
    """
    A user who is an administrator in a template, should not be allowed to update
    the user access of another user to grant template ownership.
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
    access = factories.UserTemplateAccessFactory(
        template=template,
        user=other_user,
        role=random.choice(["administrator", "editor", "reader"]),
    )

    old_values = serializers.TemplateAccessSerializer(instance=access).data
    new_values = {
        "id": uuid4(),
        "user_id": factories.UserFactory().id,
        "role": "owner",
    }

    for field, value in new_values.items():
        new_data = {**old_values, field: value}
        response = client.put(
            f"/api/v1.0/templates/{template.id!s}/accesses/{access.id!s}/",
            data=new_data,
            format="json",
        )
        # We are not allowed or not really updating the role
        if field == "role" or new_data["role"] == old_values["role"]:
            assert response.status_code == 403
        else:
            assert response.status_code == 200

        access.refresh_from_db()
        updated_values = serializers.TemplateAccessSerializer(instance=access).data
        assert updated_values == old_values


@pytest.mark.parametrize("via", VIA)
def test_api_template_accesses_update_owner(via, mock_user_teams):
    """
    A user who is an owner in a template should be allowed to update
    a user access for this template whatever the role.
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

    factories.UserFactory()
    access = factories.UserTemplateAccessFactory(
        template=template,
    )

    old_values = serializers.TemplateAccessSerializer(instance=access).data
    new_values = {
        "id": uuid4(),
        "user_id": factories.UserFactory().id,
        "role": random.choice(models.RoleChoices.values),
    }

    for field, value in new_values.items():
        new_data = {**old_values, field: value}
        response = client.put(
            f"/api/v1.0/templates/{template.id!s}/accesses/{access.id!s}/",
            data=new_data,
            format="json",
        )

        if (
            new_data["role"] == old_values["role"]
        ):  # we are not really updating the role
            assert response.status_code == 403
        else:
            assert response.status_code == 200

        access.refresh_from_db()
        updated_values = serializers.TemplateAccessSerializer(instance=access).data

        if field == "role":
            assert updated_values == {**old_values, "role": new_values["role"]}
        else:
            assert updated_values == old_values


@pytest.mark.parametrize("via", VIA)
def test_api_template_accesses_update_owner_self(via, mock_user_teams):
    """
    A user who is owner of a template should be allowed to update
    their own user access provided there are other owners in the template.
    """
    user = factories.UserFactory(with_owned_template=True)

    client = APIClient()
    client.force_login(user)

    template = factories.TemplateFactory()
    if via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        access = factories.TeamTemplateAccessFactory(
            template=template, team="lasuite", role="owner"
        )
    else:
        access = factories.UserTemplateAccessFactory(
            template=template, user=user, role="owner"
        )

    old_values = serializers.TemplateAccessSerializer(instance=access).data
    new_role = random.choice(["administrator", "editor", "reader"])

    response = client.put(
        f"/api/v1.0/templates/{template.id!s}/accesses/{access.id!s}/",
        data={**old_values, "role": new_role},
        format="json",
    )

    assert response.status_code == 403
    access.refresh_from_db()
    assert access.role == "owner"

    # Add another owner and it should now work
    factories.UserTemplateAccessFactory(template=template, role="owner")

    response = client.put(
        f"/api/v1.0/templates/{template.id!s}/accesses/{access.id!s}/",
        data={**old_values, "role": new_role},
        format="json",
    )

    assert response.status_code == 200
    access.refresh_from_db()
    assert access.role == new_role


# Delete


def test_api_template_accesses_delete_anonymous():
    """Anonymous users should not be allowed to destroy a template access."""
    access = factories.UserTemplateAccessFactory()

    response = APIClient().delete(
        f"/api/v1.0/templates/{access.template_id!s}/accesses/{access.id!s}/",
    )

    assert response.status_code == 401
    assert models.TemplateAccess.objects.count() == 1


def test_api_template_accesses_delete_authenticated():
    """
    Authenticated users should not be allowed to delete a template access for a
    template to which they are not related.
    """
    user = factories.UserFactory(with_owned_template=True)

    client = APIClient()
    client.force_login(user)

    access = factories.UserTemplateAccessFactory()

    response = client.delete(
        f"/api/v1.0/templates/{access.template_id!s}/accesses/{access.id!s}/",
    )

    assert response.status_code == 403
    assert models.TemplateAccess.objects.count() == 2


@pytest.mark.parametrize("role", ["reader", "editor"])
@pytest.mark.parametrize("via", VIA)
def test_api_template_accesses_delete_editor_or_reader(via, role, mock_user_teams):
    """
    Authenticated users should not be allowed to delete a template access for a
    template in which they are a simple editor or reader.
    """
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

    access = factories.UserTemplateAccessFactory(template=template)

    assert models.TemplateAccess.objects.count() == 3
    assert models.TemplateAccess.objects.filter(user=access.user).exists()

    response = client.delete(
        f"/api/v1.0/templates/{template.id!s}/accesses/{access.id!s}/",
    )

    assert response.status_code == 403
    assert models.TemplateAccess.objects.count() == 3


@pytest.mark.parametrize("via", VIA)
def test_api_template_accesses_delete_administrators_except_owners(
    via, mock_user_teams
):
    """
    Users who are administrators in a template should be allowed to delete an access
    from the template provided it is not ownership.
    """
    user = factories.UserFactory()

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

    access = factories.UserTemplateAccessFactory(
        template=template, role=random.choice(["reader", "editor", "administrator"])
    )

    assert models.TemplateAccess.objects.count() == 2
    assert models.TemplateAccess.objects.filter(user=access.user).exists()

    response = client.delete(
        f"/api/v1.0/templates/{template.id!s}/accesses/{access.id!s}/",
    )

    assert response.status_code == 204
    assert models.TemplateAccess.objects.count() == 1


@pytest.mark.parametrize("via", VIA)
def test_api_template_accesses_delete_administrator_on_owners(via, mock_user_teams):
    """
    Users who are administrators in a template should not be allowed to delete an ownership
    access from the template.
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

    access = factories.UserTemplateAccessFactory(template=template, role="owner")

    assert models.TemplateAccess.objects.count() == 3
    assert models.TemplateAccess.objects.filter(user=access.user).exists()

    response = client.delete(
        f"/api/v1.0/templates/{template.id!s}/accesses/{access.id!s}/",
    )

    assert response.status_code == 403
    assert models.TemplateAccess.objects.count() == 3


@pytest.mark.parametrize("via", VIA)
def test_api_template_accesses_delete_owners(via, mock_user_teams):
    """
    Users should be able to delete the template access of another user
    for a template of which they are owner.
    """
    user = factories.UserFactory()

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

    access = factories.UserTemplateAccessFactory(template=template)

    assert models.TemplateAccess.objects.count() == 2
    assert models.TemplateAccess.objects.filter(user=access.user).exists()

    response = client.delete(
        f"/api/v1.0/templates/{template.id!s}/accesses/{access.id!s}/",
    )

    assert response.status_code == 204
    assert models.TemplateAccess.objects.count() == 1


@pytest.mark.parametrize("via", VIA)
def test_api_template_accesses_delete_owners_last_owner(via, mock_user_teams):
    """
    It should not be possible to delete the last owner access from a template
    """
    user = factories.UserFactory(with_owned_template=True)

    client = APIClient()
    client.force_login(user)

    template = factories.TemplateFactory()
    access = None
    if via == USER:
        access = factories.UserTemplateAccessFactory(
            template=template, user=user, role="owner"
        )
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        access = factories.TeamTemplateAccessFactory(
            template=template, team="lasuite", role="owner"
        )

    assert models.TemplateAccess.objects.count() == 2
    response = client.delete(
        f"/api/v1.0/templates/{template.id!s}/accesses/{access.id!s}/",
    )

    assert response.status_code == 403
    assert models.TemplateAccess.objects.count() == 2
