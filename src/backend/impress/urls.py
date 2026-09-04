"""URL configuration for the impress project"""

import re

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.contrib.staticfiles.urls import staticfiles_urlpatterns
from django.urls import include, path, re_path
from django.views.static import serve as serve_static

from drf_spectacular.views import (
    SpectacularJSONAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

urlpatterns = [
    path("admin/", admin.site.urls),
    path("", include("core.urls")),
]

# Serve the django-silk profiling UI at /silk/ only when profiling is enabled
# for this environment (SILK_ENABLED=1). The view itself is further gated behind
# a staff session by SILKY_AUTHENTICATION / SILKY_AUTHORISATION.
if settings.SILK_ENABLED:
    urlpatterns += [path("silk/", include("silk.urls", namespace="silk"))]

if settings.DEBUG:
    urlpatterns = (
        urlpatterns
        + staticfiles_urlpatterns()
        + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    )
elif settings.SERVE_STATIC_FILES:
    # Whitenoise used to serve the files collected in STATIC_ROOT. It was removed,
    # so serve them from Django instead, otherwise the admin has no assets at all.
    # Django's `static()` helper only builds this route when DEBUG is on, hence the
    # explicit pattern.
    urlpatterns += [
        re_path(
            rf"^{re.escape(settings.STATIC_URL.lstrip('/'))}(?P<path>.*)$",
            serve_static,
            {"document_root": settings.STATIC_ROOT},
        ),
    ]


if settings.USE_SWAGGER or settings.DEBUG:
    urlpatterns += [
        path(
            f"api/{settings.API_VERSION}/swagger.json",
            SpectacularJSONAPIView.as_view(
                api_version=settings.API_VERSION,
                urlconf="core.urls",
            ),
            name="client-api-schema",
        ),
        path(
            f"api/{settings.API_VERSION}/swagger/",
            SpectacularSwaggerView.as_view(url_name="client-api-schema"),
            name="swagger-ui-schema",
        ),
        re_path(
            f"api/{settings.API_VERSION}/redoc/",
            SpectacularRedocView.as_view(url_name="client-api-schema"),
            name="redoc-schema",
        ),
    ]
