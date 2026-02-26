"""URL configuration for the core app."""

from django.conf import settings
from django.urls import include, path, re_path

from lasuite.oidc_login.urls import urlpatterns as oidc_urls
from rest_framework.routers import DefaultRouter

from core.api import viewsets
from core.external_api import viewsets as external_api_viewsets

# - Main endpoints
router = DefaultRouter()
router.register("documents", viewsets.DocumentViewSet, basename="documents")
router.register("users", viewsets.UserViewSet, basename="users")

# - Routes nested under a document
document_related_router = DefaultRouter()
document_related_router.register(
    "accesses",
    viewsets.DocumentAccessViewSet,
    basename="document_accesses",
)
document_related_router.register(
    "invitations",
    viewsets.InvitationViewset,
    basename="invitations",
)
document_related_router.register(
    "threads",
    viewsets.ThreadViewSet,
    basename="threads",
)
document_related_router.register(
    "ask-for-access",
    viewsets.DocumentAskForAccessViewSet,
    basename="ask_for_access",
)

thread_related_router = DefaultRouter()
thread_related_router.register(
    "comments",
    viewsets.CommentViewSet,
    basename="comments",
)

# - Resource server routes
external_api_router = DefaultRouter()
external_api_router.register(
    "documents",
    external_api_viewsets.ResourceServerDocumentViewSet,
    basename="resource_server_documents",
)
external_api_router.register(
    "users",
    external_api_viewsets.ResourceServerUserViewSet,
    basename="resource_server_users",
)


urlpatterns = [
    path(
        f"api/{settings.API_VERSION}/",
        include(
            [
                *router.urls,
                *oidc_urls,
                re_path(
                    r"^documents/(?P<resource_id>[0-9a-z-]*)/",
                    include(document_related_router.urls),
                ),
                re_path(
                    r"^documents/(?P<resource_id>[0-9a-z-]*)/threads/(?P<thread_id>[0-9a-z-]*)/",
                    include(thread_related_router.urls),
                ),
                path(
                    "user-reconciliations/<str:user_type>/<uuid:confirmation_id>/",
                    viewsets.ReconciliationConfirmView.as_view(),
                ),
            ]
        ),
    ),
    path(f"api/{settings.API_VERSION}/config/", viewsets.ConfigView.as_view()),
]

if settings.OIDC_RESOURCE_SERVER_ENABLED:

    # - Routes nested under a document in external API
    external_api_document_related_router = DefaultRouter()

    document_access_config = settings.EXTERNAL_API.get("document_access", {})
    if document_access_config.get("enabled", False):
        external_api_document_related_router.register(
            "accesses",
            external_api_viewsets.ResourceServerDocumentAccessViewSet,
            basename="resource_server_document_accesses",
        )

    urlpatterns.append(
        path(
            f"external_api/{settings.API_VERSION}/",
            include(
                [
                    *external_api_router.urls,
                    re_path(
                        r"^documents/(?P<resource_id>[0-9a-z-]*)/",
                        include(external_api_document_related_router.urls),
                    ),
                ]
            ),
        )
    )
