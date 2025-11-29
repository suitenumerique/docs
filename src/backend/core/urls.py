"""URL configuration for the core app."""

from django.conf import settings
from django.urls import include, path, re_path

from lasuite.oidc_login.urls import urlpatterns as oidc_urls
from rest_framework.routers import DefaultRouter

from core.api import viewsets
from core.api import imports as import_views
from core.api import import_viewsets

# - Main endpoints
router = DefaultRouter()
router.register("templates", viewsets.TemplateViewSet, basename="templates")
router.register("documents", viewsets.DocumentViewSet, basename="documents")
router.register("users", viewsets.UserViewSet, basename="users")
router.register(
    "imports/outline/jobs",
    import_viewsets.OutlineImportJobViewSet,
    basename="outline-import-job",
)

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
                    "imports/outline/upload/",
                    import_views.OutlineImportUploadView.as_view(),
                    name="outline-import-upload",
                ),
            ]
        ),
    ),
    path(f"api/{settings.API_VERSION}/config/", viewsets.ConfigView.as_view()),
]
