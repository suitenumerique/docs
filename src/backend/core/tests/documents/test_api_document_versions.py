"""
Test document versions API endpoints for users in impress's core app.
"""

import random
import time

import pytest
from rest_framework.test import APIClient

from core import factories, models
from core.tests.conftest import TEAM, USER, VIA

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize("reach", models.LinkReachChoices.values)
@pytest.mark.parametrize("role", models.LinkRoleChoices.values)
def test_api_document_versions_list_anonymous(role, reach):
    """
    Anonymous users should not be allowed to list document versions for a document
    whatever the reach and role.
    """
    document = factories.DocumentFactory(link_role=role, link_reach=reach)

    # Accesses and traces for other users should not interfere
    factories.UserDocumentAccessFactory(document=document)
    models.LinkTrace.objects.create(document=document, user=factories.UserFactory())

    response = APIClient().get(f"/api/v1.0/documents/{document.id!s}/versions/")

    assert response.status_code == 403
    assert response.json() == {"detail": "Authentication required."}


@pytest.mark.parametrize("reach", models.LinkReachChoices.values)
def test_api_document_versions_list_authenticated_unrelated(reach):
    """
    Authenticated users should not be allowed to list document versions for a document
    to which they are not related.
    """
    user = factories.UserFactory(with_owned_document=True)

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach=reach)
    factories.UserDocumentAccessFactory.create_batch(3, document=document)

    # The versions of another document to which the user is related should not be listed either
    factories.UserDocumentAccessFactory(user=user)

    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/versions/",
    )
    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }


@pytest.mark.parametrize("via", VIA)
def test_api_document_versions_list_authenticated_related_success(via, mock_user_teams):
    """
    Authenticated users should be able to list document versions for a document
    to which they are directly related, whatever their role in the document.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory()
    if via == USER:
        models.DocumentAccess.objects.create(
            document=document,
            user=user,
            role=random.choice(models.RoleChoices.values),
        )
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        models.DocumentAccess.objects.create(
            document=document,
            team="lasuite",
            role=random.choice(models.RoleChoices.values),
        )

    # Other versions of documents to which the user has access should not be listed
    factories.UserDocumentAccessFactory(user=user)

    # A version created before the user got access should be hidden
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/versions/",
    )

    assert response.status_code == 200
    content = response.json()
    assert content["count"] == 0

    # Add a new version to the document
    for i in range(3):
        document.content = f"new content {i:d}"
        document.save()

    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/versions/",
    )

    assert response.status_code == 200
    content = response.json()
    # The current version is not listed
    assert content["count"] == 2


@pytest.mark.parametrize("via", VIA)
def test_api_document_versions_list_authenticated_related_pagination(
    via, mock_user_teams
):
    """
    The list of versions should be paginated and exclude versions that were created prior to the
    user gaining access to the document.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory()
    for i in range(3):
        document.content = f"before {i:d}"
        document.save()

    if via == USER:
        models.DocumentAccess.objects.create(
            document=document,
            user=user,
            role=random.choice(models.RoleChoices.values),
        )
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        models.DocumentAccess.objects.create(
            document=document,
            team="lasuite",
            role=random.choice(models.RoleChoices.values),
        )

    for i in range(4):
        document.content = f"after {i:d}"
        document.save()

    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/versions/",
    )

    content = response.json()
    assert content["is_truncated"] is False
    # The current version is not listed
    assert content["count"] == 3
    assert content["next_version_id_marker"] == ""
    all_version_ids = [version["version_id"] for version in content["versions"]]

    # - set page size
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/versions/?page_size=2",
    )

    content = response.json()
    assert content["count"] == 2
    assert content["is_truncated"] is True
    marker = content["next_version_id_marker"]
    assert marker == all_version_ids[1]
    assert [
        version["version_id"] for version in content["versions"]
    ] == all_version_ids[:2]

    # - get page 2
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/versions/?page_size=2&version_id={marker:s}",
    )

    content = response.json()
    assert content["count"] == 1
    assert content["is_truncated"] is False
    assert content["next_version_id_marker"] == ""
    assert content["versions"][0]["version_id"] == all_version_ids[2]


@pytest.mark.parametrize("via", VIA)
def test_api_document_versions_list_authenticated_related_pagination_parent(
    via, mock_user_teams
):
    """
    When a user gains access to a document's versions via an ancestor, the date of access
    to the parent should be used to filter versions that were created prior to the
    user gaining access to the document.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    grand_parent = factories.DocumentFactory()
    parent = factories.DocumentFactory(parent=grand_parent)
    document = factories.DocumentFactory(parent=parent)
    for i in range(3):
        document.content = f"before {i:d}"
        document.save()

    if via == USER:
        models.DocumentAccess.objects.create(
            document=grand_parent,
            user=user,
            role=random.choice(models.RoleChoices.values),
        )
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        models.DocumentAccess.objects.create(
            document=grand_parent,
            team="lasuite",
            role=random.choice(models.RoleChoices.values),
        )

    for i in range(4):
        document.content = f"after {i:d}"
        document.save()

    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/versions/",
    )

    content = response.json()

    assert response.status_code == 200
    assert content["is_truncated"] is False
    # The current version is not listed
    assert content["count"] == 3
    assert content["next_version_id_marker"] == ""
    all_version_ids = [version["version_id"] for version in content["versions"]]

    # - set page size
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/versions/?page_size=2",
    )

    content = response.json()
    assert content["count"] == 2
    assert content["is_truncated"] is True
    marker = content["next_version_id_marker"]
    assert marker == all_version_ids[1]
    assert [
        version["version_id"] for version in content["versions"]
    ] == all_version_ids[:2]

    # - get page 2
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/versions/?page_size=2&version_id={marker:s}",
    )

    content = response.json()
    assert content["count"] == 1
    assert content["is_truncated"] is False
    assert content["next_version_id_marker"] == ""
    assert content["versions"][0]["version_id"] == all_version_ids[2]


def test_api_document_versions_list_exceeds_max_page_size():
    """Page size should not exceed the limit set on the serializer"""
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(users=[user])
    document.content = "version 2"
    document.save()

    response = client.get(f"/api/v1.0/documents/{document.id!s}/versions/?page_size=51")

    assert response.status_code == 400
    assert response.json() == {
        "page_size": ["Ensure this value is less than or equal to 50."]
    }


@pytest.mark.parametrize("reach", models.LinkReachChoices.values)
def test_api_document_versions_retrieve_anonymous(reach):
    """
    Anonymous users should not be allowed to find specific versions for a document with
    restricted or authenticated link reach.
    """
    document = factories.DocumentFactory(link_reach=reach)
    document.content = "new content"
    document.save()

    version_id = document.get_versions_slice()["versions"][0]["version_id"]

    url = f"/api/v1.0/documents/{document.id!s}/versions/{version_id:s}/"
    response = APIClient().get(url)

    assert response.status_code == 401
    assert response.json() == {
        "detail": "Authentication credentials were not provided."
    }


@pytest.mark.parametrize("reach", models.LinkReachChoices.values)
def test_api_document_versions_retrieve_authenticated_unrelated(reach):
    """
    Authenticated users should not be allowed to retrieve specific versions for a
    document to which they are not related.
    """
    user = factories.UserFactory(with_owned_document=True)

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach=reach)
    document.content = "new content"
    document.save()

    version_id = document.get_versions_slice()["versions"][0]["version_id"]

    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/versions/{version_id:s}/",
    )
    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }


@pytest.mark.parametrize("via", VIA)
def test_api_document_versions_retrieve_authenticated_related(via, mock_user_teams):
    """
    A user who is related to a document should be allowed to retrieve the
    associated document versions.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory()
    document.content = "new content"
    document.save()

    assert len(document.get_versions_slice()["versions"]) == 1
    version_id = document.get_versions_slice()["versions"][0]["version_id"]

    if via == USER:
        factories.UserDocumentAccessFactory(document=document, user=user)
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(document=document, team="lasuite")

    time.sleep(1)  # minio stores datetimes with the precision of a second

    # Versions created before the document was shared should not be seen by the user
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/versions/{version_id:s}/",
    )

    assert response.status_code == 404

    # Create a new version should not make it available to the user because
    # only the current version is available to the user but it is excluded
    # from the list
    document.content = "new content 1"
    document.save()

    assert len(document.get_versions_slice()["versions"]) == 2
    version_id = document.get_versions_slice()["versions"][0]["version_id"]

    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/versions/{version_id:s}/",
    )

    assert response.status_code == 404

    # Adding one more version should make the previous version available to the user
    document.content = "new content 2"
    document.save()

    assert len(document.get_versions_slice()["versions"]) == 3
    version_id = document.get_versions_slice()["versions"][0]["version_id"]

    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/versions/{version_id:s}/",
    )

    assert response.status_code == 200
    assert response.json()["content"] == "new content 1"


@pytest.mark.parametrize("via", VIA)
def test_api_document_versions_retrieve_authenticated_related_parent(
    via, mock_user_teams
):
    """
    A user who gains access to a document's versions via one of its ancestors, should be able to
    retrieve the document versions. The date of access to the parent should be used to filter
    versions that were created prior to the user gaining access to the document.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    grand_parent = factories.DocumentFactory()
    parent = factories.DocumentFactory(parent=grand_parent)
    document = factories.DocumentFactory(parent=parent)
    document.content = "new content"
    document.save()

    assert len(document.get_versions_slice()["versions"]) == 1
    version_id = document.get_versions_slice()["versions"][0]["version_id"]

    if via == USER:
        factories.UserDocumentAccessFactory(document=grand_parent, user=user)
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(document=grand_parent, team="lasuite")

    time.sleep(1)  # minio stores datetimes with the precision of a second

    # Versions created before the document was shared should not be seen by the user
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/versions/{version_id:s}/",
    )

    assert response.status_code == 404

    # Create a new version should not make it available to the user because
    # only the current version is available to the user but it is excluded
    # from the list
    document.content = "new content 1"
    document.save()

    assert len(document.get_versions_slice()["versions"]) == 2
    version_id = document.get_versions_slice()["versions"][0]["version_id"]

    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/versions/{version_id:s}/",
    )

    assert response.status_code == 404

    # Adding one more version should make the previous version available to the user
    document.content = "new content 2"
    document.save()

    assert len(document.get_versions_slice()["versions"]) == 3
    version_id = document.get_versions_slice()["versions"][0]["version_id"]

    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/versions/{version_id:s}/",
    )

    assert response.status_code == 200
    assert response.json()["content"] == "new content 1"


def test_api_document_versions_create_anonymous():
    """Anonymous users should not be allowed to create document versions."""
    document = factories.DocumentFactory()

    response = APIClient().post(
        f"/api/v1.0/documents/{document.id!s}/versions/",
        {"foo": "bar"},
        format="json",
    )

    assert response.status_code == 405
    assert response.json() == {"detail": 'Method "POST" not allowed.'}


def test_api_document_versions_create_authenticated_unrelated():
    """
    Authenticated users should not be allowed to create document versions for a document to
    which they are not related.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory()

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/versions/",
        {"foo": "bar"},
        format="json",
    )

    assert response.status_code == 405


@pytest.mark.parametrize("via", VIA)
def test_api_document_versions_create_authenticated_related(via, mock_user_teams):
    """
    Authenticated users related to a document should not be allowed to create document versions
    whatever their role.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory()
    if via == USER:
        factories.UserDocumentAccessFactory(document=document, user=user)
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(document=document, team="lasuite")

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/versions/",
        {"foo": "bar"},
        format="json",
    )

    assert response.status_code == 405


def test_api_document_versions_update_anonymous():
    """Anonymous users should not be allowed to update a document version."""
    access = factories.UserDocumentAccessFactory()
    document = access.document
    document.content = "new content"
    document.save()

    assert len(document.get_versions_slice()["versions"]) == 1
    version_id = document.get_versions_slice()["versions"][0]["version_id"]

    response = APIClient().put(
        f"/api/v1.0/documents/{document.id!s}/versions/{version_id:s}/",
        {"foo": "bar"},
        format="json",
    )
    assert response.status_code == 405


def test_api_document_versions_update_authenticated_unrelated():
    """
    Authenticated users should not be allowed to update a document version for a document to which
    they are not related.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    access = factories.UserDocumentAccessFactory()
    document = access.document
    document.content = "new content"
    document.save()

    assert len(document.get_versions_slice()["versions"]) == 1
    version_id = document.get_versions_slice()["versions"][0]["version_id"]

    response = client.put(
        f"/api/v1.0/documents/{access.document_id!s}/versions/{version_id:s}/",
        {"foo": "bar"},
        format="json",
    )
    assert response.status_code == 405


@pytest.mark.parametrize("via", VIA)
def test_api_document_versions_update_authenticated_related(via, mock_user_teams):
    """
    Authenticated users with access to a document should not be able to update its versions
    whatever their role.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory()

    if via == USER:
        factories.UserDocumentAccessFactory(document=document, user=user)
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(document=document, team="lasuite")

    time.sleep(1)  # minio stores datetimes with the precision of a second

    document.content = "new content"
    document.save()

    assert len(document.get_versions_slice()["versions"]) == 1
    version_id = document.get_versions_slice()["versions"][0]["version_id"]

    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/versions/{version_id!s}/",
        {"foo": "bar"},
        format="json",
    )
    assert response.status_code == 405


# Delete


@pytest.mark.parametrize("reach", models.LinkReachChoices.values)
def test_api_document_versions_delete_anonymous(reach):
    """Anonymous users should not be allowed to destroy a document version."""
    access = factories.UserDocumentAccessFactory(document__link_reach=reach)

    response = APIClient().delete(
        f"/api/v1.0/documents/{access.document_id!s}/versions/{access.id!s}/",
    )

    assert response.status_code == 401
    assert response.json() == {
        "detail": "Authentication credentials were not provided."
    }


@pytest.mark.parametrize("reach", models.LinkReachChoices.values)
def test_api_document_versions_delete_authenticated(reach):
    """
    Authenticated users should not be allowed to delete a document version for a
    public document to which they are not related.
    """
    user = factories.UserFactory(with_owned_document=True)

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach=reach)
    document.content = "new content"
    document.save()

    version_id = document.get_versions_slice()["versions"][0]["version_id"]

    response = client.delete(
        f"/api/v1.0/documents/{document.id!s}/versions/{version_id:s}/",
    )

    assert response.status_code == 403


@pytest.mark.parametrize("role", ["reader", "editor"])
@pytest.mark.parametrize("via", VIA)
def test_api_document_versions_delete_reader_or_editor(via, role, mock_user_teams):
    """
    Authenticated users should not be allowed to delete a document version for a
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

    # Create a new version should make it available to the user
    time.sleep(1)  # minio stores datetimes with the precision of a second
    document.content = "new content"
    document.save()

    versions = document.get_versions_slice()["versions"]
    assert len(versions) == 1

    version_id = versions[0]["version_id"]
    response = client.delete(
        f"/api/v1.0/documents/{document.id!s}/versions/{version_id:s}/",
    )
    assert response.status_code == 403

    versions = document.get_versions_slice()["versions"]
    assert len(versions) == 1


@pytest.mark.parametrize("via", VIA)
def test_api_document_versions_delete_administrator_or_owner(via, mock_user_teams):
    """
    Users who are administrator or owner of a document should be allowed to delete a version.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory()
    role = random.choice(["administrator", "owner"])
    if via == USER:
        factories.UserDocumentAccessFactory(document=document, user=user, role=role)
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(
            document=document, team="lasuite", role=role
        )

    # Create a new version should make it available to the user
    time.sleep(1)  # minio stores datetimes with the precision of a second
    document.content = "new content 1"
    document.save()

    versions = document.get_versions_slice()["versions"]
    assert len(versions) == 1

    version_id = versions[0]["version_id"]
    response = client.delete(
        f"/api/v1.0/documents/{document.id!s}/versions/{version_id:s}/",
    )
    # 404 because the version was created before the user was given access to the document
    assert response.status_code == 404

    document.content = "new content 2"
    document.save()

    versions = document.get_versions_slice()["versions"]
    assert len(versions) == 2

    version_id = versions[0]["version_id"]
    response = client.delete(
        f"/api/v1.0/documents/{document.id!s}/versions/{version_id:s}/",
    )
    assert response.status_code == 204

    versions = document.get_versions_slice()["versions"]
    assert len(versions) == 1
