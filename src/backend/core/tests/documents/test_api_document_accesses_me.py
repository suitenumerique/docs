"""
Test documents accesses /me API.
"""

from datetime import timedelta
from unittest import mock
from uuid import uuid4

from django.utils import timezone

import pytest
from rest_framework.test import APIClient

from core import choices, factories
from core.tests.conftest import TEAM, USER, VIA

pytestmark = pytest.mark.django_db


def grant_access(via, document, user, mock_user_teams, role="reader"):
    """
    Give `user` an access on `document`, personally or through one of their teams.

    The endpoint reaches an access by `user` or by `team` in one query, so every case
    below is worth running both ways: a filter that works for one is not evidence about
    the other. The teams are set on the mock only for `TEAM` — a `PropertyMock` left
    alone iterates empty, which is what an authenticated user with no team looks like.
    """
    if via == USER:
        return factories.UserDocumentAccessFactory(
            document=document, user=user, role=role
        )

    mock_user_teams.return_value = ["lasuite", "unknown"]
    return factories.TeamDocumentAccessFactory(
        document=document, team="lasuite", role=role
    )


def expected_access(access, user, via):
    """The payload the endpoint serves for an access held by the calling user."""
    return {
        "id": str(access.id),
        "document": {
            "id": str(access.document_id),
            "path": access.document.path,
            "depth": access.document.depth,
        },
        "user": None
        if via == TEAM
        else {"full_name": user.full_name, "short_name": user.short_name},
        "team": "lasuite" if via == TEAM else "",
        "role": access.role,
        "max_ancestors_role": None,
        "max_role": access.role,
        "abilities": access.get_abilities(user),
        "updated_at": access.updated_at.isoformat().replace("+00:00", "Z"),
        "created_at": access.created_at.isoformat().replace("+00:00", "Z"),
    }


@pytest.mark.parametrize("link_reach", choices.LinkReachChoices)
def test_api_document_accesses_me_anonymous(link_reach):
    """Anonymous users should not be allowed to fetch document accesses /me."""
    document = factories.DocumentFactory(link_reach=link_reach)
    factories.UserDocumentAccessFactory.create_batch(2, document=document)

    response = APIClient().get(f"/api/v1.0/documents/{document.id!s}/accesses/me/")
    assert response.status_code == 401
    assert response.json() == {
        "detail": "Authentication credentials were not provided."
    }


@pytest.mark.parametrize("link_reach", choices.LinkReachChoices)
def test_api_document_accesses_me_not_existing_access(link_reach):
    """Connected user should not be allowed to fetch an access if not existing."""
    document = factories.DocumentFactory(link_reach=link_reach)
    factories.UserDocumentAccessFactory.create_batch(2, document=document)

    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    response = client.get(f"/api/v1.0/documents/{document.id!s}/accesses/me/")
    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }


def test_api_document_accesses_me_team_the_user_does_not_belong_to(mock_user_teams):
    """
    A team access is only the caller's if they are in that team. The negative case of the
    `team__in=user.teams` half of the lookup: being in *a* team is not being in this one.
    """
    mock_user_teams.return_value = ["another-team"]

    document = factories.DocumentFactory(link_reach="public", link_role="editor")
    factories.TeamDocumentAccessFactory(document=document, team="lasuite")

    client = APIClient()
    client.force_login(factories.UserFactory())

    response = client.get(f"/api/v1.0/documents/{document.id!s}/accesses/me/")

    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }


@pytest.mark.parametrize("via", VIA)
@pytest.mark.parametrize("role", choices.RoleChoices)
def test_api_document_accesses_me_direct_access(via, role, mock_user_teams):
    """Connected user with direct access should retrieve their own access."""
    document = factories.DocumentFactory()
    factories.UserDocumentAccessFactory.create_batch(2, document=document)

    user = factories.UserFactory()
    access = grant_access(via, document, user, mock_user_teams, role=role)

    client = APIClient()
    client.force_login(user)

    response = client.get(f"/api/v1.0/documents/{document.id!s}/accesses/me/")
    assert response.status_code == 200
    assert response.json() == expected_access(access, user, via)


@pytest.mark.parametrize("via", VIA)
@pytest.mark.parametrize("role", choices.RoleChoices)
def test_api_document_accesses_me_in_depth(via, role, mock_user_teams):
    """Connected user with access to a root should retrieve it from children documents"""

    document = factories.DocumentFactory()
    factories.UserDocumentAccessFactory.create_batch(2, document=document)

    user = factories.UserFactory()
    access = grant_access(via, document, user, mock_user_teams, role=role)

    client = APIClient()
    client.force_login(user)

    child1 = factories.DocumentFactory(parent=document)
    child2 = factories.DocumentFactory(parent=child1)

    response = client.get(f"/api/v1.0/documents/{child2.id!s}/accesses/me/")
    assert response.status_code == 200
    assert response.json() == expected_access(access, user, via)


@pytest.mark.parametrize("via", VIA)
@pytest.mark.parametrize("role", choices.RoleChoices)
def test_api_document_accesses_me_multiple_accesses_in_depth(
    via, role, mock_user_teams
):
    """Connected user with multiple accesses in the same tree should retrieve the older created."""

    document = factories.DocumentFactory()
    factories.UserDocumentAccessFactory.create_batch(2, document=document)

    user = factories.UserFactory()
    access = grant_access(via, document, user, mock_user_teams, role=role)

    client = APIClient()
    client.force_login(user)

    child1 = factories.DocumentFactory(parent=document)
    child2 = factories.DocumentFactory(parent=child1)
    grant_access(via, child2, user, mock_user_teams, role=role)

    response = client.get(f"/api/v1.0/documents/{child2.id!s}/accesses/me/")
    assert response.status_code == 200
    assert response.json() == expected_access(access, user, via)


@pytest.mark.parametrize("via", VIA)
def test_api_document_accesses_me_ancestor_access_wins_over_a_recent_stronger_one(
    via, mock_user_teams
):
    """
    The access returned is the earliest one, whatever its role and whatever the document
    it is held on. This is what bounds the history the collaboration server serves — it
    turns `created_at` into `history.from` — so a later access on the document itself must
    not shorten what an earlier one on a parent already gave.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    parent = factories.DocumentFactory(link_reach="restricted")
    child = factories.DocumentFactory(parent=parent, link_reach="restricted")

    ten_days_ago = timezone.now() - timedelta(days=10)
    with mock.patch("django.utils.timezone.now", return_value=ten_days_ago):
        parent_access = grant_access(via, parent, user, mock_user_teams, role="reader")
    # granted later, and deliberately the stronger role: recency must not win
    grant_access(via, child, user, mock_user_teams, role="editor")

    response = client.get(f"/api/v1.0/documents/{child.id!s}/accesses/me/")

    assert response.status_code == 200
    assert response.json()["id"] == str(parent_access.id)
    assert response.json()["created_at"] == ten_days_ago.isoformat().replace(
        "+00:00", "Z"
    )


def test_api_document_accesses_me_earliest_of_team_and_user_accesses(mock_user_teams):
    """
    A user holding both a team access and a personal one gets the earliest of the two,
    whichever kind it is — the one axis the `via` parametrization above cannot express,
    because the two halves of the lookup have to be compared against each other.
    """
    mock_user_teams.return_value = ["lasuite"]

    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    parent = factories.DocumentFactory()
    child = factories.DocumentFactory(parent=parent)

    ten_days_ago = timezone.now() - timedelta(days=10)
    with mock.patch("django.utils.timezone.now", return_value=ten_days_ago):
        team_access = factories.TeamDocumentAccessFactory(
            document=parent, team="lasuite", role="reader"
        )
    factories.UserDocumentAccessFactory(document=child, user=user, role="owner")

    response = client.get(f"/api/v1.0/documents/{child.id!s}/accesses/me/")

    assert response.status_code == 200
    assert response.json()["id"] == str(team_access.id)
    assert response.json()["team"] == "lasuite"


@pytest.mark.parametrize("via", VIA)
def test_api_document_accesses_me_ignores_a_descendant_access(via, mock_user_teams):
    """
    An access on a child grants nothing on its parent: the lookup walks up the tree, never
    down. Otherwise a user invited to one page would be handed the history of the whole
    space above it.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    parent = factories.DocumentFactory(link_reach="public", link_role="editor")
    child = factories.DocumentFactory(parent=parent)
    grant_access(via, child, user, mock_user_teams, role="owner")

    response = client.get(f"/api/v1.0/documents/{parent.id!s}/accesses/me/")

    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }


@pytest.mark.parametrize("via", VIA)
def test_api_document_accesses_me_ignores_a_sibling_access(via, mock_user_teams):
    """An access on a sibling — a path of the same length — is not an access on this one."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    parent = factories.DocumentFactory(link_reach="public", link_role="editor")
    sibling = factories.DocumentFactory(parent=parent)
    document = factories.DocumentFactory(parent=parent)
    grant_access(via, sibling, user, mock_user_teams, role="owner")

    response = client.get(f"/api/v1.0/documents/{document.id!s}/accesses/me/")

    assert response.status_code == 403


def test_api_document_accesses_me_unknown_document():
    """An unknown document is a 404, not a 403: there is no access question to answer."""
    client = APIClient()
    client.force_login(factories.UserFactory())

    response = client.get(f"/api/v1.0/documents/{uuid4()!s}/accesses/me/")

    assert response.status_code == 404
    assert response.json() == {"detail": "Not found."}


@pytest.mark.parametrize("via", VIA)
def test_api_document_accesses_me_soft_deleted_document(via, mock_user_teams):
    """
    A soft deleted document has no history to bound — `versions_list` is withheld on it
    for the same reason — so its accesses are not served either.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory()
    grant_access(via, document, user, mock_user_teams, role="owner")
    document.soft_delete()

    response = client.get(f"/api/v1.0/documents/{document.id!s}/accesses/me/")

    assert response.status_code == 403


@pytest.mark.parametrize("via", VIA)
def test_api_document_accesses_me_deleted_ancestor(via, mock_user_teams):
    """An access held on a deleted ancestor is not an access any more."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    parent = factories.DocumentFactory()
    grant_access(via, parent, user, mock_user_teams, role="owner")
    child = factories.DocumentFactory(parent=parent)
    parent.soft_delete()

    response = client.get(f"/api/v1.0/documents/{child.id!s}/accesses/me/")

    assert response.status_code == 403


@pytest.mark.parametrize("method", ["post", "put", "patch", "delete"])
def test_api_document_accesses_me_method_not_allowed(method):
    """The endpoint only reads: "me" is not a document access id one can write to."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(users=[(user, "owner")])

    client = APIClient()
    client.force_login(user)

    response = getattr(client, method)(
        f"/api/v1.0/documents/{document.id!s}/accesses/me/", {}, format="json"
    )

    assert response.status_code == 405


@pytest.mark.parametrize("via", VIA)
@pytest.mark.parametrize(
    "scenario", ["direct", "ancestor", "none", "deleted", "deleted_ancestor"]
)
def test_api_document_accesses_me_agrees_with_the_versions_list_ability(
    via, scenario, mock_user_teams
):
    """
    `versions_list` and this endpoint must answer the same question.

    The collaboration server reads the ability to decide whether to ask for the access at
    all, and turns the access's `created_at` into the start of the history it serves. The
    two are computed from different queries — `has_access_role` from the `user_roles`
    annotation, this one from its own ancestor-aware lookup — so nothing but a test keeps
    them in step. Were they to disagree, a user would be offered a history menu that opens
    on nothing (or, worse, the other way round).
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    parent = factories.DocumentFactory(link_reach="public", link_role="editor")
    document = factories.DocumentFactory(parent=parent)

    if scenario == "direct":
        grant_access(via, document, user, mock_user_teams)
    elif scenario == "ancestor":
        grant_access(via, parent, user, mock_user_teams)
    elif scenario == "deleted":
        grant_access(via, document, user, mock_user_teams, role="owner")
        document.soft_delete()
    elif scenario == "deleted_ancestor":
        grant_access(via, parent, user, mock_user_teams, role="owner")
        parent.soft_delete()

    retrieve = client.get(f"/api/v1.0/documents/{document.id!s}/")
    assert retrieve.status_code == 200
    can_list_versions = retrieve.json()["abilities"]["versions_list"]

    response = client.get(f"/api/v1.0/documents/{document.id!s}/accesses/me/")

    assert can_list_versions is (response.status_code == 200), (
        f"{scenario} via {via}: versions_list={can_list_versions} but /accesses/me/ "
        f"answered {response.status_code}"
    )
