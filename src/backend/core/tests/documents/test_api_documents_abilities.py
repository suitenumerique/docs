"""
Tests for Documents API endpoint in impress's core app: abilities
"""

from datetime import timedelta
from unittest import mock
from uuid import uuid4

from django.contrib.auth.models import AnonymousUser
from django.utils import timezone

import pytest
from rest_framework.test import APIClient

from core import factories, models
from core.tests.conftest import TEAM, USER, VIA

pytestmark = pytest.mark.django_db


def create_branch(depth, **kwargs):
    """
    Create a branch of `depth` documents, from the root to the deepest one, all of
    them with the same attributes (a link reach left to the factory is random).
    """
    documents = [factories.DocumentFactory(**kwargs)]
    for _i in range(depth - 1):
        documents.append(factories.DocumentFactory(parent=documents[-1], **kwargs))
    return documents


def grant_access(via, document, user, role):
    """
    Give `user` an access on `document`, personally or through the "lasuite" team,
    which the test makes one of the teams of the user.
    """
    if via == USER:
        return factories.UserDocumentAccessFactory(
            document=document, user=user, role=role
        )

    return factories.TeamDocumentAccessFactory(
        document=document, team="lasuite", role=role
    )


def test_api_documents_abilities_anonymous_public_standalone():
    """Anonymous users should get their abilities on a public document."""
    document = factories.DocumentFactory(link_reach="public")

    response = APIClient().get(f"/api/v1.0/documents/{document.id!s}/abilities/")

    assert response.status_code == 200
    assert response.json() == {"abilities": document.get_abilities(AnonymousUser())}
    assert response.json()["abilities"]["retrieve"] is True


@pytest.mark.parametrize("document_reach", ["authenticated", "restricted"])
@pytest.mark.parametrize("parent_reach", ["authenticated", "restricted"])
def test_api_documents_abilities_anonymous_public_parent(parent_reach, document_reach):
    """
    Anonymous users should get their abilities on a document of which an ancestor
    is public.
    """
    grand_parent = factories.DocumentFactory(link_reach="public")
    parent = factories.DocumentFactory(parent=grand_parent, link_reach=parent_reach)
    document = factories.DocumentFactory(parent=parent, link_reach=document_reach)

    response = APIClient().get(f"/api/v1.0/documents/{document.id!s}/abilities/")

    assert response.status_code == 200
    assert response.json() == {"abilities": document.get_abilities(AnonymousUser())}


@pytest.mark.parametrize("reach", ["restricted", "authenticated"])
def test_api_documents_abilities_anonymous_restricted_or_authenticated(reach):
    """Anonymous users should not get abilities on a document that is not public."""
    document = factories.DocumentFactory(link_reach=reach)

    response = APIClient().get(f"/api/v1.0/documents/{document.id!s}/abilities/")

    assert response.status_code == 401
    assert response.json() == {
        "detail": "Authentication credentials were not provided."
    }


@pytest.mark.parametrize("reach", ["public", "authenticated"])
def test_api_documents_abilities_authenticated_unrelated_public_or_authenticated(
    reach,
):
    """
    Authenticated users should get their abilities on a public/authenticated document
    to which they are not related.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach=reach)

    response = client.get(f"/api/v1.0/documents/{document.id!s}/abilities/")

    assert response.status_code == 200
    assert response.json() == {"abilities": document.get_abilities(user)}


def test_api_documents_abilities_authenticated_unrelated_restricted():
    """
    Authenticated users should not get abilities on a document that is restricted
    and to which they are not related.
    """
    user = factories.UserFactory(with_owned_document=True)
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach="restricted")

    response = client.get(f"/api/v1.0/documents/{document.id!s}/abilities/")

    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }


@pytest.mark.parametrize("depth", [1, 3])
@pytest.mark.parametrize("role", models.RoleChoices.values)
@pytest.mark.parametrize("via", VIA)
def test_api_documents_abilities_authenticated_related(
    via, role, depth, mock_user_teams
):
    """
    Authenticated users should get their abilities on a restricted document to which
    they are related, directly or through a team, on the document or on an ancestor,
    whatever their role.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)
    mock_user_teams.return_value = ["lasuite", "unknown"]

    documents = create_branch(depth, link_reach="restricted")
    grant_access(via, documents[0], user, role)
    document = documents[-1]

    response = client.get(f"/api/v1.0/documents/{document.id!s}/abilities/")

    assert response.status_code == 200
    assert response.json() == {"abilities": document.get_abilities(user)}


def test_api_documents_abilities_unknown_document():
    """Getting the abilities on a document that does not exist should return a 404."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    response = client.get(f"/api/v1.0/documents/{uuid4()!s}/abilities/")

    assert response.status_code == 404
    assert response.json() == {"detail": "No Document matches the given query."}


@pytest.mark.parametrize("method", ["post", "put", "patch", "delete"])
def test_api_documents_abilities_method_not_allowed(method):
    """The abilities can only be read."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(users=[(user, "owner")])

    response = getattr(client, method)(
        f"/api/v1.0/documents/{document.id!s}/abilities/", {}, format="json"
    )

    assert response.status_code == 405


# The depth of a branch of which the deepest document is asked for, and the position in
# the branch of the deleted one: the document itself or any one of its ancestors
DELETED_IN_BRANCH = [
    (depth, deleted_position)
    for depth in [1, 2, 3]
    for deleted_position in range(depth)
]


@pytest.mark.parametrize("is_authenticated", [False, True])
@pytest.mark.parametrize("depth, deleted_position", DELETED_IN_BRANCH)
@pytest.mark.parametrize("reach", models.LinkReachChoices.values)
def test_api_documents_abilities_soft_deleted_unrelated(
    reach, depth, deleted_position, is_authenticated
):
    """
    Getting the abilities on a soft/permanently deleted document should return a 404
    for users not related to the document.
    """
    client = APIClient()
    if is_authenticated:
        client.force_login(factories.UserFactory())

    documents = create_branch(depth, link_reach=reach)
    document = documents[-1]

    response = client.get(f"/api/v1.0/documents/{document.id!s}/abilities/")

    if reach == "public" or (reach == "authenticated" and is_authenticated):
        assert response.status_code == 200
    else:
        assert response.status_code == (403 if is_authenticated else 401)

    # Delete the document or one of its ancestors...
    deleted_document = documents[deleted_position]
    deleted_document.soft_delete()

    response = client.get(f"/api/v1.0/documents/{document.id!s}/abilities/")

    assert response.status_code == 404
    assert response.json() == {"detail": "Not found."}

    fourty_days_ago = timezone.now() - timedelta(days=40)
    deleted_document.deleted_at = fourty_days_ago
    deleted_document.ancestors_deleted_at = fourty_days_ago
    deleted_document.save()

    response = client.get(f"/api/v1.0/documents/{document.id!s}/abilities/")

    assert response.status_code == 404
    assert response.json() == {"detail": "Not found."}


@pytest.mark.parametrize("depth, deleted_position", DELETED_IN_BRANCH)
@pytest.mark.parametrize("role", models.RoleChoices.values)
def test_api_documents_abilities_soft_deleted_related(role, depth, deleted_position):
    """
    The abilities on a soft deleted document should only be given to users with
    specific "owner" access rights.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    documents = create_branch(depth, link_reach="restricted")
    factories.UserDocumentAccessFactory(document=documents[0], user=user, role=role)
    document = documents[-1]

    # Delete the document or one of its ancestors
    documents[deleted_position].soft_delete()

    response = client.get(f"/api/v1.0/documents/{document.id!s}/abilities/")

    if role == "owner":
        document = models.Document.objects.get(pk=document.pk)
        assert response.status_code == 200
        assert response.json() == {"abilities": document.get_abilities(user)}
    else:
        assert response.status_code == 404
        assert response.json() == {"detail": "Not found."}


@pytest.mark.parametrize("depth, deleted_position", DELETED_IN_BRANCH)
@pytest.mark.parametrize("role", models.RoleChoices.values)
def test_api_documents_abilities_permanently_deleted_related(
    role, depth, deleted_position
):
    """
    The abilities on a permanently deleted document should not be given to any
    user, whatever their role.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    documents = create_branch(depth, link_reach="restricted")
    factories.UserDocumentAccessFactory(document=documents[0], user=user, role=role)
    document = documents[-1]

    # Delete the document or one of its ancestors
    fourty_days_ago = timezone.now() - timedelta(days=40)
    with mock.patch("django.utils.timezone.now", return_value=fourty_days_ago):
        documents[deleted_position].soft_delete()

    response = client.get(f"/api/v1.0/documents/{document.id!s}/abilities/")

    assert response.status_code == 404
    assert response.json() == {"detail": "Not found."}


@pytest.mark.parametrize("reach", ["public", "authenticated"])
def test_api_documents_abilities_no_link_trace(reach):
    """
    Contrary to `retrieve`, getting the abilities should not trace the visit: a user
    reaching a document by its link can only leave it once they opened it.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach=reach)

    response = client.get(f"/api/v1.0/documents/{document.id!s}/abilities/")

    assert response.status_code == 200
    assert response.json()["abilities"]["leave"] is False
    assert not models.LinkTrace.objects.filter(document=document, user=user).exists()

    # Opening the document traces the visit...
    client.get(f"/api/v1.0/documents/{document.id!s}/")
    assert models.LinkTrace.objects.filter(document=document, user=user).exists()

    # ...after which the document can be left
    response = client.get(f"/api/v1.0/documents/{document.id!s}/abilities/")

    assert response.status_code == 200
    assert response.json()["abilities"]["leave"] is True


@pytest.mark.parametrize(
    "scenario, role",
    [
        *(
            (scenario, role)
            for scenario in ["access", "team_access", "ancestor_access"]
            for role in models.RoleChoices.values
        ),
        ("link_trace", None),
        ("deleted", "owner"),
    ],
)
def test_api_documents_abilities_agree_with_retrieve(scenario, role, mock_user_teams):
    """
    The abilities should be those `retrieve` answers, as soon as the visit is traced.

    The collaboration server reads them from `retrieve` and is to read them from this
    endpoint instead. The abilities are asked first: `retrieve` traces the visit, which
    would hide a difference on `leave` were it asked first.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    parent = factories.DocumentFactory(
        link_reach="authenticated" if scenario == "link_trace" else "restricted"
    )
    document = factories.DocumentFactory(parent=parent, link_reach="restricted")

    if scenario == "access":
        grant_access(USER, document, user, role)
    elif scenario == "team_access":
        mock_user_teams.return_value = ["lasuite", "unknown"]
        grant_access(TEAM, document, user, role)
    elif scenario == "ancestor_access":
        grant_access(USER, parent, user, role)
    elif scenario == "link_trace":
        models.LinkTrace.objects.create(document=document, user=user)
    elif scenario == "deleted":
        grant_access(USER, document, user, role)
        document.soft_delete()

    response = client.get(f"/api/v1.0/documents/{document.id!s}/abilities/")
    retrieve = client.get(f"/api/v1.0/documents/{document.id!s}/")

    assert response.status_code == 200
    assert retrieve.status_code == 200
    assert response.json()["abilities"] == retrieve.json()["abilities"]


@pytest.mark.parametrize(
    "is_authenticated, depth, expected",
    [
        (False, 1, 1),
        (False, 2, 2),
        (False, 5, 2),
        (True, 1, 2),
        (True, 2, 3),
        (True, 5, 3),
    ],
)
def test_api_documents_abilities_num_queries(
    is_authenticated, depth, expected, django_assert_num_queries
):
    """
    Getting the abilities should take the user of the session when authenticated, the
    document annotated with the roles of the user and their link trace, and the link
    definitions of its ancestors when it has any. It does not grow with the depth of
    the document: the collaboration server asks on every connection.

    A reader is neither owner nor administrator: below the root, the abilities compare
    the creator of the document to the user, which must not cost a query.
    """
    client = APIClient()

    if is_authenticated:
        user = factories.UserFactory()
        client.force_login(user)
        documents = create_branch(depth, link_reach="restricted")
        factories.UserDocumentAccessFactory(
            document=documents[0], user=user, role="reader"
        )
    else:
        documents = create_branch(depth, link_reach="public")
    document = documents[-1]

    with django_assert_num_queries(expected):
        response = client.get(f"/api/v1.0/documents/{document.id!s}/abilities/")

    assert response.status_code == 200


def test_api_documents_abilities_num_queries_stable(
    mock_user_teams, django_assert_num_queries
):
    """
    The number of queries should not grow with the accesses, link traces, favorites
    and children of the document and of its ancestors, nor with the number of
    documents of the instance.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    documents = create_branch(3, link_reach="restricted")
    factories.UserDocumentAccessFactory(document=documents[0], user=user, role="reader")
    document = documents[-1]

    with django_assert_num_queries(3):
        response = client.get(f"/api/v1.0/documents/{document.id!s}/abilities/")
    assert response.status_code == 200

    mock_user_teams.return_value = ["lasuite", "unknown"]
    others = factories.UserFactory.create_batch(5)
    for ancestor in documents:
        factories.TeamDocumentAccessFactory(
            document=ancestor, team="lasuite", role="editor"
        )
        for other in others:
            factories.UserDocumentAccessFactory(document=ancestor, user=other)
            models.LinkTrace.objects.create(document=ancestor, user=other)
            models.DocumentFavorite.objects.create(document=ancestor, user=other)
    models.LinkTrace.objects.create(document=document, user=user)
    models.DocumentFavorite.objects.create(document=document, user=user)
    for _i in range(3):
        factories.DocumentFactory(parent=document)
    factories.DocumentFactory.create_batch(30, link_reach="public")

    with django_assert_num_queries(3):
        response = client.get(f"/api/v1.0/documents/{document.id!s}/abilities/")
    assert response.status_code == 200
    assert response.json() == {"abilities": document.get_abilities(user)}


def test_api_documents_abilities_loads_only_what_it_needs():
    """
    The abilities should be computed without the favorite status of the document,
    without tracing the visit and without loading the fields the abilities do not
    read, neither on the document nor on its ancestors.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = create_branch(3, link_reach="public")[-1]
    models.DocumentFavorite.objects.create(document=document, user=user)

    with (
        mock.patch.object(
            models.Document, "from_db", wraps=models.Document.from_db
        ) as from_db,
        mock.patch.object(
            models.DocumentQuerySet,
            "annotate_is_favorite",
            autospec=True,
            side_effect=models.DocumentQuerySet.annotate_is_favorite,
        ) as annotate_is_favorite,
    ):
        response = client.get(f"/api/v1.0/documents/{document.id!s}/abilities/")

    assert response.status_code == 200
    annotate_is_favorite.assert_not_called()
    assert not models.LinkTrace.objects.filter(document=document, user=user).exists()

    # Django hands `from_db` the columns it loaded, for the document and its ancestors
    loaded = {name for call in from_db.call_args_list for name in call.args[1]}
    assert loaded == {
        "id",
        "path",
        "depth",
        "link_reach",
        "link_role",
        "deleted_at",
        "ancestors_deleted_at",
        "creator_id",
        "numchild",
    }


@pytest.mark.parametrize("depth", [1, 3])
@pytest.mark.parametrize("is_creator", [False, True])
@pytest.mark.parametrize("role", models.RoleChoices.values)
def test_api_documents_abilities_no_deferred_field_loaded(role, is_creator, depth):
    """
    The abilities should read no field that the endpoint left out of its `only()`:
    Django would load it with one more query per field, silently. Each role is tried
    as the creator of the document or not, at the root and below it, which reaches
    every field the abilities read (e.g. `numchild` is only read for an editor who
    created a document below the root).
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    documents = create_branch(depth, link_reach="restricted")
    factories.UserDocumentAccessFactory(document=documents[0], user=user, role=role)
    document = documents[-1]
    if is_creator:
        document.creator = user
        document.save()

    # Accessing a deferred field calls `refresh_from_db` with the name of the field
    with mock.patch.object(
        models.Document,
        "refresh_from_db",
        autospec=True,
        side_effect=models.Document.refresh_from_db,
    ) as refresh_from_db:
        response = client.get(f"/api/v1.0/documents/{document.id!s}/abilities/")

    assert response.status_code == 200
    assert refresh_from_db.call_args_list == []
