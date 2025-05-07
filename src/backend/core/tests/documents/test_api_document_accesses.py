"""
Test document accesses API endpoints for users in impress's core app.
"""
# pylint: disable=too-many-lines

import random
from uuid import uuid4

import pytest
from rest_framework.test import APIClient

from core import choices, factories, models
from core.api import serializers
from core.tests.conftest import TEAM, USER, VIA
from core.tests.test_services_collaboration_services import (  # pylint: disable=unused-import
    mock_reset_connections,
)

pytestmark = pytest.mark.django_db


def test_api_document_accesses_list_anonymous():
    """Anonymous users should not be allowed to list document accesses."""
    document = factories.DocumentFactory()
    factories.UserDocumentAccessFactory.create_batch(2, document=document)

    response = APIClient().get(f"/api/v1.0/documents/{document.id!s}/accesses/")
    assert response.status_code == 401
    assert response.json() == {
        "detail": "Authentication credentials were not provided."
    }


def test_api_document_accesses_list_authenticated_unrelated():
    """
    Authenticated users should not be allowed to list document accesses for a document
    to which they are not related.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory()
    factories.UserDocumentAccessFactory.create_batch(3, document=document)

    # Accesses for other documents to which the user is related should not be listed either
    other_access = factories.UserDocumentAccessFactory(user=user)
    factories.UserDocumentAccessFactory(document=other_access.document)

    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/accesses/",
    )
    assert response.status_code == 200
    assert response.json() == []


def test_api_document_accesses_list_unexisting_document():
    """
    Listing document accesses for an unexisting document should return an empty list.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    response = client.get(f"/api/v1.0/documents/{uuid4()!s}/accesses/")
    assert response.status_code == 404
    assert response.json() == {"detail": "Not found."}


@pytest.mark.parametrize("via", VIA)
@pytest.mark.parametrize(
    "role",
    [role for role in choices.RoleChoices if role not in choices.PRIVILEGED_ROLES],
)
def test_api_document_accesses_list_authenticated_related_non_privileged(
    via, role, mock_user_teams, django_assert_num_queries
):
    """
    Authenticated users with no privileged role should only be able to list document
    accesses associated with privileged roles for a document, including from ancestors.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    # Create documents structured as a tree
    unreadable_ancestor = factories.DocumentFactory(link_reach="restricted")
    # make all documents below the grand parent readable without a specific access for the user
    grand_parent = factories.DocumentFactory(
        parent=unreadable_ancestor, link_reach="authenticated"
    )
    parent = factories.DocumentFactory(parent=grand_parent)
    document = factories.DocumentFactory(parent=parent)
    child = factories.DocumentFactory(parent=document)

    # Create accesses related to each document
    accesses = (
        factories.UserDocumentAccessFactory(document=unreadable_ancestor),
        factories.UserDocumentAccessFactory(document=grand_parent),
        factories.UserDocumentAccessFactory(document=parent),
        factories.UserDocumentAccessFactory(document=document),
        factories.TeamDocumentAccessFactory(document=document),
    )
    factories.UserDocumentAccessFactory(document=child)

    if via == USER:
        models.DocumentAccess.objects.create(
            document=document,
            user=user,
            role=role,
        )
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        models.DocumentAccess.objects.create(
            document=document,
            team="lasuite",
            role=role,
        )

    # Accesses for other documents to which the user is related should not be listed either
    other_access = factories.UserDocumentAccessFactory(user=user)
    factories.UserDocumentAccessFactory(document=other_access.document)

    with django_assert_num_queries(3):
        response = client.get(f"/api/v1.0/documents/{document.id!s}/accesses/")

    assert response.status_code == 200
    content = response.json()

    # Make sure only privileged roles are returned
    privileged_accesses = [
        acc for acc in accesses if acc.role in choices.PRIVILEGED_ROLES
    ]
    assert len(content) == len(privileged_accesses)

    assert sorted(content, key=lambda x: x["id"]) == sorted(
        [
            {
                "id": str(access.id),
                "document": {
                    "id": str(access.document_id),
                    "path": access.document.path,
                    "depth": access.document.depth,
                },
                "user": {
                    "full_name": access.user.full_name,
                    "short_name": access.user.short_name,
                }
                if access.user
                else None,
                "team": access.team,
                "role": access.role,
                "max_ancestors_role": None,
                "abilities": {
                    "destroy": False,
                    "partial_update": False,
                    "retrieve": False,
                    "set_role_to": [],
                    "update": False,
                },
            }
            for access in privileged_accesses
        ],
        key=lambda x: x["id"],
    )


@pytest.mark.parametrize("via", VIA)
@pytest.mark.parametrize(
    "role", [role for role in choices.RoleChoices if role in choices.PRIVILEGED_ROLES]
)
def test_api_document_accesses_list_authenticated_related_privileged(
    via, role, mock_user_teams, django_assert_num_queries
):
    """
    Authenticated users with a privileged role should be able to list all
    document accesses whatever the role, including from ancestors.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    # Create documents structured as a tree
    unreadable_ancestor = factories.DocumentFactory(link_reach="restricted")
    # make all documents below the grand parent readable without a specific access for the user
    grand_parent = factories.DocumentFactory(
        parent=unreadable_ancestor, link_reach="authenticated"
    )
    parent = factories.DocumentFactory(parent=grand_parent)
    document = factories.DocumentFactory(parent=parent)
    child = factories.DocumentFactory(parent=document)

    if via == USER:
        user_access = models.DocumentAccess.objects.create(
            document=document,
            user=user,
            role=role,
        )
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        user_access = models.DocumentAccess.objects.create(
            document=document,
            team="lasuite",
            role=role,
        )
    else:
        raise RuntimeError()

    # Create accesses related to each document
    ancestors_accesses = [
        # Access on unreadable ancestor should still be listed
        # as the related user gains access to our document
        factories.UserDocumentAccessFactory(document=unreadable_ancestor),
        factories.UserDocumentAccessFactory(document=grand_parent),
        factories.UserDocumentAccessFactory(document=parent),
    ]
    document_accesses = [
        factories.UserDocumentAccessFactory(document=document),
        factories.TeamDocumentAccessFactory(document=document),
        factories.UserDocumentAccessFactory(document=document),
        user_access,
    ]
    factories.UserDocumentAccessFactory(document=child)

    # Accesses for other documents to which the user is related should not be listed either
    other_access = factories.UserDocumentAccessFactory(user=user)
    factories.UserDocumentAccessFactory(document=other_access.document)

    with django_assert_num_queries(3):
        response = client.get(f"/api/v1.0/documents/{document.id!s}/accesses/")

    assert response.status_code == 200
    content = response.json()
    assert len(content) == 7
    assert sorted(content, key=lambda x: x["id"]) == sorted(
        [
            {
                "id": str(access.id),
                "document": {
                    "id": str(access.document_id),
                    "path": access.document.path,
                    "depth": access.document.depth,
                },
                "user": {
                    "id": str(access.user.id),
                    "email": access.user.email,
                    "language": access.user.language,
                    "full_name": access.user.full_name,
                    "short_name": access.user.short_name,
                }
                if access.user
                else None,
                "max_ancestors_role": None,
                "team": access.team,
                "role": access.role,
                "abilities": access.get_abilities(user),
            }
            for access in ancestors_accesses + document_accesses
        ],
        key=lambda x: x["id"],
    )


def test_api_document_accesses_retrieve_set_role_to_child():
    """Check set_role_to for an access with no access on the ancestor."""
    user, other_user = factories.UserFactory.create_batch(2)
    client = APIClient()
    client.force_login(user)

    parent = factories.DocumentFactory()
    parent_access = factories.UserDocumentAccessFactory(
        document=parent, user=user, role="owner"
    )

    document = factories.DocumentFactory(parent=parent)
    document_access_other_user = factories.UserDocumentAccessFactory(
        document=document, user=other_user, role="editor"
    )

    response = client.get(f"/api/v1.0/documents/{document.id!s}/accesses/")

    assert response.status_code == 200
    content = response.json()
    assert len(content) == 2

    result_dict = {
        result["id"]: result["abilities"]["set_role_to"] for result in content
    }
    assert result_dict[str(document_access_other_user.id)] == [
        "reader",
        "editor",
        "administrator",
        "owner",
    ]
    assert result_dict[str(parent_access.id)] == []

    # Add an access for the other user on the parent
    parent_access_other_user = factories.UserDocumentAccessFactory(
        document=parent, user=other_user, role="editor"
    )

    response = client.get(f"/api/v1.0/documents/{document.id!s}/accesses/")

    assert response.status_code == 200
    content = response.json()
    assert len(content) == 3

    result_dict = {
        result["id"]: result["abilities"]["set_role_to"] for result in content
    }
    assert result_dict[str(document_access_other_user.id)] == [
        "administrator",
        "owner",
    ]
    assert result_dict[str(parent_access.id)] == []
    assert result_dict[str(parent_access_other_user.id)] == [
        "reader",
        "editor",
        "administrator",
        "owner",
    ]


@pytest.mark.parametrize(
    "roles,results",
    [
        [
            ["administrator", "reader", "reader", "reader"],
            [
                ["reader", "editor", "administrator"],
                [],
                [],
                ["editor", "administrator"],
            ],
        ],
        [
            ["owner", "reader", "reader", "reader"],
            [
                ["reader", "editor", "administrator", "owner"],
                [],
                [],
                ["editor", "administrator", "owner"],
            ],
        ],
        [
            ["owner", "reader", "reader", "owner"],
            [
                ["reader", "editor", "administrator", "owner"],
                [],
                [],
                ["editor", "administrator", "owner"],
            ],
        ],
    ],
)
def test_api_document_accesses_list_authenticated_related_same_user(roles, results):
    """
    The maximum role across ancestor documents and set_role_to options for
    a given user should be filled as expected.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    # Create documents structured as a tree
    grand_parent = factories.DocumentFactory(link_reach="authenticated")
    parent = factories.DocumentFactory(parent=grand_parent)
    document = factories.DocumentFactory(parent=parent)

    # Create accesses for another user
    other_user = factories.UserFactory()
    accesses = [
        factories.UserDocumentAccessFactory(
            document=document, user=user, role=roles[0]
        ),
        factories.UserDocumentAccessFactory(
            document=grand_parent, user=other_user, role=roles[1]
        ),
        factories.UserDocumentAccessFactory(
            document=parent, user=other_user, role=roles[2]
        ),
        factories.UserDocumentAccessFactory(
            document=document, user=other_user, role=roles[3]
        ),
    ]

    response = client.get(f"/api/v1.0/documents/{document.id!s}/accesses/")

    assert response.status_code == 200
    content = response.json()
    assert len(content) == 4

    for result in content:
        assert (
            result["max_ancestors_role"] is None
            if result["user"]["id"] == str(user.id)
            else choices.RoleChoices.max(roles[1], roles[2])
        )

    result_dict = {
        result["id"]: result["abilities"]["set_role_to"] for result in content
    }
    assert [result_dict[str(access.id)] for access in accesses] == results


@pytest.mark.parametrize(
    "roles,results",
    [
        [
            ["administrator", "reader", "reader", "reader"],
            [
                ["reader", "editor", "administrator"],
                [],
                [],
                ["editor", "administrator"],
            ],
        ],
        [
            ["owner", "reader", "reader", "reader"],
            [
                ["reader", "editor", "administrator", "owner"],
                [],
                [],
                ["editor", "administrator", "owner"],
            ],
        ],
        [
            ["owner", "reader", "reader", "owner"],
            [
                ["reader", "editor", "administrator", "owner"],
                [],
                [],
                ["editor", "administrator", "owner"],
            ],
        ],
        [
            ["reader", "reader", "reader", "owner"],
            [
                ["reader", "editor", "administrator", "owner"],
                [],
                [],
                ["editor", "administrator", "owner"],
            ],
        ],
        [
            ["reader", "administrator", "reader", "editor"],
            [
                ["reader", "editor", "administrator"],
                ["reader", "editor", "administrator"],
                [],
                [],
            ],
        ],
        [
            ["editor", "editor", "administrator", "editor"],
            [
                ["reader", "editor", "administrator"],
                [],
                ["administrator"],
                [],
            ],
        ],
    ],
)
def test_api_document_accesses_list_authenticated_related_same_team(
    roles, results, mock_user_teams
):
    """
    The maximum role across ancestor documents and set_role_to optionsfor
    a given team should be filled as expected.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    # Create documents structured as a tree
    grand_parent = factories.DocumentFactory(link_reach="authenticated")
    parent = factories.DocumentFactory(parent=grand_parent)
    document = factories.DocumentFactory(parent=parent)

    mock_user_teams.return_value = ["lasuite", "unknown"]
    accesses = [
        factories.UserDocumentAccessFactory(
            document=document, user=user, role=roles[0]
        ),
        # Create accesses for a team
        factories.TeamDocumentAccessFactory(
            document=grand_parent, team="lasuite", role=roles[1]
        ),
        factories.TeamDocumentAccessFactory(
            document=parent, team="lasuite", role=roles[2]
        ),
        factories.TeamDocumentAccessFactory(
            document=document, team="lasuite", role=roles[3]
        ),
    ]

    response = client.get(f"/api/v1.0/documents/{document.id!s}/accesses/")

    assert response.status_code == 200
    content = response.json()
    assert len(content) == 4

    for result in content:
        assert (
            result["max_ancestors_role"] is None
            if result["user"] and result["user"]["id"] == str(user.id)
            else choices.RoleChoices.max(roles[1], roles[2])
        )

    result_dict = {
        result["id"]: result["abilities"]["set_role_to"] for result in content
    }
    assert [result_dict[str(access.id)] for access in accesses] == results


def test_api_document_accesses_retrieve_anonymous():
    """
    Anonymous users should not be allowed to retrieve a document access.
    """
    access = factories.UserDocumentAccessFactory()

    response = APIClient().get(
        f"/api/v1.0/documents/{access.document_id!s}/accesses/{access.id!s}/",
    )

    assert response.status_code == 401
    assert response.json() == {
        "detail": "Authentication credentials were not provided."
    }


def test_api_document_accesses_retrieve_authenticated_unrelated():
    """
    Authenticated users should not be allowed to retrieve a document access for
    a document to which they are not related.
    """
    user = factories.UserFactory(with_owned_document=True)

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory()
    access = factories.UserDocumentAccessFactory(document=document)

    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/accesses/{access.id!s}/",
    )
    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }

    # Accesses related to another document should be excluded even if the user is related to it
    for access in [
        factories.UserDocumentAccessFactory(),
        factories.UserDocumentAccessFactory(user=user),
    ]:
        response = client.get(
            f"/api/v1.0/documents/{document.id!s}/accesses/{access.id!s}/",
        )

        assert response.status_code == 404
        assert response.json() == {
            "detail": "No DocumentAccess matches the given query."
        }


@pytest.mark.parametrize("via", VIA)
@pytest.mark.parametrize("role", models.RoleChoices)
def test_api_document_accesses_retrieve_authenticated_related(
    via,
    role,
    mock_user_teams,
):
    """
    A user who is related to a document should be allowed to retrieve the
    associated document user accesses.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory()
    if via == USER:
        factories.UserDocumentAccessFactory(document=document, user=user, role=role)
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(
            document=document, team="lasuite", role=role
        )

    access = factories.UserDocumentAccessFactory(document=document)

    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/accesses/{access.id!s}/",
    )

    if not role in choices.PRIVILEGED_ROLES:
        assert response.status_code == 403
    else:
        access_user = serializers.UserSerializer(instance=access.user).data

        assert response.status_code == 200
        assert response.json() == {
            "id": str(access.id),
            "abilities": access.get_abilities(user),
            "document": {
                "id": str(access.document_id),
                "path": access.document.path,
                "depth": access.document.depth,
            },
            "user": access_user,
            "team": "",
            "role": access.role,
            "max_ancestors_role": None,
        }


def test_api_document_accesses_update_anonymous():
    """Anonymous users should not be allowed to update a document access."""
    access = factories.UserDocumentAccessFactory()
    old_values = serializers.DocumentAccessSerializer(instance=access).data

    new_values = {
        "id": uuid4(),
        "user": factories.UserFactory().id,
        "role": random.choice(models.RoleChoices.values),
    }

    api_client = APIClient()
    for field, value in new_values.items():
        response = api_client.put(
            f"/api/v1.0/documents/{access.document_id!s}/accesses/{access.id!s}/",
            {**old_values, field: value},
            format="json",
        )
        assert response.status_code == 401

    access.refresh_from_db()
    updated_values = serializers.DocumentAccessSerializer(instance=access).data
    assert updated_values == old_values


def test_api_document_accesses_update_authenticated_unrelated():
    """
    Authenticated users should not be allowed to update a document access for a document to which
    they are not related.
    """
    user = factories.UserFactory(with_owned_document=True)

    client = APIClient()
    client.force_login(user)

    access = factories.UserDocumentAccessFactory()
    old_values = serializers.DocumentAccessSerializer(instance=access).data

    new_values = {
        "id": uuid4(),
        "user": factories.UserFactory().id,
        "role": random.choice(models.RoleChoices.values),
    }

    for field, value in new_values.items():
        response = client.put(
            f"/api/v1.0/documents/{access.document_id!s}/accesses/{access.id!s}/",
            {**old_values, field: value},
            format="json",
        )
        assert response.status_code == 403

    access.refresh_from_db()
    updated_values = serializers.DocumentAccessSerializer(instance=access).data
    assert updated_values == old_values


@pytest.mark.parametrize("role", ["reader", "editor"])
@pytest.mark.parametrize("via", VIA)
def test_api_document_accesses_update_authenticated_reader_or_editor(
    via, role, mock_user_teams
):
    """Readers or editors of a document should not be allowed to update its accesses."""
    user = factories.UserFactory(with_owned_document=True)

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory()
    if via == USER:
        factories.UserDocumentAccessFactory(document=document, user=user, role=role)
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(
            document=document, team="lasuite", role=role
        )

    access = factories.UserDocumentAccessFactory(document=document)
    old_values = serializers.DocumentAccessSerializer(instance=access).data

    new_values = {
        "id": uuid4(),
        "user": factories.UserFactory().id,
        "role": random.choice(models.RoleChoices.values),
    }

    for field, value in new_values.items():
        response = client.put(
            f"/api/v1.0/documents/{access.document_id!s}/accesses/{access.id!s}/",
            {**old_values, field: value},
            format="json",
        )
        assert response.status_code == 403

    access.refresh_from_db()
    updated_values = serializers.DocumentAccessSerializer(instance=access).data
    assert updated_values == old_values


@pytest.mark.parametrize("via", VIA)
@pytest.mark.parametrize("create_for", VIA)
def test_api_document_accesses_update_administrator_except_owner(
    create_for,
    via,
    mock_user_teams,
    mock_reset_connections,  # pylint: disable=redefined-outer-name
):
    """
    A user who is a direct administrator in a document should be allowed to update a user
    access for this document, as long as they don't try to set the role to owner.
    """
    user = factories.UserFactory(with_owned_document=True)

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory()
    if via == USER:
        factories.UserDocumentAccessFactory(
            document=document, user=user, role="administrator"
        )
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(
            document=document, team="lasuite", role="administrator"
        )

    access = factories.UserDocumentAccessFactory(
        document=document,
        role=random.choice(["administrator", "editor", "reader"]),
    )
    old_values = serializers.DocumentAccessSerializer(instance=access).data

    new_values = {
        "id": uuid4(),
        "role": random.choice(["administrator", "editor", "reader"]),
    }
    if create_for == USER:
        new_values["user_id"] = factories.UserFactory().id
    elif create_for == TEAM:
        new_values["team"] = "new-team"

    for field, value in new_values.items():
        new_data = {**old_values, field: value}
        with mock_reset_connections(document.id, str(access.user_id)):
            response = client.put(
                f"/api/v1.0/documents/{document.id!s}/accesses/{access.id!s}/",
                data=new_data,
                format="json",
            )
            assert response.status_code == 200

        access.refresh_from_db()
        updated_values = serializers.DocumentAccessSerializer(instance=access).data
        if field == "role":
            assert updated_values == {
                **old_values,
                "role": new_values["role"],
            }
        else:
            assert updated_values == old_values


@pytest.mark.parametrize("via", VIA)
def test_api_document_accesses_update_administrator_from_owner(via, mock_user_teams):
    """
    A user who is an administrator in a document, should not be allowed to update
    the user access of an "owner" for this document.
    """
    user = factories.UserFactory(with_owned_document=True)

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory()
    if via == USER:
        factories.UserDocumentAccessFactory(
            document=document, user=user, role="administrator"
        )
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(
            document=document, team="lasuite", role="administrator"
        )

    other_user = factories.UserFactory()
    access = factories.UserDocumentAccessFactory(
        document=document, user=other_user, role="owner"
    )
    old_values = serializers.DocumentAccessSerializer(instance=access).data

    new_values = {
        "id": uuid4(),
        "user_id": factories.UserFactory().id,
        "role": random.choice(models.RoleChoices.values),
    }

    for field, value in new_values.items():
        response = client.put(
            f"/api/v1.0/documents/{document.id!s}/accesses/{access.id!s}/",
            data={**old_values, field: value},
            format="json",
        )

        assert response.status_code == 403
        access.refresh_from_db()
        updated_values = serializers.DocumentAccessSerializer(instance=access).data
        assert updated_values == old_values


@pytest.mark.parametrize("via", VIA)
def test_api_document_accesses_update_administrator_to_owner(
    via,
    mock_user_teams,
    mock_reset_connections,  # pylint: disable=redefined-outer-name
):
    """
    A user who is an administrator in a document, should not be allowed to update
    the user access of another user to grant document ownership.
    """
    user = factories.UserFactory(with_owned_document=True)

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory()
    if via == USER:
        factories.UserDocumentAccessFactory(
            document=document, user=user, role="administrator"
        )
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(
            document=document, team="lasuite", role="administrator"
        )

    other_user = factories.UserFactory()
    access = factories.UserDocumentAccessFactory(
        document=document,
        user=other_user,
        role=random.choice(["administrator", "editor", "reader"]),
    )
    old_values = serializers.DocumentAccessSerializer(instance=access).data

    new_values = {
        "id": uuid4(),
        "user_id": factories.UserFactory().id,
        "role": "owner",
    }

    for field, value in new_values.items():
        new_data = {**old_values, field: value}
        # We are not allowed or not really updating the role
        if field == "role":
            response = client.put(
                f"/api/v1.0/documents/{document.id!s}/accesses/{access.id!s}/",
                data=new_data,
                format="json",
            )

            assert response.status_code == 403
        else:
            with mock_reset_connections(document.id, str(access.user_id)):
                response = client.put(
                    f"/api/v1.0/documents/{document.id!s}/accesses/{access.id!s}/",
                    data=new_data,
                    format="json",
                )
                assert response.status_code == 200

        access.refresh_from_db()
        updated_values = serializers.DocumentAccessSerializer(instance=access).data
        assert updated_values == old_values


@pytest.mark.parametrize("via", VIA)
@pytest.mark.parametrize("create_for", VIA)
def test_api_document_accesses_update_owner(
    create_for,
    via,
    mock_user_teams,
    mock_reset_connections,  # pylint: disable=redefined-outer-name
):
    """
    A user who is an owner in a document should be allowed to update
    a user access for this document whatever the role.
    """
    user = factories.UserFactory(with_owned_document=True)

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory()
    if via == USER:
        factories.UserDocumentAccessFactory(document=document, user=user, role="owner")
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(
            document=document, team="lasuite", role="owner"
        )

    factories.UserFactory()
    access = factories.UserDocumentAccessFactory(
        document=document,
    )
    old_values = serializers.DocumentAccessSerializer(instance=access).data

    new_values = {
        "id": uuid4(),
        "role": random.choice(models.RoleChoices.values),
    }
    if create_for == USER:
        new_values["user_id"] = factories.UserFactory().id
    elif create_for == TEAM:
        new_values["team"] = "new-team"

    for field, value in new_values.items():
        new_data = {**old_values, field: value}
        with mock_reset_connections(document.id, str(access.user_id)):
            response = client.put(
                f"/api/v1.0/documents/{document.id!s}/accesses/{access.id!s}/",
                data=new_data,
                format="json",
            )

            assert response.status_code == 200

        access.refresh_from_db()
        updated_values = serializers.DocumentAccessSerializer(instance=access).data

        if field == "role":
            assert updated_values == {
                **old_values,
                "role": new_values["role"],
            }
        else:
            assert updated_values == old_values


@pytest.mark.parametrize("via", VIA)
def test_api_document_accesses_update_owner_self_root(
    via,
    mock_user_teams,
    mock_reset_connections,  # pylint: disable=redefined-outer-name
):
    """
    A user who is owner of a document should be allowed to update
    their own user access provided there are other owners in the document.
    """
    user = factories.UserFactory(with_owned_document=True)

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory()
    access = None
    if via == USER:
        access = factories.UserDocumentAccessFactory(
            document=document, user=user, role="owner"
        )
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        access = factories.TeamDocumentAccessFactory(
            document=document, team="lasuite", role="owner"
        )

    old_values = serializers.DocumentAccessSerializer(instance=access).data
    new_role = random.choice(["administrator", "editor", "reader"])

    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/accesses/{access.id!s}/",
        data={**old_values, "role": new_role},
        format="json",
    )

    assert response.status_code == 403
    access.refresh_from_db()
    assert access.role == "owner"

    # Add another owner and it should now work
    factories.UserDocumentAccessFactory(document=document, role="owner")

    user_id = str(access.user_id) if via == USER else None
    with mock_reset_connections(document.id, user_id):
        response = client.put(
            f"/api/v1.0/documents/{document.id!s}/accesses/{access.id!s}/",
            data={
                **old_values,
                "role": new_role,
                "user_id": old_values.get("user", {}).get("id")
                if old_values.get("user") is not None
                else None,
            },
            format="json",
        )

        assert response.status_code == 200
        access.refresh_from_db()
        assert access.role == new_role


@pytest.mark.parametrize("via", VIA)
def test_api_document_accesses_update_owner_self_child(
    via,
    mock_user_teams,
    mock_reset_connections,  # pylint: disable=redefined-outer-name
):
    """
    A user who is owner of a document should be allowed to update
    their own user access even if they are the only owner in the document,
    provided the document is not a root.
    """
    user = factories.UserFactory(with_owned_document=True)

    client = APIClient()
    client.force_login(user)

    parent = factories.DocumentFactory()
    document = factories.DocumentFactory(parent=parent)
    access = None
    if via == USER:
        access = factories.UserDocumentAccessFactory(
            document=document, user=user, role="owner"
        )
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        access = factories.TeamDocumentAccessFactory(
            document=document, team="lasuite", role="owner"
        )

    old_values = serializers.DocumentAccessSerializer(instance=access).data
    new_role = random.choice(["administrator", "editor", "reader"])

    user_id = str(access.user_id) if via == USER else None
    with mock_reset_connections(document.id, user_id):
        response = client.put(
            f"/api/v1.0/documents/{document.id!s}/accesses/{access.id!s}/",
            data={**old_values, "role": new_role},
            format="json",
        )

    assert response.status_code == 200
    access.refresh_from_db()
    assert access.role == new_role


# Delete


def test_api_document_accesses_delete_anonymous():
    """Anonymous users should not be allowed to destroy a document access."""
    access = factories.UserDocumentAccessFactory()

    response = APIClient().delete(
        f"/api/v1.0/documents/{access.document_id!s}/accesses/{access.id!s}/",
    )

    assert response.status_code == 401
    assert models.DocumentAccess.objects.count() == 1


def test_api_document_accesses_delete_authenticated():
    """
    Authenticated users should not be allowed to delete a document access for a
    document to which they are not related.
    """
    user = factories.UserFactory(with_owned_document=True)

    client = APIClient()
    client.force_login(user)

    access = factories.UserDocumentAccessFactory()

    response = client.delete(
        f"/api/v1.0/documents/{access.document_id!s}/accesses/{access.id!s}/",
    )

    assert response.status_code == 403
    assert models.DocumentAccess.objects.count() == 2


@pytest.mark.parametrize("role", ["reader", "editor"])
@pytest.mark.parametrize("via", VIA)
def test_api_document_accesses_delete_reader_or_editor(via, role, mock_user_teams):
    """
    Authenticated users should not be allowed to delete a document access for a
    document in which they are a simple reader or editor.
    """
    user = factories.UserFactory(with_owned_document=True)

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory()
    if via == USER:
        factories.UserDocumentAccessFactory(document=document, user=user, role=role)
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(
            document=document, team="lasuite", role=role
        )

    access = factories.UserDocumentAccessFactory(document=document)

    assert models.DocumentAccess.objects.count() == 3
    assert models.DocumentAccess.objects.filter(user=access.user).exists()

    response = client.delete(
        f"/api/v1.0/documents/{document.id!s}/accesses/{access.id!s}/",
    )

    assert response.status_code == 403
    assert models.DocumentAccess.objects.count() == 3


@pytest.mark.parametrize("via", VIA)
def test_api_document_accesses_delete_administrators_except_owners(
    via,
    mock_user_teams,
    mock_reset_connections,  # pylint: disable=redefined-outer-name
):
    """
    Users who are administrators in a document should be allowed to delete an access
    from the document provided it is not ownership.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory()
    if via == USER:
        factories.UserDocumentAccessFactory(
            document=document, user=user, role="administrator"
        )
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(
            document=document, team="lasuite", role="administrator"
        )

    access = factories.UserDocumentAccessFactory(
        document=document, role=random.choice(["reader", "editor", "administrator"])
    )

    assert models.DocumentAccess.objects.count() == 2
    assert models.DocumentAccess.objects.filter(user=access.user).exists()

    with mock_reset_connections(document.id, str(access.user_id)):
        response = client.delete(
            f"/api/v1.0/documents/{document.id!s}/accesses/{access.id!s}/",
        )

        assert response.status_code == 204
        assert models.DocumentAccess.objects.count() == 1


@pytest.mark.parametrize("via", VIA)
def test_api_document_accesses_delete_administrator_on_owners(via, mock_user_teams):
    """
    Users who are administrators in a document should not be allowed to delete an ownership
    access from the document.
    """
    user = factories.UserFactory(with_owned_document=True)

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory()
    if via == USER:
        factories.UserDocumentAccessFactory(
            document=document, user=user, role="administrator"
        )
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(
            document=document, team="lasuite", role="administrator"
        )

    access = factories.UserDocumentAccessFactory(document=document, role="owner")

    assert models.DocumentAccess.objects.count() == 3
    assert models.DocumentAccess.objects.filter(user=access.user).exists()

    response = client.delete(
        f"/api/v1.0/documents/{document.id!s}/accesses/{access.id!s}/",
    )

    assert response.status_code == 403
    assert models.DocumentAccess.objects.count() == 3


@pytest.mark.parametrize("via", VIA)
def test_api_document_accesses_delete_owners(
    via,
    mock_user_teams,
    mock_reset_connections,  # pylint: disable=redefined-outer-name
):
    """
    Users should be able to delete the document access of another user
    for a document of which they are owner.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory()
    if via == USER:
        factories.UserDocumentAccessFactory(document=document, user=user, role="owner")
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(
            document=document, team="lasuite", role="owner"
        )

    access = factories.UserDocumentAccessFactory(document=document)

    assert models.DocumentAccess.objects.count() == 2
    assert models.DocumentAccess.objects.filter(user=access.user).exists()

    with mock_reset_connections(document.id, str(access.user_id)):
        response = client.delete(
            f"/api/v1.0/documents/{document.id!s}/accesses/{access.id!s}/",
        )

    assert response.status_code == 204
    assert models.DocumentAccess.objects.count() == 1


@pytest.mark.parametrize("via", VIA)
def test_api_document_accesses_delete_owners_last_owner_root(via, mock_user_teams):
    """
    It should not be possible to delete the last owner access from a root document
    """
    user = factories.UserFactory(with_owned_document=True)
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory()
    access = None
    if via == USER:
        access = factories.UserDocumentAccessFactory(
            document=document, user=user, role="owner"
        )
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        access = factories.TeamDocumentAccessFactory(
            document=document, team="lasuite", role="owner"
        )

    assert models.DocumentAccess.objects.count() == 2
    response = client.delete(
        f"/api/v1.0/documents/{document.id!s}/accesses/{access.id!s}/",
    )

    assert response.status_code == 403
    assert models.DocumentAccess.objects.count() == 2


def test_api_document_accesses_delete_owners_last_owner_child_user(
    mock_reset_connections,  # pylint: disable=redefined-outer-name
):
    """
    It should be possible to delete the last owner access from a document that is not a root.
    """
    user = factories.UserFactory(with_owned_document=True)
    client = APIClient()
    client.force_login(user)

    parent = factories.DocumentFactory()
    document = factories.DocumentFactory(parent=parent)
    access = None
    access = factories.UserDocumentAccessFactory(
        document=document, user=user, role="owner"
    )

    assert models.DocumentAccess.objects.count() == 2
    with mock_reset_connections(document.id, str(access.user_id)):
        response = client.delete(
            f"/api/v1.0/documents/{document.id!s}/accesses/{access.id!s}/",
        )

    assert response.status_code == 204
    assert models.DocumentAccess.objects.count() == 1


@pytest.mark.skip(
    reason="Pending fix on https://github.com/suitenumerique/docs/issues/969"
)
def test_api_document_accesses_delete_owners_last_owner_child_team(
    mock_user_teams,
    mock_reset_connections,  # pylint: disable=redefined-outer-name
):
    """
    It should be possible to delete the last owner access from a document that
    is not a root.
    """
    user = factories.UserFactory(with_owned_document=True)
    client = APIClient()
    client.force_login(user)

    parent = factories.DocumentFactory()
    document = factories.DocumentFactory(parent=parent)
    access = None
    mock_user_teams.return_value = ["lasuite", "unknown"]
    access = factories.TeamDocumentAccessFactory(
        document=document, team="lasuite", role="owner"
    )

    assert models.DocumentAccess.objects.count() == 2
    with mock_reset_connections(document.id, str(access.user_id)):
        response = client.delete(
            f"/api/v1.0/documents/{document.id!s}/accesses/{access.id!s}/",
        )

    assert response.status_code == 204
    assert models.DocumentAccess.objects.count() == 1
