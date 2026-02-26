"""API endpoints"""

# pylint: disable=too-many-lines

import base64
import ipaddress
import json
import logging
import socket
import uuid
from collections import defaultdict
from urllib.parse import unquote, urlencode, urlparse

from django.conf import settings
from django.contrib.postgres.aggregates import ArrayAgg
from django.contrib.postgres.search import TrigramSimilarity
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.files.storage import default_storage
from django.core.validators import URLValidator
from django.db import connection, transaction
from django.db import models as db
from django.db.models.expressions import RawSQL
from django.db.models.functions import Greatest, Left, Length
from django.http import Http404, StreamingHttpResponse
from django.urls import reverse
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.utils.functional import cached_property
from django.utils.text import capfirst, slugify
from django.utils.translation import gettext_lazy as _

import requests
import rest_framework as drf
from botocore.exceptions import ClientError
from csp.constants import NONE
from csp.decorators import csp_update
from lasuite.malware_detection import malware_detection
from lasuite.oidc_login.decorators import refresh_oidc_access_token
from lasuite.tools.email import get_domain_from_email
from pydantic import ValidationError as PydanticValidationError
from rest_framework import filters, status, viewsets
from rest_framework import response as drf_response
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from core import authentication, choices, enums, models
from core.api.filters import remove_accents
from core.services import mime_types
from core.services.ai_services import AIService
from core.services.collaboration_services import CollaborationService
from core.services.converter_services import (
    ConversionError,
    Converter,
)
from core.services.converter_services import (
    ServiceUnavailableError as YProviderServiceUnavailableError,
)
from core.services.converter_services import (
    ValidationError as YProviderValidationError,
)
from core.services.search_indexers import (
    get_document_indexer,
    get_visited_document_ids_of,
)
from core.tasks.mail import send_ask_for_access_mail
from core.utils import (
    extract_attachments,
    filter_descendants,
    users_sharing_documents_with,
)

from . import permissions, serializers, utils
from .filters import DocumentFilter, ListDocumentFilter, UserSearchFilter
from .throttling import (
    DocumentThrottle,
    UserListThrottleBurst,
    UserListThrottleSustained,
)

logger = logging.getLogger(__name__)

# pylint: disable=too-many-ancestors


class NestedGenericViewSet(viewsets.GenericViewSet):
    """
    A generic Viewset aims to be used in a nested route context.
    e.g: `/api/v1.0/resource_1/<resource_1_pk>/resource_2/<resource_2_pk>/`

    It allows to define all url kwargs and lookup fields to perform the lookup.
    """

    lookup_fields: list[str] = ["pk"]
    lookup_url_kwargs: list[str] = []

    def __getattribute__(self, item):
        """
        This method is overridden to allow to get the last lookup field or lookup url kwarg
        when accessing the `lookup_field` or `lookup_url_kwarg` attribute. This is useful
        to keep compatibility with all methods used by the parent class `GenericViewSet`.
        """
        if item in ["lookup_field", "lookup_url_kwarg"]:
            return getattr(self, item + "s", [None])[-1]

        return super().__getattribute__(item)

    def get_queryset(self):
        """
        Get the list of items for this view.

        `lookup_fields` attribute is enumerated here to perform the nested lookup.
        """
        queryset = super().get_queryset()

        # The last lookup field is removed to perform the nested lookup as it corresponds
        # to the object pk, it is used within get_object method.
        lookup_url_kwargs = (
            self.lookup_url_kwargs[:-1]
            if self.lookup_url_kwargs
            else self.lookup_fields[:-1]
        )

        filter_kwargs = {}
        for index, lookup_url_kwarg in enumerate(lookup_url_kwargs):
            if lookup_url_kwarg not in self.kwargs:
                raise KeyError(
                    f"Expected view {self.__class__.__name__} to be called with a URL "
                    f'keyword argument named "{lookup_url_kwarg}". Fix your URL conf, or '
                    "set the `.lookup_fields` attribute on the view correctly."
                )

            filter_kwargs.update(
                {self.lookup_fields[index]: self.kwargs[lookup_url_kwarg]}
            )

        return queryset.filter(**filter_kwargs)


class SerializerPerActionMixin:
    """
    A mixin to allow to define serializer classes for each action.

    This mixin is useful to avoid to define a serializer class for each action in the
    `get_serializer_class` method.

    Example:
    ```
    class MyViewSet(SerializerPerActionMixin, viewsets.GenericViewSet):
        serializer_class = MySerializer
        list_serializer_class = MyListSerializer
        retrieve_serializer_class = MyRetrieveSerializer
    ```
    """

    def get_serializer_class(self):
        """
        Return the serializer class to use depending on the action.
        """
        if serializer_class := getattr(self, f"{self.action}_serializer_class", None):
            return serializer_class
        return super().get_serializer_class()


class Pagination(drf.pagination.PageNumberPagination):
    """Pagination to display no more than 100 objects per page sorted by creation date."""

    ordering = "-created_on"
    max_page_size = 200
    page_size_query_param = "page_size"


class UserViewSet(
    drf.mixins.UpdateModelMixin, viewsets.GenericViewSet, drf.mixins.ListModelMixin
):
    """User ViewSet"""

    permission_classes = [permissions.IsSelf]
    queryset = models.User.objects.filter(is_active=True)
    serializer_class = serializers.UserSerializer
    pagination_class = None
    throttle_classes = []

    def get_throttles(self):
        self.throttle_classes = []
        if self.action == "list":
            self.throttle_classes = [UserListThrottleBurst, UserListThrottleSustained]

        return super().get_throttles()

    def get_queryset(self):
        """
        Limit listed users by querying the email field with a trigram similarity
        search if a query is provided.
        Limit listed users by excluding users already in the document if a document_id
        is provided.
        """
        queryset = self.queryset

        if self.action != "list":
            return queryset

        filterset = UserSearchFilter(
            self.request.GET, queryset=queryset, request=self.request
        )
        if not filterset.is_valid():
            raise drf.exceptions.ValidationError(filterset.errors)

        # Exclude all users already in the given document
        if document_id := self.request.query_params.get("document_id", ""):
            queryset = queryset.exclude(documentaccess__document_id=document_id)

        filter_data = filterset.form.cleaned_data
        query = remove_accents(filter_data["q"])

        # For emails, match emails by Levenstein distance to prevent typing errors
        if "@" in query:
            return (
                queryset.annotate(
                    distance=RawSQL(
                        "levenshtein(unaccent(email::text), %s::text)", (query,)
                    )
                )
                .filter(distance__lte=3)
                .order_by("distance", "email")[: settings.API_USERS_LIST_LIMIT]
            )

        # Use trigram similarity for non-email-like queries
        # For performance reasons we filter first by similarity, which relies on an
        # index, then only calculate precise similarity scores for sorting purposes.
        #
        # Additionally results are reordered to prefer users "closer" to the current
        # user: users they recently shared documents with, then same email domain.
        # To achieve that without complex SQL, we build a proximity score in Python
        # and return the top N results.
        # For security results, users that match neither of these proximity criteria
        # are not returned at all, to prevent email enumeration.
        current_user = self.request.user
        shared_map = users_sharing_documents_with(current_user)

        user_email_domain = get_domain_from_email(current_user.email) or ""

        candidates = list(
            queryset.annotate(
                sim_email=TrigramSimilarity("email", query),
                sim_name=TrigramSimilarity("full_name", query),
            )
            .annotate(similarity=Greatest("sim_email", "sim_name"))
            .filter(similarity__gt=0.2)
            .order_by("-similarity")
        )

        # Keep only users that either share documents with the current user
        # or have an email with the same domain as the current user.
        filtered_candidates = []
        for u in candidates:
            candidate_domain = get_domain_from_email(u.email) or ""
            if shared_map.get(u.id) or (
                user_email_domain and candidate_domain == user_email_domain
            ):
                filtered_candidates.append(u)

        candidates = filtered_candidates

        # Build ordering key for each candidate
        def _sort_key(u):
            # shared priority: most recent first
            # Use shared_last_at timestamp numeric for secondary ordering when shared.
            shared_last_at = shared_map.get(u.id)
            if shared_last_at:
                is_shared = 1
                shared_score = int(shared_last_at.timestamp())
            else:
                is_shared = 0
                shared_score = 0

            # domain proximity
            candidate_email_domain = get_domain_from_email(u.email) or ""

            same_full_domain = (
                1
                if candidate_email_domain
                and candidate_email_domain == user_email_domain
                else 0
            )

            # similarity fallback
            sim = getattr(u, "similarity", 0) or 0

            return (
                is_shared,
                shared_score,
                same_full_domain,
                sim,
            )

        # Sort candidates by the key descending and return top N as a queryset-like
        # list. Keep return type consistent with previous behavior (QuerySet slice
        # was returned) by returning a list of model instances.
        candidates.sort(key=_sort_key, reverse=True)

        return candidates[: settings.API_USERS_LIST_LIMIT]

    @drf.decorators.action(
        detail=False,
        methods=["get"],
        url_name="me",
        url_path="me",
        permission_classes=[permissions.IsAuthenticated],
    )
    def get_me(self, request):
        """
        Return information on currently logged user
        """
        context = {"request": request}
        return drf.response.Response(
            self.serializer_class(request.user, context=context).data
        )


class ReconciliationConfirmView(APIView):
    """API endpoint to confirm user reconciliation emails.

    GET /user-reconciliations/{user_type}/{confirmation_id}/
    Marks `active_email_checked` or `inactive_email_checked` to True.
    """

    permission_classes = [AllowAny]

    def get(self, request, user_type, confirmation_id):
        """
        Check the confirmation ID and mark the corresponding email as checked.
        """
        try:
            # validate UUID
            uuid_obj = uuid.UUID(str(confirmation_id))
        except ValueError:
            return drf_response.Response(
                {"detail": "Badly formatted confirmation id"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if user_type not in ("active", "inactive"):
            return drf_response.Response(
                {"detail": "Invalid user_type"}, status=status.HTTP_400_BAD_REQUEST
            )

        lookup = (
            {"active_email_confirmation_id": uuid_obj}
            if user_type == "active"
            else {"inactive_email_confirmation_id": uuid_obj}
        )

        try:
            rec = models.UserReconciliation.objects.get(**lookup)
        except models.UserReconciliation.DoesNotExist:
            return drf_response.Response(
                {"detail": "Reconciliation entry not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        field_name = (
            "active_email_checked"
            if user_type == "active"
            else "inactive_email_checked"
        )
        if not getattr(rec, field_name):
            setattr(rec, field_name, True)
            rec.save()

        return drf_response.Response({"detail": "Confirmation received"})


class ResourceAccessViewsetMixin:
    """Mixin with methods common to all access viewsets."""

    def filter_queryset(self, queryset):
        """Override to filter on related resource."""
        queryset = super().filter_queryset(queryset)
        return queryset.filter(**{self.resource_field_name: self.kwargs["resource_id"]})

    def get_serializer_context(self):
        """Extra context provided to the serializer class."""
        context = super().get_serializer_context()
        context["resource_id"] = self.kwargs["resource_id"]
        return context


class DocumentMetadata(drf.metadata.SimpleMetadata):
    """Custom metadata class to add information"""

    def determine_metadata(self, request, view):
        """Add language choices only for the list endpoint."""
        simple_metadata = super().determine_metadata(request, view)

        if request.path.endswith("/documents/"):
            simple_metadata["actions"]["POST"]["language"] = {
                "choices": [
                    {"value": code, "display_name": name}
                    for code, name in enums.ALL_LANGUAGES.items()
                ]
            }
        return simple_metadata


# pylint: disable=too-many-public-methods
class DocumentViewSet(
    SerializerPerActionMixin,
    drf.mixins.CreateModelMixin,
    drf.mixins.DestroyModelMixin,
    drf.mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """
    DocumentViewSet API.

    This view set provides CRUD operations and additional actions for managing documents.
    Supports filtering, ordering, and annotations for enhanced querying capabilities.

    ### API Endpoints:
    1. **List**: Retrieve a paginated list of documents.
       Example: GET /documents/?page=2
    2. **Retrieve**: Get a specific document by its ID.
       Example: GET /documents/{id}/
    3. **Create**: Create a new document.
       Example: POST /documents/
    4. **Update**: Update a document by its ID.
       Example: PUT /documents/{id}/
    5. **Delete**: Soft delete a document by its ID.
       Example: DELETE /documents/{id}/

    ### Additional Actions:
    1. **Trashbin**: List soft deleted documents for a document owner
        Example: GET /documents/{id}/trashbin/

    2. **Children**: List or create child documents.
        Example: GET, POST /documents/{id}/children/

    3. **Versions List**: Retrieve version history of a document.
        Example: GET /documents/{id}/versions/

    4. **Version Detail**: Get or delete a specific document version.
        Example: GET, DELETE /documents/{id}/versions/{version_id}/

    5. **Favorite**: Get list of favorite documents for a user. Mark or unmark
        a document as favorite.
        Examples:
        - GET /documents/favorite/
        - POST, DELETE /documents/{id}/favorite/

    6. **Create for Owner**: Create a document via server-to-server on behalf of a user.
        Example: POST /documents/create-for-owner/

    7. **Link Configuration**: Update document link configuration.
        Example: PUT /documents/{id}/link-configuration/

    8. **Attachment Upload**: Upload a file attachment for the document.
        Example: POST /documents/{id}/attachment-upload/

    9. **Media Auth**: Authorize access to document media.
        Example: GET /documents/media-auth/

    10. **AI Transform**: Apply a transformation action on a piece of text with AI.
        Example: POST /documents/{id}/ai-transform/
        Expected data:
        - text (str): The input text.
        - action (str): The transformation type, one of [prompt, correct, rephrase, summarize].
        Returns: JSON response with the processed text.
        Throttled by: AIDocumentRateThrottle, AIUserRateThrottle.

    11. **AI Translate**: Translate a piece of text with AI.
        Example: POST /documents/{id}/ai-translate/
        Expected data:
        - text (str): The input text.
        - language (str): The target language, chosen from settings.LANGUAGES.
        Returns: JSON response with the translated text.
        Throttled by: AIDocumentRateThrottle, AIUserRateThrottle.

    12. **AI Proxy**: Proxy an AI request to an external AI service.
        Example: POST /api/v1.0/documents/<resource_id>/ai-proxy

    ### Ordering: created_at, updated_at, is_favorite, title

        Example:
        - Ascending: GET /api/v1.0/documents/?ordering=created_at
        - Descending: GET /api/v1.0/documents/?ordering=-title

    ### Filtering:
        - `is_creator_me=true`: Returns documents created by the current user.
        - `is_creator_me=false`: Returns documents created by other users.
        - `is_favorite=true`: Returns documents marked as favorite by the current user
        - `is_favorite=false`: Returns documents not marked as favorite by the current user
        - `title=hello`: Returns documents which title contains the "hello" string

        Example:
        - GET /api/v1.0/documents/?is_creator_me=true&is_favorite=true
        - GET /api/v1.0/documents/?is_creator_me=false&title=hello

    ### Annotations:
    1. **is_favorite**: Indicates whether the document is marked as favorite by the current user.
    2. **user_roles**: Roles the current user has on the document or its ancestors.

    ### Notes:
    - Only the highest ancestor in a document hierarchy is shown in list views.
    - Implements soft delete logic to retain document tree structures.
    """

    metadata_class = DocumentMetadata
    ordering = ["-updated_at"]
    ordering_fields = ["created_at", "updated_at", "title"]
    pagination_class = Pagination
    permission_classes = [
        permissions.DocumentPermission,
    ]
    throttle_classes = [DocumentThrottle]
    throttle_scope = "document"
    queryset = models.Document.objects.select_related("creator").all()
    serializer_class = serializers.DocumentSerializer
    ai_translate_serializer_class = serializers.AITranslateSerializer
    all_serializer_class = serializers.ListDocumentSerializer
    children_serializer_class = serializers.ListDocumentSerializer
    descendants_serializer_class = serializers.ListDocumentSerializer
    list_serializer_class = serializers.ListDocumentSerializer
    trashbin_serializer_class = serializers.ListDocumentSerializer
    tree_serializer_class = serializers.ListDocumentSerializer
    search_serializer_class = serializers.ListDocumentSerializer

    def get_queryset(self):
        """Get queryset performing all annotation and filtering on the document tree structure."""
        user = self.request.user
        queryset = super().get_queryset()

        # Only list views need filtering and annotation
        if self.detail:
            return queryset

        if not user.is_authenticated:
            return queryset.none()

        queryset = queryset.filter(ancestors_deleted_at__isnull=True)

        # Filter documents to which the current user has access...
        access_documents_ids = models.DocumentAccess.objects.filter(
            db.Q(user=user) | db.Q(team__in=user.teams)
        ).values_list("document_id", flat=True)

        # ...or that were previously accessed and are not restricted
        traced_documents_ids = models.LinkTrace.objects.filter(user=user).values_list(
            "document_id", flat=True
        )

        return queryset.filter(
            db.Q(id__in=access_documents_ids)
            | (
                db.Q(id__in=traced_documents_ids)
                & ~db.Q(link_reach=models.LinkReachChoices.RESTRICTED)
            )
        )

    def filter_queryset(self, queryset):
        """Override to apply annotations to generic views."""
        queryset = super().filter_queryset(queryset)
        user = self.request.user
        queryset = queryset.annotate_is_favorite(user)
        queryset = queryset.annotate_user_roles(user)
        return queryset

    def get_response_for_queryset(self, queryset, context=None):
        """Return paginated response for the queryset if requested."""
        context = context or self.get_serializer_context()
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True, context=context)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True, context=context)
        return drf.response.Response(serializer.data)

    def list(self, request, *args, **kwargs):
        """
        Returns a DRF response containing the filtered, annotated and ordered document list.

        This method applies filtering based on request parameters using `ListDocumentFilter`.
        It performs early filtering on model fields, annotates user roles, and removes
        descendant documents to keep only the highest ancestors readable by the current user.
        """
        user = self.request.user

        # Not calling filter_queryset. We do our own cooking.
        queryset = self.get_queryset()

        filterset = ListDocumentFilter(
            self.request.GET, queryset=queryset, request=self.request
        )
        if not filterset.is_valid():
            raise drf.exceptions.ValidationError(filterset.errors)
        filter_data = filterset.form.cleaned_data

        # Filter as early as possible on fields that are available on the model
        for field in ["is_creator_me", "title"]:
            queryset = filterset.filters[field].filter(queryset, filter_data[field])

        queryset = queryset.annotate_user_roles(user)

        # Among the results, we may have documents that are ancestors/descendants
        # of each other. In this case we want to keep only the highest ancestors.
        root_paths = utils.filter_root_paths(
            queryset.order_by("path").values_list("path", flat=True),
            skip_sorting=True,
        )
        queryset = queryset.filter(path__in=root_paths)

        # Annotate favorite status and filter if applicable as late as possible
        queryset = queryset.annotate_is_favorite(user)
        for field in ["is_favorite", "is_masked"]:
            queryset = filterset.filters[field].filter(queryset, filter_data[field])

        # Apply ordering only now that everything is filtered and annotated
        queryset = filters.OrderingFilter().filter_queryset(
            self.request, queryset, self
        )

        return self.get_response_for_queryset(queryset)

    def retrieve(self, request, *args, **kwargs):
        """
        Add a trace that the document was accessed by a user. This is used to list documents
        on a user's list view even though the user has no specific role in the document (link
        access when the link reach configuration of the document allows it).
        """
        user = self.request.user
        instance = self.get_object()
        serializer = self.get_serializer(instance)

        # The `create` query generates 5 db queries which are much less efficient than an
        # `exists` query. The user will visit the document many times after the first visit
        # so that's what we should optimize for.
        if (
            user.is_authenticated
            and not instance.link_traces.filter(user=user).exists()
        ):
            models.LinkTrace.objects.create(document=instance, user=request.user)

        return drf.response.Response(serializer.data)

    @transaction.atomic
    def perform_create(self, serializer):
        """Set the current user as creator and owner of the newly created object."""

        # locks the table to ensure safe concurrent access
        with connection.cursor() as cursor:
            cursor.execute(
                f'LOCK TABLE "{models.Document._meta.db_table}" '  # noqa: SLF001
                "IN SHARE ROW EXCLUSIVE MODE;"
            )

        # Remove file from validated_data as it's not a model field
        # Process it if present
        uploaded_file = serializer.validated_data.pop("file", None)

        # If a file is uploaded, convert it to Yjs format and set as content
        if uploaded_file:
            try:
                file_content = uploaded_file.read()

                converter = Converter()
                converted_content = converter.convert(
                    file_content,
                    content_type=uploaded_file.content_type,
                    accept=mime_types.YJS,
                )
                serializer.validated_data["content"] = converted_content
                serializer.validated_data["title"] = uploaded_file.name
            except ConversionError as err:
                raise drf.exceptions.ValidationError(
                    {"file": ["Could not convert file content"]}
                ) from err

        obj = models.Document.add_root(
            creator=self.request.user,
            **serializer.validated_data,
        )
        serializer.instance = obj
        models.DocumentAccess.objects.create(
            document=obj,
            user=self.request.user,
            role=models.RoleChoices.OWNER,
        )

    def perform_destroy(self, instance):
        """Override to implement a soft delete instead of dumping the record in database."""
        instance.soft_delete()

    def _can_user_edit_document(self, document_id, set_cache=False):
        """Check if the user can edit the document."""
        try:
            count, exists = CollaborationService().get_document_connection_info(
                document_id,
                self.request.session.session_key,
            )
        except requests.HTTPError as e:
            logger.exception("Failed to call collaboration server: %s", e)
            count = 0
            exists = False

        if count == 0:
            # Nobody is connected to the websocket server
            logger.debug("update without connection found in the websocket server")
            cache_key = f"docs:no-websocket:{document_id}"
            current_editor = cache.get(cache_key)

            if not current_editor:
                if set_cache:
                    cache.set(
                        cache_key,
                        self.request.session.session_key,
                        settings.NO_WEBSOCKET_CACHE_TIMEOUT,
                    )
                return True

            if current_editor != self.request.session.session_key:
                return False

            if set_cache:
                cache.touch(cache_key, settings.NO_WEBSOCKET_CACHE_TIMEOUT)
            return True

        if exists:
            # Current user is connected to the websocket server
            logger.debug("session key found in the websocket server")
            return True

        logger.debug(
            "Users connected to the websocket but current editor not connected to it. Can not edit."
        )

        return False

    def perform_update(self, serializer):
        """Check rules about collaboration."""
        if (
            serializer.validated_data.get("websocket", False)
            or not settings.COLLABORATION_WS_NOT_CONNECTED_READY_ONLY
        ):
            return super().perform_update(serializer)

        if self._can_user_edit_document(serializer.instance.id, set_cache=True):
            return super().perform_update(serializer)

        raise drf.exceptions.PermissionDenied(
            "You are not allowed to edit this document."
        )

    @drf.decorators.action(
        detail=True,
        methods=["get"],
        url_path="can-edit",
    )
    def can_edit(self, request, *args, **kwargs):
        """Check if the current user can edit the document."""
        document = self.get_object()

        can_edit = (
            True
            if not settings.COLLABORATION_WS_NOT_CONNECTED_READY_ONLY
            else self._can_user_edit_document(document.id)
        )

        return drf.response.Response({"can_edit": can_edit})

    @drf.decorators.action(
        detail=False,
        methods=["get"],
        permission_classes=[permissions.IsAuthenticated],
    )
    def favorite_list(self, request, *args, **kwargs):
        """Get list of favorite documents for the current user."""
        user = request.user

        queryset = self.get_queryset()

        # Among the results, we may have documents that are ancestors/descendants
        # of each other. In this case we want to keep only the highest ancestors.
        root_paths = utils.filter_root_paths(
            queryset.order_by("path").values_list("path", flat=True),
            skip_sorting=True,
        )

        path_list = db.Q()
        for path in root_paths:
            path_list |= db.Q(path__startswith=path)

        favorite_documents_ids = models.DocumentFavorite.objects.filter(
            user=user
        ).values_list("document_id", flat=True)

        queryset = self.queryset.filter(path_list)
        queryset = queryset.filter(id__in=favorite_documents_ids)
        queryset = queryset.annotate_user_roles(user)
        queryset = queryset.annotate(
            is_favorite=db.Value(True, output_field=db.BooleanField())
        )
        return self.get_response_for_queryset(queryset)

    @drf.decorators.action(
        detail=False,
        methods=["get"],
    )
    def trashbin(self, request, *args, **kwargs):
        """
        Retrieve soft-deleted documents for which the current user has the owner role.

        The selected documents are those deleted within the cutoff period defined in the
        settings (see TRASHBIN_CUTOFF_DAYS), before they are considered permanently deleted.
        """

        if not request.user.is_authenticated:
            return self.get_response_for_queryset(self.queryset.none())

        access_documents_paths = (
            models.DocumentAccess.objects.select_related("document")
            .filter(
                db.Q(user=self.request.user) | db.Q(team__in=self.request.user.teams),
                role=models.RoleChoices.OWNER,
            )
            .values_list("document__path", flat=True)
        )

        if not access_documents_paths:
            return self.get_response_for_queryset(self.queryset.none())

        children_clause = db.Q()
        for path in access_documents_paths:
            children_clause |= db.Q(path__startswith=path)

        queryset = self.queryset.filter(
            children_clause,
            deleted_at__isnull=False,
            deleted_at__gte=models.get_trashbin_cutoff(),
        )
        queryset = queryset.annotate_user_roles(self.request.user)

        return self.get_response_for_queryset(queryset)

    @drf.decorators.action(
        authentication_classes=[authentication.ServerToServerAuthentication],
        detail=False,
        methods=["post"],
        permission_classes=[],
        url_path="create-for-owner",
    )
    @transaction.atomic
    def create_for_owner(self, request):
        """
        Create a document on behalf of a specified owner (pre-existing user or invited).
        """

        # locks the table to ensure safe concurrent access
        with connection.cursor() as cursor:
            cursor.execute(
                f'LOCK TABLE "{models.Document._meta.db_table}" '  # noqa: SLF001
                "IN SHARE ROW EXCLUSIVE MODE;"
            )

        # Deserialize and validate the data
        serializer = serializers.ServerCreateDocumentSerializer(data=request.data)
        if not serializer.is_valid():
            return drf_response.Response(
                serializer.errors, status=status.HTTP_400_BAD_REQUEST
            )

        document = serializer.save()

        return drf_response.Response(
            {"id": str(document.id)}, status=status.HTTP_201_CREATED
        )

    @drf.decorators.action(detail=True, methods=["post"])
    @transaction.atomic
    def move(self, request, *args, **kwargs):
        """
        Move a document to another location within the document tree.

        The user must be an administrator or owner of both the document being moved
        and the target parent document.
        """
        user = request.user
        document = self.get_object()  # including permission checks

        # Validate the input payload
        serializer = serializers.MoveDocumentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated_data = serializer.validated_data

        target_document_id = validated_data["target_document_id"]
        try:
            target_document = models.Document.objects.get(
                id=target_document_id, ancestors_deleted_at__isnull=True
            )
        except models.Document.DoesNotExist:
            return drf.response.Response(
                {"target_document_id": "Target parent document does not exist."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        position = validated_data["position"]
        message = None
        owner_accesses = []
        if position in [
            enums.MoveNodePositionChoices.FIRST_CHILD,
            enums.MoveNodePositionChoices.LAST_CHILD,
        ]:
            if not target_document.get_abilities(user).get("move"):
                message = (
                    "You do not have permission to move documents "
                    "as a child to this target document."
                )
        elif target_document.is_root():
            owner_accesses = document.get_root().accesses.filter(
                role=models.RoleChoices.OWNER
            )
        elif not target_document.get_parent().get_abilities(user).get("move"):
            message = (
                "You do not have permission to move documents "
                "as a sibling of this target document."
            )

        if message:
            return drf.response.Response(
                {"target_document_id": message},
                status=status.HTTP_400_BAD_REQUEST,
            )

        document.move(target_document, pos=position)

        # Make sure we have at least one owner
        if (
            owner_accesses
            and not document.accesses.filter(role=models.RoleChoices.OWNER).exists()
        ):
            for owner_access in owner_accesses:
                models.DocumentAccess.objects.update_or_create(
                    document=document,
                    user=owner_access.user,
                    team=owner_access.team,
                    defaults={"role": models.RoleChoices.OWNER},
                )

        return drf.response.Response(
            {"message": "Document moved successfully."}, status=status.HTTP_200_OK
        )

    @drf.decorators.action(
        detail=True,
        methods=["post"],
    )
    def restore(self, request, *args, **kwargs):
        """
        Restore a soft-deleted document if it was deleted less than x days ago.
        """
        document = self.get_object()
        document.restore()

        return drf_response.Response(
            {"detail": "Document has been successfully restored."},
            status=status.HTTP_200_OK,
        )

    @drf.decorators.action(
        detail=True,
        methods=["get", "post"],
        ordering=["path"],
    )
    def children(self, request, *args, **kwargs):
        """Handle listing and creating children of a document"""
        document = self.get_object()

        if request.method == "POST":
            # Create a child document
            serializer = serializers.DocumentSerializer(
                data=request.data, context=self.get_serializer_context()
            )
            serializer.is_valid(raise_exception=True)

            with transaction.atomic():
                # "select_for_update" locks the table to ensure safe concurrent access
                locked_parent = models.Document.objects.select_for_update().get(
                    pk=document.pk
                )

                child_document = locked_parent.add_child(
                    creator=request.user,
                    **serializer.validated_data,
                )

            # Set the created instance to the serializer
            serializer.instance = child_document

            headers = self.get_success_headers(serializer.data)
            return drf.response.Response(
                serializer.data, status=status.HTTP_201_CREATED, headers=headers
            )

        # GET: List children
        queryset = (
            document.get_children()
            .select_related("creator")
            .filter(ancestors_deleted_at__isnull=True)
        )
        queryset = self.filter_queryset(queryset)

        filterset = DocumentFilter(request.GET, queryset=queryset)
        if not filterset.is_valid():
            raise drf.exceptions.ValidationError(filterset.errors)

        queryset = filterset.qs

        # Pass ancestors' links paths mapping to the serializer as a context variable
        # in order to allow saving time while computing abilities on the instance
        paths_links_mapping = document.compute_ancestors_links_paths_mapping()

        return self.get_response_for_queryset(
            queryset,
            context={
                "request": request,
                "paths_links_mapping": paths_links_mapping,
            },
        )

    @drf.decorators.action(
        detail=False,
        methods=["get"],
    )
    def all(self, request, *args, **kwargs):
        """
        Returns all documents (including descendants) that the user has access to.

        Unlike the list endpoint which only returns top-level documents, this endpoint
        returns all documents including children, grandchildren, etc.
        """
        user = self.request.user

        accessible_documents = self.get_queryset()
        accessible_paths = list(accessible_documents.values_list("path", flat=True))

        if not accessible_paths:
            return self.get_response_for_queryset(self.queryset.none())

        # Build query to include all descendants using path prefix matching
        descendants_clause = db.Q()
        for path in accessible_paths:
            descendants_clause |= db.Q(path__startswith=path)

        queryset = self.queryset.filter(
            descendants_clause, ancestors_deleted_at__isnull=True
        )

        # Apply existing filters
        filterset = ListDocumentFilter(
            self.request.GET, queryset=queryset, request=self.request
        )
        if not filterset.is_valid():
            raise drf.exceptions.ValidationError(filterset.errors)
        filter_data = filterset.form.cleaned_data

        # Filter as early as possible on fields that are available on the model
        for field in ["is_creator_me", "title"]:
            queryset = filterset.filters[field].filter(queryset, filter_data[field])

        queryset = queryset.annotate_user_roles(user)

        # Annotate favorite status and filter if applicable as late as possible
        queryset = queryset.annotate_is_favorite(user)
        for field in ["is_favorite", "is_masked"]:
            queryset = filterset.filters[field].filter(queryset, filter_data[field])

        # Apply ordering only now that everything is filtered and annotated
        queryset = filters.OrderingFilter().filter_queryset(
            self.request, queryset, self
        )

        return self.get_response_for_queryset(queryset)

    @drf.decorators.action(
        detail=True,
        methods=["get"],
        ordering=["path"],
    )
    def descendants(self, request, *args, **kwargs):
        """Handle listing descendants of a document"""
        document = self.get_object()

        queryset = document.get_descendants().filter(ancestors_deleted_at__isnull=True)
        queryset = self.filter_queryset(queryset)

        filterset = DocumentFilter(request.GET, queryset=queryset)
        if not filterset.is_valid():
            raise drf.exceptions.ValidationError(filterset.errors)

        queryset = filterset.qs

        return self.get_response_for_queryset(queryset)

    @drf.decorators.action(
        detail=True,
        methods=["get"],
        ordering=["path"],
    )
    def tree(self, request, pk, *args, **kwargs):
        """
        List ancestors tree above the document.
        What we need to display is the tree structure opened for the current document.
        """
        user = self.request.user

        try:
            current_document = (
                self.queryset.select_related(None)
                .only("depth", "path", "ancestors_deleted_at")
                .get(pk=pk)
            )
        except models.Document.DoesNotExist as excpt:
            raise drf.exceptions.NotFound() from excpt

        is_deleted = current_document.ancestors_deleted_at is not None

        if is_deleted:
            if current_document.get_role(user) != models.RoleChoices.OWNER:
                raise (
                    drf.exceptions.PermissionDenied()
                    if request.user.is_authenticated
                    else drf.exceptions.NotAuthenticated()
                )
            highest_readable = current_document
            ancestors = self.queryset.select_related(None).filter(pk=pk)
        else:
            ancestors = (
                (
                    current_document.get_ancestors()
                    | self.queryset.select_related(None).filter(pk=pk)
                )
                .filter(ancestors_deleted_at__isnull=True)
                .order_by("path")
            )
            # Get the highest readable ancestor
            highest_readable = (
                ancestors.select_related(None)
                .readable_per_se(request.user)
                .only("depth", "path")
                .first()
            )

            if highest_readable is None:
                raise (
                    drf.exceptions.PermissionDenied()
                    if request.user.is_authenticated
                    else drf.exceptions.NotAuthenticated()
                )
        paths_links_mapping = {}
        ancestors_links = []
        children_clause = db.Q()
        for ancestor in ancestors:
            # Compute cache for ancestors links to avoid many queries while computing
            # abilities for his documents in the tree!
            ancestors_links.append(
                {"link_reach": ancestor.link_reach, "link_role": ancestor.link_role}
            )
            paths_links_mapping[ancestor.path] = ancestors_links.copy()

            if ancestor.depth < highest_readable.depth:
                continue

            children_clause |= db.Q(
                path__startswith=ancestor.path, depth=ancestor.depth + 1
            )

        children = self.queryset.filter(children_clause, deleted_at__isnull=True)

        queryset = (
            ancestors.select_related("creator").filter(
                depth__gte=highest_readable.depth
            )
            | children
        )
        queryset = queryset.order_by("path")
        queryset = queryset.annotate_user_roles(user)
        queryset = queryset.annotate_is_favorite(user)

        # Pass ancestors' links paths mapping to the serializer as a context variable
        # in order to allow saving time while computing abilities on the instance
        serializer = self.get_serializer(
            queryset,
            many=True,
            context={
                "request": request,
                "paths_links_mapping": paths_links_mapping,
            },
        )
        return drf.response.Response(
            utils.nest_tree(serializer.data, self.queryset.model.steplen)
        )

    @drf.decorators.action(
        detail=True,
        methods=["post"],
        permission_classes=[
            permissions.IsAuthenticated,
            permissions.DocumentPermission,
        ],
        url_path="duplicate",
    )
    @transaction.atomic
    def duplicate(self, request, *args, **kwargs):
        """
        Duplicate a document, alongside its descendants if requested.
        """
        # Get document while checking permissions
        document_to_duplicate = self.get_object()

        serializer = serializers.DocumentDuplicationSerializer(
            data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        user = request.user

        duplicated_document = self._duplicate_document(
            document_to_duplicate=document_to_duplicate,
            serializer=serializer,
            user=user,
        )

        return drf_response.Response(
            {"id": str(duplicated_document.id)}, status=status.HTTP_201_CREATED
        )

    def _duplicate_document(
        self,
        document_to_duplicate,
        serializer,
        user,
        new_parent=None,
    ):
        """
        Duplicate a document and store the links to attached files in the duplicated
        document to allow cross-access.

        Optionally duplicates accesses if `with_accesses` is set to true
        in the payload.

        Optionally duplicates sub-documents if `with_descendants` is set to true in
        the payload. In this case, the whole subtree of the document will be duplicated,
        and the links to attached files will be stored in all duplicated documents.

        The `with_accesses` option will also be applied to all duplicated documents
        if `with_descendants` is set to true.
        """
        with_accesses = serializer.validated_data.get("with_accesses", False)
        with_descendants = serializer.validated_data.get("with_descendants", False)

        user_role = document_to_duplicate.get_role(user)
        is_owner_or_admin = user_role in models.PRIVILEGED_ROLES

        base64_yjs_content = document_to_duplicate.content

        # Duplicate the document instance
        link_kwargs = (
            {
                "link_reach": document_to_duplicate.link_reach,
                "link_role": document_to_duplicate.link_role,
            }
            if with_accesses
            else {}
        )
        extracted_attachments = set(extract_attachments(document_to_duplicate.content))
        attachments = list(
            extracted_attachments & set(document_to_duplicate.attachments)
        )
        title = capfirst(_("copy of {title}").format(title=document_to_duplicate.title))
        # If parent_duplicate is provided we must add the duplicated document as a child
        if new_parent is not None:
            duplicated_document = new_parent.add_child(
                title=title,
                content=base64_yjs_content,
                attachments=attachments,
                duplicated_from=document_to_duplicate,
                creator=user,
                **link_kwargs,
            )

            # Handle access duplication for this child
            if with_accesses and is_owner_or_admin:
                original_accesses = models.DocumentAccess.objects.filter(
                    document=document_to_duplicate
                ).exclude(user=user)

                accesses_to_create = [
                    models.DocumentAccess(
                        document=duplicated_document,
                        user_id=access.user_id,
                        team=access.team,
                        role=access.role,
                    )
                    for access in original_accesses
                ]

                if accesses_to_create:
                    models.DocumentAccess.objects.bulk_create(accesses_to_create)

        elif not document_to_duplicate.is_root() and choices.RoleChoices.get_priority(
            user_role
        ) < choices.RoleChoices.get_priority(models.RoleChoices.EDITOR):
            duplicated_document = models.Document.add_root(
                creator=user,
                title=title,
                content=base64_yjs_content,
                attachments=attachments,
                duplicated_from=document_to_duplicate,
                **link_kwargs,
            )
            models.DocumentAccess.objects.create(
                document=duplicated_document,
                user=user,
                role=models.RoleChoices.OWNER,
            )
        else:
            duplicated_document = document_to_duplicate.add_sibling(
                "right",
                title=title,
                content=base64_yjs_content,
                attachments=attachments,
                duplicated_from=document_to_duplicate,
                creator=user,
                **link_kwargs,
            )

            # Always add the logged-in user as OWNER for root documents
            if document_to_duplicate.is_root():
                accesses_to_create = [
                    models.DocumentAccess(
                        document=duplicated_document,
                        user=user,
                        role=models.RoleChoices.OWNER,
                    )
                ]

                # If accesses should be duplicated,
                # add other users' accesses as per original document
                if with_accesses and is_owner_or_admin:
                    original_accesses = models.DocumentAccess.objects.filter(
                        document=document_to_duplicate
                    ).exclude(user=user)

                    accesses_to_create.extend(
                        models.DocumentAccess(
                            document=duplicated_document,
                            user_id=access.user_id,
                            team=access.team,
                            role=access.role,
                        )
                        for access in original_accesses
                    )

                # Bulk create all the duplicated accesses
                models.DocumentAccess.objects.bulk_create(accesses_to_create)

        if with_descendants:
            for child in document_to_duplicate.get_children().filter(
                ancestors_deleted_at__isnull=True
            ):
                # When duplicating descendants, attach duplicates under the duplicated_document
                self._duplicate_document(
                    document_to_duplicate=child,
                    serializer=serializer,
                    user=user,
                    new_parent=duplicated_document,
                )

        return duplicated_document

    def _search_simple(self, request, text):
        """
        Returns a queryset filtered by the content of the document title
        """
        # As the 'list' view we get a prefiltered queryset (deleted docs are excluded)
        queryset = self.get_queryset()
        filterset = DocumentFilter({"title": text}, queryset=queryset)

        if not filterset.is_valid():
            raise drf.exceptions.ValidationError(filterset.errors)

        queryset = filterset.filter_queryset(queryset)

        return self.get_response_for_queryset(
            queryset.order_by("-updated_at"),
            context={
                "request": request,
            },
        )

    def _search_fulltext(self, indexer, request, params):
        """
        Returns a queryset from the results the fulltext search of Find
        """
        access_token = request.session.get("oidc_access_token")
        user = request.user
        text = params.validated_data["q"]
        queryset = models.Document.objects.all()

        # Retrieve the documents ids from Find.
        results = indexer.search(
            text=text,
            token=access_token,
            visited=get_visited_document_ids_of(queryset, user),
        )

        docs_by_uuid = {str(d.pk): d for d in queryset.filter(pk__in=results)}
        ordered_docs = [docs_by_uuid[id] for id in results]

        page = self.paginate_queryset(ordered_docs)

        serializer = self.get_serializer(
            page if page else ordered_docs,
            many=True,
            context={
                "request": request,
            },
        )

        return self.get_paginated_response(serializer.data)

    @drf.decorators.action(detail=False, methods=["get"], url_path="search")
    @method_decorator(refresh_oidc_access_token)
    def search(self, request, *args, **kwargs):
        """
        Returns a DRF response containing the filtered, annotated and ordered document list.

        Applies filtering based on request parameter 'q' from `SearchDocumentSerializer`.
        Depending of the configuration it can be:
         - A fulltext search through the opensearch indexation app "find" if the backend is
           enabled (see SEARCH_INDEXER_CLASS)
         - A filtering by the model field 'title'.

        The ordering is always by the most recent first.
        """
        params = serializers.SearchDocumentSerializer(data=request.query_params)
        params.is_valid(raise_exception=True)

        indexer = get_document_indexer()

        if indexer:
            return self._search_fulltext(indexer, request, params=params)

        # The indexer is not configured, we fallback on a simple icontains filter by the
        # model field 'title'.
        return self._search_simple(request, text=params.validated_data["q"])

    @drf.decorators.action(detail=True, methods=["get"], url_path="versions")
    def versions_list(self, request, *args, **kwargs):
        """
        Return the document's versions but only those created after the user got access
        to the document
        """
        user = request.user
        if not user.is_authenticated:
            raise drf.exceptions.PermissionDenied("Authentication required.")

        # Validate query parameters using dedicated serializer
        serializer = serializers.VersionFilterSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)

        document = self.get_object()

        # Users should not see version history dating from before they gained access to the
        # document. Filter to get the minimum access date for the logged-in user
        access_queryset = models.DocumentAccess.objects.filter(
            db.Q(user=user) | db.Q(team__in=user.teams),
            document__path=Left(db.Value(document.path), Length("document__path")),
        ).aggregate(min_date=db.Min("created_at"))

        # Handle the case where the user has no accesses
        min_datetime = access_queryset["min_date"]
        if not min_datetime:
            return drf.exceptions.PermissionDenied(
                "Only users with specific access can see version history"
            )

        versions_data = document.get_versions_slice(
            from_version_id=serializer.validated_data.get("version_id"),
            min_datetime=min_datetime,
            page_size=serializer.validated_data.get("page_size"),
        )

        return drf.response.Response(versions_data)

    @drf.decorators.action(
        detail=True,
        methods=["get", "delete"],
        url_path=r"versions/(?P<version_id>[A-Za-z0-9._+\-=~]{1,1024})",
    )
    # pylint: disable=unused-argument
    def versions_detail(self, request, pk, version_id, *args, **kwargs):
        """Custom action to retrieve a specific version of a document"""
        document = self.get_object()

        try:
            response = document.get_content_response(version_id=version_id)
        except (FileNotFoundError, ClientError) as err:
            raise Http404 from err

        # Don't let users access versions that were created before they were given access
        # to the document
        user = request.user
        min_datetime = min(
            access.created_at
            for access in models.DocumentAccess.objects.filter(
                db.Q(user=user) | db.Q(team__in=user.teams),
                document__path=Left(db.Value(document.path), Length("document__path")),
            )
        )

        if response["LastModified"] < min_datetime:
            raise Http404

        if request.method == "DELETE":
            response = document.delete_version(version_id)
            return drf.response.Response(
                status=response["ResponseMetadata"]["HTTPStatusCode"]
            )

        return drf.response.Response(
            {
                "content": response["Body"].read().decode("utf-8"),
                "last_modified": response["LastModified"],
                "id": version_id,
            }
        )

    @drf.decorators.action(detail=True, methods=["put"], url_path="link-configuration")
    def link_configuration(self, request, *args, **kwargs):
        """Update link configuration with specific rights (cf get_abilities)."""
        # Check permissions first
        document = self.get_object()

        # Deserialize and validate the data
        serializer = serializers.LinkDocumentSerializer(
            document, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)

        serializer.save()

        # Notify collaboration server about the link updated
        CollaborationService().reset_connections(str(document.id))

        return drf.response.Response(serializer.data, status=drf.status.HTTP_200_OK)

    @drf.decorators.action(detail=True, methods=["post", "delete"], url_path="favorite")
    def favorite(self, request, *args, **kwargs):
        """
        Mark or unmark the document as a favorite for the logged-in user based on the HTTP method.
        """
        # Check permissions first
        document = self.get_object()
        user = request.user

        if request.method == "POST":
            # Try to mark as favorite
            try:
                models.DocumentFavorite.objects.create(document=document, user=user)
            except ValidationError:
                return drf.response.Response(
                    {"detail": "Document already marked as favorite"},
                    status=drf.status.HTTP_200_OK,
                )
            return drf.response.Response(
                {"detail": "Document marked as favorite"},
                status=drf.status.HTTP_201_CREATED,
            )

        # Handle DELETE method to unmark as favorite
        deleted, _ = models.DocumentFavorite.objects.filter(
            document=document, user=user
        ).delete()
        if deleted:
            return drf.response.Response(status=drf.status.HTTP_204_NO_CONTENT)
        return drf.response.Response(
            {"detail": "Document was already not marked as favorite"},
            status=drf.status.HTTP_200_OK,
        )

    @drf.decorators.action(detail=True, methods=["post", "delete"], url_path="mask")
    def mask(self, request, *args, **kwargs):
        """Mask or unmask the document for the logged-in user based on the HTTP method."""
        # Check permissions first
        document = self.get_object()
        user = request.user

        try:
            link_trace = models.LinkTrace.objects.get(document=document, user=user)
        except models.LinkTrace.DoesNotExist:
            return drf.response.Response(
                {"detail": "User never accessed this document before."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if request.method == "POST":
            if link_trace.is_masked:
                return drf.response.Response(
                    {"detail": "Document was already masked"},
                    status=drf.status.HTTP_200_OK,
                )
            link_trace.is_masked = True
            link_trace.save(update_fields=["is_masked"])
            return drf.response.Response(
                {"detail": "Document was masked"},
                status=drf.status.HTTP_201_CREATED,
            )

        # Handle DELETE method to unmask document
        if not link_trace.is_masked:
            return drf.response.Response(
                {"detail": "Document was already not masked"},
                status=drf.status.HTTP_200_OK,
            )
        link_trace.is_masked = False
        link_trace.save(update_fields=["is_masked"])
        return drf.response.Response(status=drf.status.HTTP_204_NO_CONTENT)

    @drf.decorators.action(detail=True, methods=["post"], url_path="attachment-upload")
    def attachment_upload(self, request, *args, **kwargs):
        """Upload a file related to a given document"""
        # Check permissions first
        document = self.get_object()

        # Validate metadata in payload
        serializer = serializers.FileUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Generate a generic yet unique filename to store the image in object storage
        file_id = uuid.uuid4()
        ext = serializer.validated_data["expected_extension"]

        # Prepare metadata for storage
        extra_args = {
            "Metadata": {
                "owner": str(request.user.id),
                "status": enums.DocumentAttachmentStatus.PROCESSING,
            },
            "ContentType": serializer.validated_data["content_type"],
        }
        file_unsafe = ""
        if serializer.validated_data["is_unsafe"]:
            extra_args["Metadata"]["is_unsafe"] = "true"
            file_unsafe = "-unsafe"

        key = f"{document.key_base}/{enums.ATTACHMENTS_FOLDER:s}/{file_id!s}{file_unsafe}.{ext:s}"

        file_name = serializer.validated_data["file_name"]
        if (
            not serializer.validated_data["content_type"].startswith("image/")
            or serializer.validated_data["is_unsafe"]
        ):
            extra_args.update(
                {"ContentDisposition": f'attachment; filename="{file_name:s}"'}
            )
        else:
            extra_args.update(
                {"ContentDisposition": f'inline; filename="{file_name:s}"'}
            )

        file = serializer.validated_data["file"]
        default_storage.connection.meta.client.upload_fileobj(
            file, default_storage.bucket_name, key, ExtraArgs=extra_args
        )

        # Make the attachment readable by document readers
        document.attachments.append(key)
        document.save()

        malware_detection.analyse_file(key, document_id=document.id)

        url = reverse(
            "documents-media-check",
            kwargs={"pk": document.id},
        )
        parameters = urlencode({"key": key})

        return drf.response.Response(
            {
                "file": f"{url:s}?{parameters:s}",
            },
            status=drf.status.HTTP_201_CREATED,
        )

    def _auth_get_original_url(self, request):
        """
        Extracts and parses the original URL from the "HTTP_X_ORIGINAL_URL" header.
        Raises PermissionDenied if the header is missing.

        The original url is passed by nginx in the "HTTP_X_ORIGINAL_URL" header.
        See corresponding ingress configuration in Helm chart and read about the
        nginx.ingress.kubernetes.io/auth-url annotation to understand how the Nginx ingress
        is configured to do this.

        Based on the original url and the logged in user, we must decide if we authorize Nginx
        to let this request go through (by returning a 200 code) or if we block it (by returning
        a 403 error). Note that we return 403 errors without any further details for security
        reasons.
        """
        # Extract the original URL from the request header
        original_url = request.META.get("HTTP_X_ORIGINAL_URL")
        if not original_url:
            logger.debug("Missing HTTP_X_ORIGINAL_URL header in subrequest")
            raise drf.exceptions.PermissionDenied()

        logger.debug("Original url: '%s'", original_url)
        return urlparse(original_url)

    def _auth_get_url_params(self, pattern, fragment):
        """
        Extracts URL parameters from the given fragment using the specified regex pattern.
        Raises PermissionDenied if parameters cannot be extracted.
        """
        match = pattern.search(fragment)
        try:
            return match.groupdict()
        except (ValueError, AttributeError) as exc:
            logger.debug("Failed to extract parameters from subrequest URL: %s", exc)
            raise drf.exceptions.PermissionDenied() from exc

    @drf.decorators.action(detail=False, methods=["get"], url_path="media-auth")
    def media_auth(self, request, *args, **kwargs):
        """
        This view is used by an Nginx subrequest to control access to a document's
        attachment file.

        When we let the request go through, we compute authorization headers that will be added to
        the request going through thanks to the nginx.ingress.kubernetes.io/auth-response-headers
        annotation. The request will then be proxied to the object storage backend who will
        respond with the file after checking the signature included in headers.
        """
        parsed_url = self._auth_get_original_url(request)
        url_params = self._auth_get_url_params(
            enums.MEDIA_STORAGE_URL_PATTERN, parsed_url.path
        )

        user = request.user
        key = f"{url_params['pk']:s}/{url_params['attachment']:s}"

        # Look for a document to which the user has access and that includes this attachment
        # We must look into all descendants of any document to which the user has access per se
        readable_per_se_paths = (
            self.queryset.readable_per_se(user)
            .order_by("path")
            .values_list("path", flat=True)
        )

        attachments_documents = (
            self.queryset.select_related(None)
            .filter(attachments__contains=[key])
            .only("path")
            .order_by("path")
        )
        readable_attachments_paths = filter_descendants(
            [doc.path for doc in attachments_documents],
            readable_per_se_paths,
            skip_sorting=True,
        )

        if not readable_attachments_paths:
            logger.debug("User '%s' lacks permission for attachment", user)
            raise drf.exceptions.PermissionDenied()

        # Check if the attachment is ready
        s3_client = default_storage.connection.meta.client
        bucket_name = default_storage.bucket_name
        try:
            head_resp = s3_client.head_object(Bucket=bucket_name, Key=key)
        except ClientError as err:
            raise drf.exceptions.PermissionDenied() from err
        metadata = head_resp.get("Metadata", {})
        # In order to be compatible with existing upload without `status` metadata,
        # we consider them as ready.
        if (
            metadata.get("status", enums.DocumentAttachmentStatus.READY)
            != enums.DocumentAttachmentStatus.READY
        ):
            raise drf.exceptions.PermissionDenied()

        # Generate S3 authorization headers using the extracted URL parameters
        request = utils.generate_s3_authorization_headers(key)

        return drf.response.Response("authorized", headers=request.headers, status=200)

    @drf.decorators.action(detail=True, methods=["get"], url_path="media-check")
    def media_check(self, request, *args, **kwargs):
        """
        Check if the media is ready to be served.
        """
        document = self.get_object()

        key = request.query_params.get("key")
        if not key:
            return drf.response.Response(
                {"detail": "Missing 'key' query parameter"},
                status=drf.status.HTTP_400_BAD_REQUEST,
            )

        if key not in document.attachments:
            return drf.response.Response(
                {"detail": "Attachment missing"},
                status=drf.status.HTTP_404_NOT_FOUND,
            )

        # Check if the attachment is ready
        s3_client = default_storage.connection.meta.client
        bucket_name = default_storage.bucket_name
        try:
            head_resp = s3_client.head_object(Bucket=bucket_name, Key=key)
        except ClientError as err:
            logger.error("Client Error fetching file %s metadata: %s", key, err)
            return drf.response.Response(
                {"detail": "Media not found"},
                status=drf.status.HTTP_404_NOT_FOUND,
            )
        metadata = head_resp.get("Metadata", {})

        body = {
            "status": metadata.get("status", enums.DocumentAttachmentStatus.PROCESSING),
        }
        if metadata.get("status") == enums.DocumentAttachmentStatus.READY:
            body = {
                "status": enums.DocumentAttachmentStatus.READY,
                "file": f"{settings.MEDIA_URL:s}{key:s}",
            }

        return drf.response.Response(body, status=drf.status.HTTP_200_OK)

    @drf.decorators.action(
        detail=True,
        methods=["post"],
        name="Proxy AI requests to the AI provider",
        url_path="ai-proxy",
        throttle_classes=[utils.AIDocumentRateThrottle, utils.AIUserRateThrottle],
    )
    def ai_proxy(self, request, *args, **kwargs):
        """
        POST /api/v1.0/documents/<resource_id>/ai-proxy
        Proxy AI requests to the configured AI provider.
        This endpoint forwards requests to the AI provider and returns the complete response.
        """
        # Check permissions first
        self.get_object()

        if not settings.AI_FEATURE_ENABLED or not settings.AI_FEATURE_BLOCKNOTE_ENABLED:
            raise ValidationError("AI feature is not enabled.")

        ai_service = AIService()

        try:
            stream = ai_service.stream(request)
        except PydanticValidationError as err:
            logger.info("pydantic validation error: %s", err)
            return drf.response.Response(
                {"detail": "Invalid submitted payload"},
                status=drf.status.HTTP_400_BAD_REQUEST,
            )

        return StreamingHttpResponse(
            stream,
            content_type="text/event-stream",
            headers={
                "x-vercel-ai-data-stream": "v1",  # This header is used for Vercel AI streaming,
                "X-Accel-Buffering": "no",  # Prevent nginx buffering
            },
        )

    @drf.decorators.action(
        detail=True,
        methods=["post"],
        name="Apply a transformation action on a piece of text with AI",
        url_path="ai-transform",
        throttle_classes=[utils.AIDocumentRateThrottle, utils.AIUserRateThrottle],
    )
    def ai_transform(self, request, *args, **kwargs):
        """
        POST /api/v1.0/documents/<resource_id>/ai-transform
        with expected data:
        - text: str
        - action: str [prompt, correct, rephrase, summarize]
        Return JSON response with the processed text.
        """
        # Check permissions first
        self.get_object()

        serializer = serializers.AITransformSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        text = serializer.validated_data["text"]
        action = serializer.validated_data["action"]

        response = AIService().transform(text, action)

        return drf.response.Response(response, status=drf.status.HTTP_200_OK)

    @drf.decorators.action(
        detail=True,
        methods=["post"],
        name="Translate a piece of text with AI",
        url_path="ai-translate",
        throttle_classes=[utils.AIDocumentRateThrottle, utils.AIUserRateThrottle],
    )
    def ai_translate(self, request, *args, **kwargs):
        """
        POST /api/v1.0/documents/<resource_id>/ai-translate
        with expected data:
        - text: str
        - language: str [settings.LANGUAGES]
        Return JSON response with the translated text.
        """
        # Check permissions first
        self.get_object()

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        text = serializer.validated_data["text"]
        language = serializer.validated_data["language"]

        response = AIService().translate(text, language)

        return drf.response.Response(response, status=drf.status.HTTP_200_OK)

    def _reject_invalid_ips(self, ips):
        """
        Check if an IP address is safe from SSRF attacks.

        Raises:
            drf.exceptions.ValidationError: If the IP is unsafe
        """
        for ip in ips:
            # Block loopback addresses (check before private,
            # as 127.0.0.1 might be considered private)
            if ip.is_loopback:
                raise drf.exceptions.ValidationError(
                    "Access to loopback addresses is not allowed"
                )

            # Block link-local addresses (169.254.0.0/16) - check before private
            if ip.is_link_local:
                raise drf.exceptions.ValidationError(
                    "Access to link-local addresses is not allowed"
                )

            # Block private IP ranges
            if ip.is_private:
                raise drf.exceptions.ValidationError(
                    "Access to private IP addresses is not allowed"
                )

            # Block multicast addresses
            if ip.is_multicast:
                raise drf.exceptions.ValidationError(
                    "Access to multicast addresses is not allowed"
                )

            # Block reserved addresses (including 0.0.0.0)
            if ip.is_reserved:
                raise drf.exceptions.ValidationError(
                    "Access to reserved IP addresses is not allowed"
                )

    def _validate_url_against_ssrf(self, url):
        """
        Validate that a URL is safe from SSRF (Server-Side Request Forgery) attacks.

        Blocks:
        - localhost and its variations
        - Private IP ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
        - Link-local addresses (169.254.0.0/16)
        - Loopback addresses

        Raises:
            drf.exceptions.ValidationError: If the URL is unsafe
        """
        parsed = urlparse(url)
        hostname = parsed.hostname

        if not hostname:
            raise drf.exceptions.ValidationError("Invalid hostname")

        # Resolve hostname to IP address(es)
        # Check all resolved IPs to prevent DNS rebinding attacks
        try:
            # Try to parse as IP address first (if hostname is already an IP)
            try:
                ip = ipaddress.ip_address(hostname)
                resolved_ips = [ip]
            except ValueError:
                # Resolve hostname to IP addresses (supports both IPv4 and IPv6)
                resolved_ips = []
                try:
                    # Get all address info (IPv4 and IPv6)
                    addr_info = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC)
                    for family, _, _, _, sockaddr in addr_info:
                        if family == socket.AF_INET:
                            # IPv4
                            ip = ipaddress.ip_address(sockaddr[0])
                            resolved_ips.append(ip)
                        elif family == socket.AF_INET6:
                            # IPv6
                            ip = ipaddress.ip_address(sockaddr[0])
                            resolved_ips.append(ip)
                except (socket.gaierror, OSError) as e:
                    raise drf.exceptions.ValidationError(
                        f"Failed to resolve hostname: {str(e)}"
                    ) from e

                if not resolved_ips:
                    raise drf.exceptions.ValidationError(
                        "No IP addresses found for hostname"
                    ) from None
        except ValueError as e:
            raise drf.exceptions.ValidationError(f"Invalid IP address: {str(e)}") from e

        # Check all resolved IPs to ensure none are private/internal
        self._reject_invalid_ips(resolved_ips)

    @drf.decorators.action(
        detail=True,
        methods=["get"],
        name="",
        url_path="cors-proxy",
    )
    @csp_update({"img-src": [NONE, "data:"]})
    def cors_proxy(self, request, *args, **kwargs):
        """
        GET /api/v1.0/documents/<resource_id>/cors-proxy
        Act like a proxy to fetch external resources and bypass CORS restrictions.
        """
        url = request.query_params.get("url")
        if not url:
            return drf.response.Response(
                {"detail": "Missing 'url' query parameter"},
                status=drf.status.HTTP_400_BAD_REQUEST,
            )

        # Check for permissions.
        self.get_object()

        url = unquote(url)

        url_validator = URLValidator(schemes=["http", "https"])
        try:
            url_validator(url)
        except drf.exceptions.ValidationError as e:
            return drf.response.Response(
                {"detail": str(e)},
                status=drf.status.HTTP_400_BAD_REQUEST,
            )

        # Validate URL against SSRF attacks
        try:
            self._validate_url_against_ssrf(url)
        except drf.exceptions.ValidationError as e:
            logger.error("Potential SSRF attack detected: %s", e)
            return drf.response.Response(
                {"detail": "Invalid URL used."},
                status=drf.status.HTTP_400_BAD_REQUEST,
            )

        try:
            response = requests.get(
                url,
                stream=True,
                headers={
                    "User-Agent": request.headers.get("User-Agent", ""),
                    "Accept": request.headers.get("Accept", ""),
                },
                allow_redirects=False,
                timeout=10,
            )
            response.raise_for_status()
            content_type = response.headers.get("Content-Type", "")

            if not content_type.startswith("image/"):
                return drf.response.Response(
                    {"detail": "Invalid URL used."}, status=status.HTTP_400_BAD_REQUEST
                )

            # Use StreamingHttpResponse with the response's iter_content to properly stream the data
            proxy_response = StreamingHttpResponse(
                streaming_content=response.iter_content(chunk_size=8192),
                content_type=content_type,
                headers={
                    "Content-Disposition": "attachment;",
                },
                status=response.status_code,
            )

            return proxy_response

        except requests.RequestException as e:
            logger.exception(e)
            return drf.response.Response(
                {"detail": "Invalid URL used."},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @drf.decorators.action(
        detail=True,
        methods=["get"],
        url_path="content",
        name="Get document content in different formats",
    )
    def content(self, request, pk=None):
        """
        Retrieve document content in different formats (JSON, Markdown, HTML).

        Query parameters:
        - content_format: The desired output format (json, markdown, html)

        Returns:
            JSON response with content in the specified format.
        """

        document = self.get_object()

        content_format = request.query_params.get("content_format", "json").lower()
        if content_format not in {"json", "markdown", "html"}:
            raise drf.exceptions.ValidationError(
                "Invalid format. Must be one of: json, markdown, html"
            )

        # Get the base64 content from the document
        content = None
        base64_content = document.content
        if base64_content is not None:
            # Convert using the y-provider service
            try:
                yprovider = Converter()
                result = yprovider.convert(
                    base64.b64decode(base64_content),
                    mime_types.YJS,
                    {
                        "markdown": mime_types.MARKDOWN,
                        "html": mime_types.HTML,
                        "json": mime_types.JSON,
                    }[content_format],
                )
                content = result
            except YProviderValidationError as e:
                return drf_response.Response(
                    {"error": str(e)}, status=status.HTTP_400_BAD_REQUEST
                )
            except YProviderServiceUnavailableError as e:
                logger.error("Error getting content for document %s: %s", pk, e)
                return drf_response.Response(
                    {"error": "Failed to get document content"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

        return drf_response.Response(
            {
                "id": str(document.id),
                "title": document.title,
                "content": content,
                "created_at": document.created_at,
                "updated_at": document.updated_at,
            }
        )


class DocumentAccessViewSet(
    ResourceAccessViewsetMixin,
    drf.mixins.CreateModelMixin,
    drf.mixins.RetrieveModelMixin,
    drf.mixins.UpdateModelMixin,
    drf.mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """
    API ViewSet for all interactions with document accesses.

    GET /api/v1.0/documents/<resource_id>/accesses/:<document_access_id>
        Return list of all document accesses related to the logged-in user or one
        document access if an id is provided.

    POST /api/v1.0/documents/<resource_id>/accesses/ with expected data:
        - user: str
        - role: str [administrator|editor|reader]
        Return newly created document access

    PUT /api/v1.0/documents/<resource_id>/accesses/<document_access_id>/ with expected data:
        - role: str [owner|admin|editor|reader]
        Return updated document access

    PATCH /api/v1.0/documents/<resource_id>/accesses/<document_access_id>/ with expected data:
        - role: str [owner|admin|editor|reader]
        Return partially updated document access

    DELETE /api/v1.0/documents/<resource_id>/accesses/<document_access_id>/
        Delete targeted document access
    """

    lookup_field = "pk"
    permission_classes = [permissions.ResourceAccessPermission]
    queryset = models.DocumentAccess.objects.select_related("user", "document").only(
        "id",
        "created_at",
        "role",
        "team",
        "user__id",
        "user__short_name",
        "user__full_name",
        "user__email",
        "user__language",
        "document__id",
        "document__path",
        "document__depth",
    )
    resource_field_name = "document"
    throttle_scope = "document_access"

    @cached_property
    def document(self):
        """Get related document from resource ID in url and annotate user roles."""
        try:
            return models.Document.objects.annotate_user_roles(self.request.user).get(
                pk=self.kwargs["resource_id"]
            )
        except models.Document.DoesNotExist as excpt:
            raise drf.exceptions.NotFound() from excpt

    def get_serializer_class(self):
        """Use light serializer for unprivileged users."""
        return (
            serializers.DocumentAccessSerializer
            if self.document.get_role(self.request.user) in choices.PRIVILEGED_ROLES
            else serializers.DocumentAccessLightSerializer
        )

    def list(self, request, *args, **kwargs):
        """Return accesses for the current document with filters and annotations."""
        user = request.user

        role = self.document.get_role(user)
        if not role:
            return drf.response.Response([])

        ancestors = (
            self.document.get_ancestors()
            | models.Document.objects.filter(pk=self.document.pk)
        ).filter(ancestors_deleted_at__isnull=True)

        queryset = self.get_queryset().filter(document__in=ancestors)

        if role not in choices.PRIVILEGED_ROLES:
            queryset = queryset.filter(role__in=choices.PRIVILEGED_ROLES)

        accesses = list(queryset.order_by("document__path"))

        # Annotate more information on roles
        path_to_key_to_max_ancestors_role = defaultdict(
            lambda: defaultdict(lambda: None)
        )
        path_to_ancestors_roles = defaultdict(list)
        path_to_role = defaultdict(lambda: None)
        for access in accesses:
            key = access.target_key
            path = access.document.path
            parent_path = path[: -models.Document.steplen]

            path_to_key_to_max_ancestors_role[path][key] = choices.RoleChoices.max(
                path_to_key_to_max_ancestors_role[path][key], access.role
            )

            if parent_path:
                path_to_key_to_max_ancestors_role[path][key] = choices.RoleChoices.max(
                    path_to_key_to_max_ancestors_role[parent_path][key],
                    path_to_key_to_max_ancestors_role[path][key],
                )
                path_to_ancestors_roles[path].extend(
                    path_to_ancestors_roles[parent_path]
                )
                path_to_ancestors_roles[path].append(path_to_role[parent_path])
            else:
                path_to_ancestors_roles[path] = []

            if access.user_id == user.id or access.team in user.teams:
                path_to_role[path] = choices.RoleChoices.max(
                    path_to_role[path], access.role
                )

        # serialize and return the response
        context = self.get_serializer_context()
        serializer_class = self.get_serializer_class()
        serialized_data = []
        for access in accesses:
            path = access.document.path
            parent_path = path[: -models.Document.steplen]
            access.max_ancestors_role = (
                path_to_key_to_max_ancestors_role[parent_path][access.target_key]
                if parent_path
                else None
            )
            access.set_user_roles_tuple(
                choices.RoleChoices.max(*path_to_ancestors_roles[path]),
                path_to_role.get(path),
            )
            serializer = serializer_class(access, context=context)
            serialized_data.append(serializer.data)

        return drf.response.Response(serialized_data)

    def perform_create(self, serializer):
        """
        Actually create the new document access:
        - Ensures the `document_id` is explicitly set from the URL
        - If the assigned role is `OWNER`, checks that the requesting user is an owner
          of the document. This is the only permission check deferred until this step;
          all other access checks are handled earlier in the permission lifecycle.
        - Sends an invitation email to the newly added user after saving the access.
        """
        role = serializer.validated_data.get("role")
        if (
            role == choices.RoleChoices.OWNER
            and self.document.get_role(self.request.user) != choices.RoleChoices.OWNER
        ):
            raise drf.exceptions.PermissionDenied(
                "Only owners of a document can assign other users as owners."
            )

        access = serializer.save(document_id=self.kwargs["resource_id"])

        if access.user:
            access.document.send_invitation_email(
                access.user.email,
                access.role,
                self.request.user,
                access.user.language
                or self.request.user.language
                or settings.LANGUAGE_CODE,
            )

    def perform_update(self, serializer):
        """Update an access to the document and notify the collaboration server."""
        access = serializer.save()

        access_user_id = None
        if access.user:
            access_user_id = str(access.user.id)

        # Notify collaboration server about the access change
        CollaborationService().reset_connections(
            str(access.document.id), access_user_id
        )

    def perform_destroy(self, instance):
        """Delete an access to the document and notify the collaboration server."""
        instance.delete()

        # Notify collaboration server about the access removed
        CollaborationService().reset_connections(
            str(instance.document.id), str(instance.user.id)
        )


class InvitationViewset(
    drf.mixins.CreateModelMixin,
    drf.mixins.ListModelMixin,
    drf.mixins.RetrieveModelMixin,
    drf.mixins.DestroyModelMixin,
    drf.mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """API ViewSet for user invitations to document.

    GET /api/v1.0/documents/<document_id>/invitations/:<invitation_id>/
        Return list of invitations related to that document or one
        document access if an id is provided.

    POST /api/v1.0/documents/<document_id>/invitations/ with expected data:
        - email: str
        - role: str [administrator|editor|reader]
        Return newly created invitation (issuer and document are automatically set)

    PATCH /api/v1.0/documents/<document_id>/invitations/:<invitation_id>/ with expected data:
        - role: str [owner|admin|editor|reader]
        Return partially updated document invitation

    DELETE  /api/v1.0/documents/<document_id>/invitations/<invitation_id>/
        Delete targeted invitation
    """

    lookup_field = "id"
    pagination_class = Pagination
    permission_classes = [
        permissions.CanCreateInvitationPermission,
        permissions.ResourceWithAccessPermission,
    ]
    throttle_scope = "invitation"
    queryset = (
        models.Invitation.objects.all()
        .select_related("document")
        .order_by("-created_at")
    )
    serializer_class = serializers.InvitationSerializer

    def get_serializer_context(self):
        """Extra context provided to the serializer class."""
        context = super().get_serializer_context()
        context["resource_id"] = self.kwargs["resource_id"]
        return context

    def get_queryset(self):
        """Return the queryset according to the action."""
        queryset = super().get_queryset()
        queryset = queryset.filter(document=self.kwargs["resource_id"])

        if self.action == "list":
            user = self.request.user
            teams = user.teams

            # Determine which role the logged-in user has in the document
            user_roles_query = (
                models.DocumentAccess.objects.filter(
                    db.Q(user=user) | db.Q(team__in=teams),
                    document=self.kwargs["resource_id"],
                )
                .values("document")
                .annotate(roles_array=ArrayAgg("role"))
                .values("roles_array")
            )

            queryset = (
                # The logged-in user should be administrator or owner to see its accesses
                queryset.filter(
                    db.Q(
                        document__accesses__user=user,
                        document__accesses__role__in=choices.PRIVILEGED_ROLES,
                    )
                    | db.Q(
                        document__accesses__team__in=teams,
                        document__accesses__role__in=choices.PRIVILEGED_ROLES,
                    ),
                )
                # Abilities are computed based on logged-in user's role and
                # the user role on each document access
                .annotate(user_roles=db.Subquery(user_roles_query))
                .distinct()
            )
        return queryset

    def perform_create(self, serializer):
        """Save invitation to a document then send an email to the invited user."""
        invitation = serializer.save()

        invitation.document.send_invitation_email(
            invitation.email,
            invitation.role,
            self.request.user,
            self.request.user.language or settings.LANGUAGE_CODE,
        )


class DocumentAskForAccessViewSet(
    drf.mixins.ListModelMixin,
    drf.mixins.RetrieveModelMixin,
    drf.mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """API ViewSet for asking for access to a document."""

    lookup_field = "id"
    pagination_class = Pagination
    permission_classes = [
        permissions.IsAuthenticated,
        permissions.ResourceWithAccessPermission,
    ]
    throttle_scope = "document_ask_for_access"
    queryset = models.DocumentAskForAccess.objects.all()
    serializer_class = serializers.DocumentAskForAccessSerializer
    _document = None

    def get_document_or_404(self):
        """Get the document related to the viewset or raise a 404 error."""
        if self._document is None:
            try:
                self._document = models.Document.objects.get(
                    pk=self.kwargs["resource_id"],
                    depth=1,
                )
            except models.Document.DoesNotExist as e:
                raise drf.exceptions.NotFound("Document not found.") from e
        return self._document

    def get_queryset(self):
        """Return the queryset according to the action."""
        document = self.get_document_or_404()

        queryset = super().get_queryset()
        queryset = queryset.filter(document=document)

        is_owner_or_admin = (
            document.get_role(self.request.user) in models.PRIVILEGED_ROLES
        )
        if not is_owner_or_admin:
            queryset = queryset.filter(user=self.request.user)

        return queryset

    def create(self, request, *args, **kwargs):
        """Create a document ask for access resource."""
        document = self.get_document_or_404()

        serializer = serializers.DocumentAskForAccessCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        queryset = self.get_queryset()

        if queryset.filter(user=request.user).exists():
            return drf.response.Response(
                {"detail": "You already ask to access to this document."},
                status=drf.status.HTTP_400_BAD_REQUEST,
            )

        ask_for_access = models.DocumentAskForAccess.objects.create(
            document=document,
            user=request.user,
            role=serializer.validated_data["role"],
        )

        send_ask_for_access_mail.delay(ask_for_access.id)

        return drf.response.Response(status=drf.status.HTTP_201_CREATED)

    @drf.decorators.action(detail=True, methods=["post"])
    def accept(self, request, *args, **kwargs):
        """Accept a document ask for access resource."""
        document_ask_for_access = self.get_object()

        serializer = serializers.RoleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        target_role = serializer.validated_data.get(
            "role", document_ask_for_access.role
        )
        abilities = document_ask_for_access.get_abilities(request.user)

        if target_role not in abilities["set_role_to"]:
            return drf.response.Response(
                {"detail": "You cannot accept a role higher than your own."},
                status=drf.status.HTTP_400_BAD_REQUEST,
            )

        document_ask_for_access.accept(role=target_role)
        return drf.response.Response(status=drf.status.HTTP_204_NO_CONTENT)


class ConfigView(drf.views.APIView):
    """API ViewSet for sharing some public settings."""

    permission_classes = [AllowAny]
    throttle_scope = "config"

    def get(self, request):
        """
        GET /api/v1.0/config/
            Return a dictionary of public settings.
        """
        array_settings = [
            "AI_BOT",
            "AI_FEATURE_ENABLED",
            "AI_FEATURE_BLOCKNOTE_ENABLED",
            "AI_FEATURE_LEGACY_ENABLED",
            "API_USERS_SEARCH_QUERY_MIN_LENGTH",
            "COLLABORATION_WS_URL",
            "COLLABORATION_WS_NOT_CONNECTED_READY_ONLY",
            "CONVERSION_FILE_EXTENSIONS_ALLOWED",
            "CONVERSION_FILE_MAX_SIZE",
            "CRISP_WEBSITE_ID",
            "ENVIRONMENT",
            "FRONTEND_CSS_URL",
            "FRONTEND_HOMEPAGE_FEATURE_ENABLED",
            "FRONTEND_JS_URL",
            "FRONTEND_SILENT_LOGIN_ENABLED",
            "FRONTEND_THEME",
            "MEDIA_BASE_URL",
            "POSTHOG_KEY",
            "LANGUAGES",
            "LANGUAGE_CODE",
            "SENTRY_DSN",
            "TRASHBIN_CUTOFF_DAYS",
        ]
        dict_settings = {}
        for setting in array_settings:
            if hasattr(settings, setting):
                dict_settings[setting] = getattr(settings, setting)

        dict_settings["theme_customization"] = self._load_theme_customization()

        return drf.response.Response(dict_settings)

    def _load_theme_customization(self):
        if not settings.THEME_CUSTOMIZATION_FILE_PATH:
            return {}

        cache_key = (
            f"theme_customization_{slugify(settings.THEME_CUSTOMIZATION_FILE_PATH)}"
        )
        theme_customization = cache.get(cache_key, {})
        if theme_customization:
            return theme_customization

        try:
            with open(
                settings.THEME_CUSTOMIZATION_FILE_PATH, "r", encoding="utf-8"
            ) as f:
                theme_customization = json.load(f)
        except FileNotFoundError:
            logger.error(
                "Configuration file not found: %s",
                settings.THEME_CUSTOMIZATION_FILE_PATH,
            )
        except json.JSONDecodeError:
            logger.error(
                "Configuration file is not a valid JSON: %s",
                settings.THEME_CUSTOMIZATION_FILE_PATH,
            )
        else:
            cache.set(
                cache_key,
                theme_customization,
                settings.THEME_CUSTOMIZATION_CACHE_TIMEOUT,
            )

        return theme_customization


class CommentViewSetMixin:
    """Comment ViewSet Mixin."""

    _document = None

    def get_document_or_404(self):
        """Get the document related to the viewset or raise a 404 error."""
        if self._document is None:
            try:
                self._document = models.Document.objects.get(
                    pk=self.kwargs["resource_id"],
                )
            except models.Document.DoesNotExist as e:
                raise drf.exceptions.NotFound("Document not found.") from e
        return self._document


class ThreadViewSet(
    ResourceAccessViewsetMixin,
    CommentViewSetMixin,
    drf.mixins.CreateModelMixin,
    drf.mixins.ListModelMixin,
    drf.mixins.RetrieveModelMixin,
    drf.mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Thread API: list/create threads and nested comment operations."""

    permission_classes = [permissions.CommentPermission]
    pagination_class = Pagination
    serializer_class = serializers.ThreadSerializer
    queryset = models.Thread.objects.select_related("creator", "document").filter(
        resolved=False
    )
    resource_field_name = "document"

    def perform_create(self, serializer):
        """Create the first comment of the thread."""
        body = serializer.validated_data["body"]
        del serializer.validated_data["body"]
        thread = serializer.save()

        models.Comment.objects.create(
            thread=thread,
            user=self.request.user if self.request.user.is_authenticated else None,
            body=body,
        )

    @drf.decorators.action(detail=True, methods=["post"], url_path="resolve")
    def resolve(self, request, *args, **kwargs):
        """Resolve a thread."""
        thread = self.get_object()
        if not thread.resolved:
            thread.resolved = True
            thread.resolved_at = timezone.now()
            thread.resolved_by = request.user
            thread.save(update_fields=["resolved", "resolved_at", "resolved_by"])
        return drf.response.Response(status=status.HTTP_204_NO_CONTENT)


class CommentViewSet(
    CommentViewSetMixin,
    viewsets.ModelViewSet,
):
    """Comment API: list/create comments and nested reaction operations."""

    permission_classes = [permissions.CommentPermission]
    pagination_class = Pagination
    serializer_class = serializers.CommentSerializer
    queryset = models.Comment.objects.select_related("user").all()

    def get_queryset(self):
        """Override to filter on related resource."""
        return (
            super()
            .get_queryset()
            .filter(
                thread=self.kwargs["thread_id"],
                thread__document=self.kwargs["resource_id"],
            )
        )

    def get_serializer_context(self):
        """Extra context provided to the serializer class."""
        context = super().get_serializer_context()
        context["document_id"] = self.kwargs["resource_id"]
        context["thread_id"] = self.kwargs["thread_id"]
        return context

    @drf.decorators.action(
        detail=True,
        methods=["post", "delete"],
    )
    def reactions(self, request, *args, **kwargs):
        """POST: add reaction; DELETE: remove reaction.

        Emoji is expected in request.data['emoji'] for both operations.
        """
        comment = self.get_object()
        serializer = serializers.ReactionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        if request.method == "POST":
            reaction, created = models.Reaction.objects.get_or_create(
                comment=comment,
                emoji=serializer.validated_data["emoji"],
            )
            if not created and reaction.users.filter(id=request.user.id).exists():
                return drf.response.Response(
                    {"user_already_reacted": True}, status=status.HTTP_400_BAD_REQUEST
                )
            reaction.users.add(request.user)
            return drf.response.Response(status=status.HTTP_201_CREATED)

        # DELETE
        try:
            reaction = models.Reaction.objects.get(
                comment=comment,
                emoji=serializer.validated_data["emoji"],
                users__in=[request.user],
            )
        except models.Reaction.DoesNotExist as e:
            raise drf.exceptions.NotFound("Reaction not found.") from e
        reaction.users.remove(request.user)
        if not reaction.users.exists():
            reaction.delete()
        return drf.response.Response(status=status.HTTP_204_NO_CONTENT)
