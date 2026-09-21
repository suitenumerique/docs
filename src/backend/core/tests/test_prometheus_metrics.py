"""
Test the Prometheus metrics endpoint and the instrumentation of the application.
"""

import re
import socket
from importlib import reload
from unittest import mock

from django.urls import clear_url_caches, resolve

import pytest
from prometheus_client import REGISTRY, Counter, values
from rest_framework.test import APIClient

from impress import urls

pytestmark = pytest.mark.django_db

API_KEY = "test-prometheus-api-key"
AUTH_MIDDLEWARE = "core.middleware.PrometheusAuthMiddleware"
BEFORE_MIDDLEWARE = "django_prometheus.middleware.PrometheusBeforeMiddleware"
AFTER_MIDDLEWARE = "django_prometheus.middleware.PrometheusAfterMiddleware"


def _reload_urls():
    """The route only exists when the metrics are enabled at import time."""
    reload(urls)
    clear_url_caches()


@pytest.fixture(name="metrics_enabled")
def metrics_enabled_fixture(settings, monkeypatch, tmp_path):
    """Configure the application the way PROMETHEUS_METRICS_ENABLED does at startup."""
    settings.PROMETHEUS_METRICS_ENABLED = True
    settings.PROMETHEUS_API_KEY = API_KEY
    settings.MIDDLEWARE = [
        AUTH_MIDDLEWARE,
        BEFORE_MIDDLEWARE,
        *settings.MIDDLEWARE,
        AFTER_MIDDLEWARE,
    ]
    # what a worker started with PROMETHEUS_MULTIPROC_DIR does on its own:
    # write the values to that directory instead of keeping them in memory
    monkeypatch.setenv("PROMETHEUS_MULTIPROC_DIR", str(tmp_path))
    monkeypatch.setattr(values, "ValueClass", values.MultiProcessValue())
    _reload_urls()
    yield
    settings.PROMETHEUS_METRICS_ENABLED = False
    _reload_urls()


@pytest.mark.parametrize("path", ["/metrics", "/metrics/", "/prometheus/metrics"])
def test_prometheus_metrics_disabled_by_default(path):
    """Nothing should be served unless the metrics are enabled, key or not."""
    response = APIClient().get(path, HTTP_AUTHORIZATION=f"Bearer {API_KEY}")

    assert response.status_code == 404


@pytest.mark.usefixtures("metrics_enabled")
@pytest.mark.parametrize(
    "authorization",
    [
        None,
        "",
        "Bearer",
        "Bearer ",
        "Bearer wrong-key",
        f"Bearer {API_KEY} ",
        f"bearer {API_KEY}",
        f"Token {API_KEY}",
        f"Basic {API_KEY}",
        API_KEY,
        "Bearer clé-non-ascii",
    ],
)
def test_prometheus_metrics_requires_the_api_key(authorization):
    """Anything but the exact bearer token should be refused, before any other work."""
    headers = {} if authorization is None else {"HTTP_AUTHORIZATION": authorization}

    response = APIClient().get("/metrics", **headers)

    assert response.status_code == 401
    assert response["WWW-Authenticate"] == 'Bearer realm="metrics"'
    assert response.content == b"Unauthorized"
    # refused before the session middleware: a scraper must not fill the session store
    assert not response.cookies


@pytest.mark.usefixtures("metrics_enabled")
@pytest.mark.parametrize("api_key", [None, ""])
@pytest.mark.parametrize("authorization", ["Bearer ", "Bearer None", "Bearer"])
def test_prometheus_metrics_fails_closed_without_api_key(
    settings, api_key, authorization
):
    """With no key configured nothing should be served, whatever is presented."""
    settings.PROMETHEUS_API_KEY = api_key

    response = APIClient().get("/metrics", HTTP_AUTHORIZATION=authorization)

    assert response.status_code == 401


@pytest.mark.usefixtures("metrics_enabled")
def test_prometheus_metrics_served_with_the_api_key():
    """
    The right key should get what every worker wrote to the shared directory, labelled
    with the name of the host, and the call should not create a session.
    """
    counter = Counter(
        "docs_metrics_test", "A counter written by a worker.", registry=None
    )
    counter.inc(3)

    response = APIClient().get("/metrics", HTTP_AUTHORIZATION=f"Bearer {API_KEY}")

    assert response.status_code == 200
    assert response["Content-Type"].startswith("text/plain")
    assert (
        f'docs_metrics_test_total{{hostname="{socket.gethostname()}"}} 3.0'
        in response.content.decode()
    )
    assert not response.cookies


@pytest.mark.usefixtures("metrics_enabled")
def test_prometheus_metrics_is_read_only():
    """Only GET and HEAD should be answered."""
    response = APIClient().post("/metrics", HTTP_AUTHORIZATION=f"Bearer {API_KEY}")

    assert response.status_code == 405


@pytest.mark.usefixtures("metrics_enabled")
@pytest.mark.parametrize(
    "path",
    ["/api/v1.0/metrics", "/api/v1.0/metrics/", "/api/v1.0/prometheus/metrics"],
)
def test_prometheus_metrics_not_served_under_the_api(path):
    """The ingress publishes /api/: the metrics should not be found under it."""
    response = APIClient().get(path, HTTP_AUTHORIZATION=f"Bearer {API_KEY}")

    assert response.status_code == 404


@pytest.mark.usefixtures("metrics_enabled")
def test_prometheus_metrics_other_routes_need_no_api_key():
    """The key should only be asked for on the metrics endpoint."""
    assert APIClient().get("/api/v1.0/config/").status_code == 200


def test_prometheus_metrics_requests_are_labelled_by_view(settings):
    """A request should be counted under the name of its view, never under its path."""
    settings.MIDDLEWARE = [BEFORE_MIDDLEWARE, AFTER_MIDDLEWARE]
    path = "/api/v1.0/config/"
    labels = {"status": "200", "view": resolve(path).view_name, "method": "GET"}
    metric = "django_http_responses_total_by_status_view_method_total"
    before = REGISTRY.get_sample_value(metric, labels) or 0

    response = APIClient().get(path)

    assert response.status_code == 200
    assert REGISTRY.get_sample_value(metric, labels) == before + 1
    # no label of any sample carries the path that was requested
    assert not any(
        path in value
        for family in REGISTRY.collect()
        for sample in family.samples
        for value in sample.labels.values()
    )


@pytest.mark.usefixtures("metrics_enabled")
def test_prometheus_metrics_celery_queue_length(settings):
    """The length of the Celery queue is asked at scrape time, unless it is turned off."""
    path = "core.metrics.CeleryQueueCollector.queue_length"

    with mock.patch(path, return_value=7) as mock_queue_length:
        response = APIClient().get("/metrics", HTTP_AUTHORIZATION=f"Bearer {API_KEY}")
    assert response.status_code == 200
    assert re.search(
        # the text format sorts the labels
        rf'docs_celery_queue_length{{hostname="{socket.gethostname()}",queue="celery"}} 7\.0',
        response.content.decode(),
    )
    mock_queue_length.assert_called_once()

    settings.PROMETHEUS_CELERY_QUEUE_METRICS_ENABLED = False
    with mock.patch(path, return_value=7) as mock_queue_length:
        response = APIClient().get("/metrics", HTTP_AUTHORIZATION=f"Bearer {API_KEY}")
    assert response.status_code == 200
    assert "docs_celery_queue_length" not in response.content.decode()
    mock_queue_length.assert_not_called()
