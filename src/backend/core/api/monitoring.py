"""Monitoring auth helpers and views."""

import os

import prometheus_client
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.http import HttpResponse
from prometheus_client import multiprocess
from rest_framework import renderers
from rest_framework.authentication import BasicAuthentication
from rest_framework.exceptions import AuthenticationFailed, NotAuthenticated
from rest_framework.negotiation import BaseContentNegotiation
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView


class MonitoringUser:
    """Simple in-memory user object for monitoring endpoints."""

    def __init__(self, username):
        self.username = username
        self.pk = username  # satisfy code paths that access user.pk/id

    def __str__(self):
        return self.username

    @property
    def is_authenticated(self):
        return True

    @property
    def is_anonymous(self):
        return False


class MonitoringBasicAuthentication(BasicAuthentication):
    """Basic auth comparing against static credentials from settings."""

    def authenticate_credentials(self, userid, password, request=None):
        username = settings.MONITORING_BASIC_AUTH_USERNAME
        expected_password = settings.MONITORING_BASIC_AUTH_PASSWORD

        if not username or not expected_password:
            raise ImproperlyConfigured(
                "MONITORING_BASIC_AUTH_USERNAME and MONITORING_BASIC_AUTH_PASSWORD "
                "must be defined to protect monitoring endpoints."
            )

        if userid != username or password != expected_password:
            raise AuthenticationFailed("Invalid monitoring credentials.")

        return (MonitoringUser(userid), None)


class PrometheusRenderer(renderers.BaseRenderer):
    media_type = prometheus_client.CONTENT_TYPE_LATEST
    format = None

    def render(self, data, accepted_media_type=None, renderer_context=None):
        return data


class PrometheusContentNegotiation(BaseContentNegotiation):
    """Always pick the first renderer (Prometheus), ignoring Accept headers."""

    def select_renderer(self, request, renderers, format_suffix=None):
        renderer = renderers[0]
        return (renderer, renderer.media_type)


class PrometheusMetricsView(APIView):
    """
    DRF view exporting Prometheus metrics with monitoring basic auth.

    Mirrors django_prometheus.exports.ExportToDjangoView but keeps authentication
    within DRF to satisfy API-wide auth expectations.
    """

    authentication_classes = [MonitoringBasicAuthentication]
    permission_classes = [IsAuthenticated]
    renderer_classes = [PrometheusRenderer]
    content_negotiation_class = PrometheusContentNegotiation

    def handle_exception(self, exc):
        if isinstance(exc, (AuthenticationFailed, NotAuthenticated)):
            authenticator = MonitoringBasicAuthentication()
            response = HttpResponse(str(exc), status=401)
            response["WWW-Authenticate"] = authenticator.authenticate_header(self.request)
            return response
        return super().handle_exception(exc)

    def get(self, request):
        if "PROMETHEUS_MULTIPROC_DIR" in os.environ or "prometheus_multiproc_dir" in os.environ:
            registry = prometheus_client.CollectorRegistry()
            multiprocess.MultiProcessCollector(registry)
        else:
            registry = prometheus_client.REGISTRY
        metrics_page = prometheus_client.generate_latest(registry)
        return Response(metrics_page)
