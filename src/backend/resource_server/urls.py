"""Resource server API URL Configuration"""

from django.urls import include, path

from lasuite.oidc_resource_server.urls import urlpatterns as resource_server_urls
from rest_framework.routers import DefaultRouter

from . import viewsets

# - Main endpoints
router = DefaultRouter()
router.register("documents", viewsets.RSDocumentViewSet, basename="documents")


urlpatterns = [
    path(
        "resource-server/v1.0/",
        include(
            [
                *router.urls,
                *resource_server_urls,
            ]
        ),
    ),
]
