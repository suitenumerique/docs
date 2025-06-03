"""API endpoints"""
# pylint: disable=too-many-lines

import json
import logging
import uuid
from collections import defaultdict
from urllib.parse import unquote, urlencode, urlparse

from django.conf import settings
from django.contrib.postgres.aggregates import ArrayAgg
from django.contrib.postgres.search import TrigramSimilarity
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.files.storage import default_storage
from django.db import connection, transaction
from django.db import models as db
from django.db.models.expressions import RawSQL
from django.db.models.functions import Left, Length
from django.http import Http404, StreamingHttpResponse
from django.shortcuts import redirect
from django.utils.functional import cached_property
from django.utils.text import capfirst, slugify
from django.utils.translation import gettext_lazy as _

import requests
import rest_framework as drf
from botocore.exceptions import ClientError
from lasuite.malware_detection import malware_detection
from rest_framework import filters, status, viewsets
from rest_framework import response as drf_response
from rest_framework.permissions import AllowAny
from rest_framework.throttling import UserRateThrottle

from core import authentication, choices, enums, models
from core.services.ai_services import AIService
from core.services.collaboration_services import CollaborationService
from core.services.converter_services import YdocConverter
from core.services.notion_import import import_notion
from core.utils import extract_attachments, filter_descendants

from . import permissions, serializers, utils
from .filters import DocumentFilter, ListDocumentFilter

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


class UserListThrottleBurst(UserRateThrottle):
    """Throttle for the user list endpoint."""

    scope = "user_list_burst"


class UserListThrottleSustained(UserRateThrottle):
    """Throttle for the user list endpoint."""

    scope = "user_list_sustained"


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

        # Exclude all users already in the given document
        if document_id := self.request.query_params.get("document_id", ""):
            queryset = queryset.exclude(documentaccess__document_id=document_id)

        if not (query := self.request.query_params.get("q", "")) or len(query) < 5:
            return queryset.none()

        # For emails, match emails by Levenstein distance to prevent typing errors
        if "@" in query:
            return (
                queryset.annotate(
                    distance=RawSQL("levenshtein(email::text, %s::text)", (query,))
                )
                .filter(distance__lte=3)
                .order_by("distance", "email")[: settings.API_USERS_LIST_LIMIT]
            )

        # Use trigram similarity for non-email-like queries
        # For performance reasons we filter first by similarity, which relies on an
        # index, then only calculate precise similarity scores for sorting purposes
        return (
            queryset.filter(email__trigram_word_similar=query)
            .annotate(similarity=TrigramSimilarity("email", query))
            .filter(similarity__gt=0.2)
            .order_by("-similarity", "email")[: settings.API_USERS_LIST_LIMIT]
        )

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

    ### Ordering: created_at, updated_at, is_favorite, title

        Example:
        - Ascending: GET /api/v1.0/documents/?ordering=created_at
        - Desceding: GET /api/v1.0/documents/?ordering=-title

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
    queryset = models.Document.objects.all()
    serializer_class = serializers.DocumentSerializer
    ai_translate_serializer_class = serializers.AITranslateSerializer
    children_serializer_class = serializers.ListDocumentSerializer
    descendants_serializer_class = serializers.ListDocumentSerializer
    list_serializer_class = serializers.ListDocumentSerializer
    trashbin_serializer_class = serializers.ListDocumentSerializer
    tree_serializer_class = serializers.ListDocumentSerializer

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
        queryset = filterset.filters["is_favorite"].filter(
            queryset, filter_data["is_favorite"]
        )

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

    @drf.decorators.action(
        detail=False,
        methods=["get"],
        permission_classes=[permissions.IsAuthenticated],
    )
    def favorite_list(self, request, *args, **kwargs):
        """Get list of favorite documents for the current user."""
        user = request.user

        favorite_documents_ids = models.DocumentFavorite.objects.filter(
            user=user
        ).values_list("document_id", flat=True)

        queryset = self.filter_queryset(self.get_queryset())
        queryset = queryset.filter(id__in=favorite_documents_ids)
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
        queryset = self.queryset.filter(
            deleted_at__isnull=False,
            deleted_at__gte=models.get_trashbin_cutoff(),
        )
        queryset = queryset.annotate_user_roles(self.request.user)
        queryset = queryset.filter(user_roles__contains=[models.RoleChoices.OWNER])

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
        queryset = document.get_children().filter(ancestors_deleted_at__isnull=True)
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
            current_document = self.queryset.only("depth", "path").get(pk=pk)
        except models.Document.DoesNotExist as excpt:
            raise drf.exceptions.NotFound() from excpt

        ancestors = (
            (current_document.get_ancestors() | self.queryset.filter(pk=pk))
            .filter(ancestors_deleted_at__isnull=True)
            .order_by("path")
        )

        # Get the highest readable ancestor
        highest_readable = (
            ancestors.readable_per_se(request.user).only("depth", "path").first()
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

        queryset = ancestors.filter(depth__gte=highest_readable.depth) | children
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
        Duplicate a document and store the links to attached files in the duplicated
        document to allow cross-access.

        Optionally duplicates accesses if `with_accesses` is set to true
        in the payload.
        """
        # Get document while checking permissions
        document = self.get_object()

        serializer = serializers.DocumentDuplicationSerializer(
            data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        with_accesses = serializer.validated_data.get("with_accesses", False)

        base64_yjs_content = document.content

        # Duplicate the document instance
        link_kwargs = (
            {"link_reach": document.link_reach, "link_role": document.link_role}
            if with_accesses
            else {}
        )
        extracted_attachments = set(extract_attachments(document.content))
        attachments = list(extracted_attachments & set(document.attachments))
        duplicated_document = document.add_sibling(
            "right",
            title=capfirst(_("copy of {title}").format(title=document.title)),
            content=base64_yjs_content,
            attachments=attachments,
            duplicated_from=document,
            creator=request.user,
            **link_kwargs,
        )

        # Always add the logged-in user as OWNER
        accesses_to_create = [
            models.DocumentAccess(
                document=duplicated_document,
                user=request.user,
                role=models.RoleChoices.OWNER,
            )
        ]

        # If accesses should be duplicated, add other users' accesses as per original document
        if with_accesses:
            original_accesses = models.DocumentAccess.objects.filter(
                document=document
            ).exclude(user=request.user)

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

        return drf_response.Response(
            {"id": str(duplicated_document.id)}, status=status.HTTP_201_CREATED
        )

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
        url_path="versions/(?P<version_id>[0-9a-z-]+)",
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
            return drf.response.Response(
                {"detail": "Document unmarked as favorite"},
                status=drf.status.HTTP_204_NO_CONTENT,
            )
        return drf.response.Response(
            {"detail": "Document was already not marked as favorite"},
            status=drf.status.HTTP_200_OK,
        )

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

        return drf.response.Response(
            {"file": f"{settings.MEDIA_URL:s}{key:s}"},
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
            self.queryset.filter(attachments__contains=[key])
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
        head_resp = s3_client.head_object(Bucket=bucket_name, Key=key)
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

    @drf.decorators.action(
        detail=True,
        methods=["get"],
        name="",
        url_path="cors-proxy",
    )
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

        try:
            response = requests.get(
                url,
                stream=True,
                headers={
                    "User-Agent": request.headers.get("User-Agent", ""),
                    "Accept": request.headers.get("Accept", ""),
                },
                timeout=10,
            )
            content_type = response.headers.get("Content-Type", "")

            if not content_type.startswith("image/"):
                return drf.response.Response(
                    status=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE
                )

            # Use StreamingHttpResponse with the response's iter_content to properly stream the data
            proxy_response = StreamingHttpResponse(
                streaming_content=response.iter_content(chunk_size=8192),
                content_type=content_type,
                headers={
                    "Content-Disposition": "attachment;",
                    "Content-Security-Policy": "default-src 'none'; img-src 'none' data:;",
                },
                status=response.status_code,
            )

            return proxy_response

        except requests.RequestException as e:
            logger.error("Proxy request failed: %s", str(e))
            return drf_response.Response(
                {"error": f"Failed to fetch resource: {e!s}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
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


class TemplateViewSet(
    drf.mixins.CreateModelMixin,
    drf.mixins.DestroyModelMixin,
    drf.mixins.RetrieveModelMixin,
    drf.mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """Template ViewSet"""

    filter_backends = [drf.filters.OrderingFilter]
    permission_classes = [
        permissions.IsAuthenticatedOrSafe,
        permissions.ResourceWithAccessPermission,
    ]
    ordering = ["-created_at"]
    ordering_fields = ["created_at", "updated_at", "title"]
    serializer_class = serializers.TemplateSerializer
    queryset = models.Template.objects.all()

    def get_queryset(self):
        """Custom queryset to get user related templates."""
        queryset = super().get_queryset()
        user = self.request.user

        if not user.is_authenticated:
            return queryset

        user_roles_query = (
            models.TemplateAccess.objects.filter(
                db.Q(user=user) | db.Q(team__in=user.teams),
                template_id=db.OuterRef("pk"),
            )
            .values("template")
            .annotate(roles_array=ArrayAgg("role"))
            .values("roles_array")
        )
        return queryset.annotate(user_roles=db.Subquery(user_roles_query)).distinct()

    def list(self, request, *args, **kwargs):
        """Restrict templates returned by the list endpoint"""
        queryset = self.filter_queryset(self.get_queryset())
        user = self.request.user
        if user.is_authenticated:
            queryset = queryset.filter(
                db.Q(accesses__user=user)
                | db.Q(accesses__team__in=user.teams)
                | db.Q(is_public=True)
            )
        else:
            queryset = queryset.filter(is_public=True)

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return drf.response.Response(serializer.data)

    @transaction.atomic
    def perform_create(self, serializer):
        """Set the current user as owner of the newly created object."""
        obj = serializer.save()
        models.TemplateAccess.objects.create(
            template=obj,
            user=self.request.user,
            role=models.RoleChoices.OWNER,
        )


class TemplateAccessViewSet(
    ResourceAccessViewsetMixin,
    drf.mixins.CreateModelMixin,
    drf.mixins.DestroyModelMixin,
    drf.mixins.RetrieveModelMixin,
    drf.mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """
    API ViewSet for all interactions with template accesses.

    GET /api/v1.0/templates/<template_id>/accesses/:<template_access_id>
        Return list of all template accesses related to the logged-in user or one
        template access if an id is provided.

    POST /api/v1.0/templates/<template_id>/accesses/ with expected data:
        - user: str
        - role: str [administrator|editor|reader]
        Return newly created template access

    PUT /api/v1.0/templates/<template_id>/accesses/<template_access_id>/ with expected data:
        - role: str [owner|admin|editor|reader]
        Return updated template access

    PATCH /api/v1.0/templates/<template_id>/accesses/<template_access_id>/ with expected data:
        - role: str [owner|admin|editor|reader]
        Return partially updated template access

    DELETE /api/v1.0/templates/<template_id>/accesses/<template_access_id>/
        Delete targeted template access
    """

    lookup_field = "pk"
    permission_classes = [permissions.ResourceAccessPermission]
    queryset = models.TemplateAccess.objects.select_related("user").all()
    resource_field_name = "template"
    serializer_class = serializers.TemplateAccessSerializer

    @cached_property
    def template(self):
        """Get related template from resource ID in url."""
        try:
            return models.Template.objects.get(pk=self.kwargs["resource_id"])
        except models.Template.DoesNotExist as excpt:
            raise drf.exceptions.NotFound() from excpt

    def list(self, request, *args, **kwargs):
        """Restrict templates returned by the list endpoint"""
        user = self.request.user
        teams = user.teams
        queryset = self.filter_queryset(self.get_queryset())

        # Limit to resource access instances related to a resource THAT also has
        # a resource access instance for the logged-in user (we don't want to list
        # only the resource access instances pointing to the logged-in user)
        queryset = queryset.filter(
            db.Q(template__accesses__user=user)
            | db.Q(template__accesses__team__in=teams),
        ).distinct()

        serializer = self.get_serializer(queryset, many=True)
        return drf.response.Response(serializer.data)

    def perform_create(self, serializer):
        """
        Actually create the new template access:
        - Ensures the `template_id` is explicitly set from the URL.
        - If the assigned role is `OWNER`, checks that the requesting user is an owner
          of the document. This is the only permission check deferred until this step;
          all other access checks are handled earlier in the permission lifecycle.
        """
        role = serializer.validated_data.get("role")
        if (
            role == choices.RoleChoices.OWNER
            and self.template.get_role(self.request.user) != choices.RoleChoices.OWNER
        ):
            raise drf.exceptions.PermissionDenied(
                "Only owners of a template can assign other users as owners."
            )

        serializer.save(template_id=self.kwargs["resource_id"])


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


class ConfigView(drf.views.APIView):
    """API ViewSet for sharing some public settings."""

    permission_classes = [AllowAny]

    def get(self, request):
        """
        GET /api/v1.0/config/
            Return a dictionary of public settings.
        """
        array_settings = [
            "AI_FEATURE_ENABLED",
            "COLLABORATION_WS_URL",
            "CRISP_WEBSITE_ID",
            "ENVIRONMENT",
            "FRONTEND_CSS_URL",
            "FRONTEND_HOMEPAGE_FEATURE_ENABLED",
            "FRONTEND_THEME",
            "MEDIA_BASE_URL",
            "POSTHOG_KEY",
            "LANGUAGES",
            "LANGUAGE_CODE",
            "SENTRY_DSN",
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


@drf.decorators.api_view()
def notion_import_redirect(request):
    query = urlencode(
        {
            "client_id": settings.NOTION_CLIENT_ID,
            "response_type": "code",
            "owner": "user",
            "redirect_uri": settings.NOTION_REDIRECT_URI,
        }
    )
    return redirect("https://api.notion.com/v1/oauth/authorize?" + query)


@drf.decorators.api_view()
def notion_import_callback(request):
    code = request.GET.get("code")
    resp = requests.post(
        "https://api.notion.com/v1/oauth/token",
        auth=requests.auth.HTTPBasicAuth(settings.NOTION_CLIENT_ID, settings.NOTION_CLIENT_SECRET),
        headers={"Accept": "application/json"},
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": settings.NOTION_REDIRECT_URI,
        },
    )
    resp.raise_for_status()
    data = resp.json()
    request.session["notion_token"] = data["access_token"]
    return redirect("/api/v1.0/notion_import/run")


# @drf.decorators.api_view(["POST"])
@drf.decorators.api_view()
def notion_import_run(request):
    if "notion_token" not in request.session:
        raise drf.exceptions.PermissionDenied()

    imported_docs = import_notion(request.session["notion_token"])

    for imported_doc in imported_docs:
        document_content = YdocConverter().convert_blocks(imported_doc.blocks)

        obj = models.Document.add_root(
            depth=1,
            creator=request.user,
            title=imported_doc.page.get_title() or "J'aime les courgettes",
            link_reach=models.LinkReachChoices.RESTRICTED,
            content=document_content,
        )

        models.DocumentAccess.objects.create(
            document=obj,
            user=request.user,
            role=models.RoleChoices.OWNER,
        )

    return drf.response.Response({"sava": "oui et toi ?"})
