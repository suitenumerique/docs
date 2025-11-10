"""Test prometheus metrics of impress's core app."""

import os
from unittest.mock import patch

from django.conf import settings
from django.test import TestCase
from django.test.utils import override_settings

from prometheus_client import REGISTRY

from core import factories
from core.api.custom_metrics_exporter import CustomMetricsExporter


def namespaced(metric):
    """
    Pulls PROMETHEUS_METRIC_NAMESPACE (if any)
    from Django settings to the given metric name.

    e.g. if PROMETHEUS_METRIC_NAMESPACE='impress' and metric='users_total',
    returns 'impress_users_total'.
    """
    ns = getattr(settings, "PROMETHEUS_METRIC_NAMESPACE", "")
    return f"{ns}_{metric}" if ns else metric


class PrometheusMetricsTest(TestCase):
    """
    Tests hitting the /prometheus/ endpoint.
    We forcibly register the CustomMetricsExporter (normally done in wsgi.py)
    so its metrics will appear even though wsgi.py is not invoked in tests.
    """

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        # Ensure CustomMetricsExporter is registered
        if not any(
            isinstance(collector, CustomMetricsExporter)
            for collector in REGISTRY._collector_to_names
        ):
            REGISTRY.register(CustomMetricsExporter())

    def setUp(self):
        """
        Create a user + document so user/doc metrics (e.g. users_total,
        documents_total) are definitely non-zero and appear in the output list.
        """
        self.user = factories.UserFactory()
        self.doc = factories.DocumentFactory()
        self.doc.accesses.create(role="owner", user=self.user)

    @override_settings(PROMETHEUS_METRIC_NAMESPACE="")
    def test_prometheus_metrics_no_namespace(self):
        """
        Scenario 1: No metric namespace => we expect the custom metrics
        to appear with their raw names (e.g. 'users_total').
        """
        env = {
            "MONITORING_PROMETHEUS_EXPORTER": "True",
            "MONITORING_ALLOWED_CIDR_RANGES": "*",
        }
        with patch.dict(os.environ, env, clear=True):
            response = self.client.get("/prometheus/", REMOTE_ADDR="127.0.0.1")
            self.assertEqual(
                200, response.status_code, "Expected 200 OK but got a different status."
            )
            content = response.content.decode("utf-8")

            # Check for a couple default 'process_' metrics
            for metric in [
                "process_virtual_memory_bytes",
                "process_resident_memory_bytes",
            ]:
                self.assertIn(
                    metric, content, f"Missing default process metric {metric}"
                )

            # Check for selected custom metrics (no prefix)
            # users/documents are gauges; users_active_total carries a window label
            for metric in [
                "users_total",
                "documents_total",
                'users_active_total{window="1d"}',
            ]:
                self.assertIn(
                    metric,
                    content,
                    f"Expected custom metric {metric} not found.\n{content}",
                )

    @override_settings(PROMETHEUS_METRIC_NAMESPACE="impress")
    def test_prometheus_metrics_with_namespace(self):
        """
        Scenario 2: We set PROMETHEUS_METRIC_NAMESPACE='impress' in settings,
        so all custom metrics should appear prefixed with 'impress_'.
        """
        env = {
            "MONITORING_PROMETHEUS_EXPORTER": "True",
            "MONITORING_ALLOWED_CIDR_RANGES": "*",
        }
        with patch.dict(os.environ, env, clear=True):
            response = self.client.get("/prometheus/", REMOTE_ADDR="127.0.0.1")
            self.assertEqual(
                200, response.status_code, "Expected 200 OK but got a different status."
            )
            content = response.content.decode("utf-8")

            # Check for default metrics
            for metric in [
                "process_virtual_memory_bytes",
                "process_resident_memory_bytes",
            ]:
                self.assertIn(
                    metric, content, f"Missing default process metric {metric}"
                )

            # Check custom metrics that should be prefixed with
            # the define value from settings.py ...
            # We'll build the expected string via `namespaced()`.
            for base_metric in [
                "users_total",
                "documents_total",
            ]:
                expected_metric = namespaced(base_metric)
                self.assertIn(
                    expected_metric,
                    content,
                    f"Expected custom metric {expected_metric} not found.\n{content}",
                )

            # users_active_total carries window label; ensure namespacing + label present
            expected_active_today = namespaced("users_active_total") + '{window="1d"}'
            self.assertIn(
                expected_active_today,
                content,
                f"Expected custom metric {expected_active_today} not found.\n{content}",
            )
