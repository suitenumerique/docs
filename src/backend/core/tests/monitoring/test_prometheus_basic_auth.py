"""Test prometheus metrics Basic Auth protection of impress's core app."""

import base64
import importlib

import pytest

from django.test import override_settings
from django.urls import clear_url_caches


def _auth_header(username, password):
    token = base64.b64encode(f"{username}:{password}".encode("utf-8")).decode("utf-8")
    return f"Basic {token}"


BASE_SETTINGS = {
    "PROMETHEUS_EXPORTER_ENABLED": True,
    "MONITORING_BASIC_AUTH_USERNAME": "monitoring",
    "MONITORING_BASIC_AUTH_PASSWORD": "secret",
}


SCENARIOS = [
    {
        "name": "Missing Authorization header => 401",
        "settings": BASE_SETTINGS,
        "auth_header": None,
        "expected_status": 401,
        "expected_text": "Authentication credentials were not provided.",
    },
    {
        "name": "Wrong credentials => 401",
        "settings": BASE_SETTINGS,
        "auth_header": _auth_header("monitoring", "wrong"),
        "expected_status": 401,
        "expected_text": "Invalid monitoring credentials.",
    },
    {
        "name": "Correct credentials => 200 + metrics",
        "settings": BASE_SETTINGS,
        "auth_header": _auth_header("monitoring", "secret"),
        "expected_status": 200,
        "expected_text": "process_virtual_memory_bytes",
    },
    {
        "name": "Exporter disabled => 404",
        "settings": {
            **BASE_SETTINGS,
            "PROMETHEUS_EXPORTER_ENABLED": False,
        },
        "auth_header": _auth_header("monitoring", "secret"),
        "expected_status": 404,
        "expected_text": "Not Found",
    },
]

@pytest.mark.django_db
@pytest.mark.parametrize("scenario", SCENARIOS, ids=[s["name"] for s in SCENARIOS])
def test_prometheus_basic_auth(client, scenario):
    """Verify that the /metrics/ endpoint enforces HTTP Basic authentication."""

    metrics_path = "/metrics/"

    try:
        with override_settings(**scenario["settings"]):
            clear_url_caches()
            importlib.reload(importlib.import_module("impress.urls"))

            extra = {}
            if scenario["auth_header"]:
                extra["HTTP_AUTHORIZATION"] = scenario["auth_header"]

            response = client.get(metrics_path, **extra)

            assert (
                response.status_code == scenario["expected_status"]
            ), f"Failed scenario: {scenario['name']}"

            content = response.content.decode("utf-8")
            assert scenario["expected_text"] in content, (
                f"Failed scenario: {scenario['name']}\n"
                f"Response content:\n{content}"
            )
    finally:
        clear_url_caches()
        importlib.reload(importlib.import_module("impress.urls"))
