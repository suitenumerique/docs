"""
Tests for Templates API endpoint in impress's core app: list
"""

from unittest import mock

import pytest
from rest_framework.pagination import PageNumberPagination
from rest_framework.test import APIClient

from core import factories

pytestmark = pytest.mark.django_db


def test_api_templates_list_anonymous():
    """Anonymous users should only be able to list public templates."""
    factories.TemplateFactory.create_batch(2, is_public=False)
    public_templates = factories.TemplateFactory.create_batch(2, is_public=True)
    expected_ids = {str(template.id) for template in public_templates}

    response = APIClient().get("/api/v1.0/templates/")

    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) == 2
    results_id = {result["id"] for result in results}
    assert expected_ids == results_id


def test_api_templates_list_authenticated_direct():
    """
    Authenticated users should be able to list templates they are a direct
    owner/administrator/member of or that are public.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    related_templates = [
        access.template
        for access in factories.UserTemplateAccessFactory.create_batch(5, user=user)
    ]
    public_templates = factories.TemplateFactory.create_batch(2, is_public=True)
    factories.TemplateFactory.create_batch(2, is_public=False)

    expected_ids = {
        str(template.id) for template in related_templates + public_templates
    }

    response = client.get(
        "/api/v1.0/templates/",
    )

    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) == 7
    results_id = {result["id"] for result in results}
    assert expected_ids == results_id


def test_api_templates_list_authenticated_via_team(mock_user_teams):
    """
    Authenticated users should be able to list templates they are a
    owner/administrator/member of via a team or that are public.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    mock_user_teams.return_value = ["team1", "team2", "unknown"]

    templates_team1 = [
        access.template
        for access in factories.TeamTemplateAccessFactory.create_batch(2, team="team1")
    ]
    templates_team2 = [
        access.template
        for access in factories.TeamTemplateAccessFactory.create_batch(3, team="team2")
    ]
    public_templates = factories.TemplateFactory.create_batch(2, is_public=True)
    factories.TemplateFactory.create_batch(2, is_public=False)

    expected_ids = {
        str(template.id)
        for template in templates_team1 + templates_team2 + public_templates
    }

    response = client.get("/api/v1.0/templates/")

    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) == 7
    results_id = {result["id"] for result in results}
    assert expected_ids == results_id


@mock.patch.object(PageNumberPagination, "get_page_size", return_value=2)
def test_api_templates_list_pagination(
    _mock_page_size,
):
    """Pagination should work as expected."""
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    template_ids = [
        str(access.template_id)
        for access in factories.UserTemplateAccessFactory.create_batch(3, user=user)
    ]

    # Get page 1
    response = client.get(
        "/api/v1.0/templates/",
    )

    assert response.status_code == 200
    content = response.json()

    assert content["count"] == 3
    assert content["next"] == "http://testserver/api/v1.0/templates/?page=2"
    assert content["previous"] is None

    assert len(content["results"]) == 2
    for item in content["results"]:
        template_ids.remove(item["id"])

    # Get page 2
    response = client.get(
        "/api/v1.0/templates/?page=2",
    )

    assert response.status_code == 200
    content = response.json()

    assert content["count"] == 3
    assert content["next"] is None
    assert content["previous"] == "http://testserver/api/v1.0/templates/"

    assert len(content["results"]) == 1
    template_ids.remove(content["results"][0]["id"])
    assert template_ids == []


def test_api_templates_list_authenticated_distinct():
    """A template with several related users should only be listed once."""
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    other_user = factories.UserFactory()

    template = factories.TemplateFactory(users=[user, other_user], is_public=True)

    response = client.get(
        "/api/v1.0/templates/",
    )

    assert response.status_code == 200
    content = response.json()
    assert len(content["results"]) == 1
    assert content["results"][0]["id"] == str(template.id)


def test_api_templates_list_order_default():
    """The templates list should be sorted by 'created_at' in descending order by default."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    template_ids = [
        str(access.template.id)
        for access in factories.UserTemplateAccessFactory.create_batch(5, user=user)
    ]

    response = client.get(
        "/api/v1.0/templates/",
    )

    assert response.status_code == 200

    response_data = response.json()
    response_template_ids = [template["id"] for template in response_data["results"]]

    template_ids.reverse()
    assert response_template_ids == template_ids, (
        "created_at values are not sorted from newest to oldest"
    )


def test_api_templates_list_order_param():
    """
    The templates list is sorted by 'created_at' in ascending order when setting
    the "ordering" query parameter.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    templates_ids = [
        str(access.template.id)
        for access in factories.UserTemplateAccessFactory.create_batch(5, user=user)
    ]

    response = client.get(
        "/api/v1.0/templates/?ordering=created_at",
    )
    assert response.status_code == 200

    response_data = response.json()

    response_template_ids = [template["id"] for template in response_data["results"]]

    assert response_template_ids == templates_ids, (
        "created_at values are not sorted from oldest to newest"
    )
