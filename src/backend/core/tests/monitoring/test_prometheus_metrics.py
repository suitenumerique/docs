"""Test prometheus metrics of impress's core app."""

import base64
import importlib

import pytest

from django.conf import settings
from django.test.utils import override_settings
from django.urls import clear_url_caches

from core import factories


def _auth_header(username, password):
    token = base64.b64encode(f"{username}:{password}".encode("utf-8")).decode("utf-8")
    return f"Basic {token}"


BASE_SETTINGS = {
    "PROMETHEUS_EXPORTER_ENABLED": True,
    "MONITORING_BASIC_AUTH_USERNAME": "monitoring",
    "MONITORING_BASIC_AUTH_PASSWORD": "secret",
}

DEFAULT_METRICS = [
    "process_virtual_memory_bytes",
    "process_resident_memory_bytes",
]


def namespaced(metric):
    """
    Pulls PROMETHEUS_METRIC_NAMESPACE (if any)
    from Django settings to the given metric name.
    """
    ns = getattr(settings, "PROMETHEUS_METRIC_NAMESPACE", "")
    return f"{ns}_{metric}" if ns else metric


@pytest.mark.django_db
@pytest.mark.parametrize("namespace", ["", "impress"])
def test_prometheus_metrics(client, namespace):
    """
    Hitting /metrics/ should return default + custom metrics; custom ones should
    reflect PROMETHEUS_METRIC_NAMESPACE when set.
    """
    # Ensure non-zero custom metrics
    user = factories.UserFactory()
    doc = factories.DocumentFactory()
    doc.accesses.create(role="owner", user=user)

    metrics_path = "/metrics/"
    settings_override = {
        **BASE_SETTINGS,
        "PROMETHEUS_METRIC_NAMESPACE": namespace,
    }

    try:
        with override_settings(**settings_override):
            clear_url_caches()
            importlib.reload(importlib.import_module("impress.urls"))

            response = client.get(
                metrics_path,
                REMOTE_ADDR="127.0.0.1",
                HTTP_AUTHORIZATION=_auth_header("monitoring", "secret"),
            )
            assert response.status_code == 200, (
                "Expected 200 OK but got a different status."
            )
            content = response.content.decode("utf-8")

            for metric in DEFAULT_METRICS:
                assert metric in content, f"Missing default process metric {metric}"

            expected_custom = [
                namespaced("users"),
                namespaced("documents"),
                namespaced("users_active") + '{window="one_day"}',
            ]
            for metric in expected_custom:
                assert metric in content, (
                    f"Expected custom metric {metric} not found.\n{content}"
                )
    finally:
        clear_url_caches()
        importlib.reload(importlib.import_module("impress.urls"))
