"""Document search index management utilities and indexers"""

import logging
from abc import ABC, abstractmethod
from collections import defaultdict
from functools import cache

from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.core.exceptions import ImproperlyConfigured
from django.utils.module_loading import import_string

import requests

from core import models, utils

logger = logging.getLogger(__name__)


@cache
def get_document_indexer():
    """Returns an instance of indexer service if enabled and properly configured."""
    classpath = settings.SEARCH_INDEXER_CLASS

    # For this usecase an empty indexer class is not an issue but a feature.
    if not classpath:
        logger.info("Document indexer is not configured (see SEARCH_INDEXER_CLASS)")
        return None

    try:
        indexer_class = import_string(settings.SEARCH_INDEXER_CLASS)
        return indexer_class()
    except ImportError as err:
        logger.error("SEARCH_INDEXER_CLASS setting is not valid : %s", err)
    except ImproperlyConfigured as err:
        logger.error("Document indexer is not properly configured : %s", err)

    return None


def get_batch_accesses_by_users_and_teams(paths):
    """
    Get accesses related to a list of document paths,
    grouped by users and teams, including all ancestor paths.
    """
    ancestor_map = utils.get_ancestor_to_descendants_map(
        paths, steplen=models.Document.steplen
    )
    ancestor_paths = list(ancestor_map.keys())

    access_qs = models.DocumentAccess.objects.filter(
        document__path__in=ancestor_paths
    ).values("document__path", "user__sub", "team")

    access_by_document_path = defaultdict(lambda: {"users": set(), "teams": set()})

    for access in access_qs:
        ancestor_path = access["document__path"]
        user_sub = access["user__sub"]
        team = access["team"]

        for descendant_path in ancestor_map.get(ancestor_path, []):
            if user_sub:
                access_by_document_path[descendant_path]["users"].add(str(user_sub))
            if team:
                access_by_document_path[descendant_path]["teams"].add(team)

    return dict(access_by_document_path)


def get_visited_document_ids_of(queryset, user):
    """
    Returns the ids of the documents that have a linktrace to the user and NOT owned.
    It will be use to limit the opensearch responses to the public documents already
    "visited" by the user.
    """
    if isinstance(user, AnonymousUser):
        return []

    qs = models.LinkTrace.objects.filter(user=user)

    docs = (
        queryset.exclude(accesses__user=user)
        .filter(
            deleted_at__isnull=True,
            ancestors_deleted_at__isnull=True,
        )
        .filter(pk__in=Subquery(qs.values("document_id")))
        .order_by("pk")
        .distinct("pk")
    )

    return [str(id) for id in docs.values_list("pk", flat=True)]


class BaseDocumentIndexer(ABC):
    """
    Base class for document indexers.

    Handles batching and access resolution. Subclasses must implement both
    `serialize_document()` and `push()` to define backend-specific behavior.
    """

    def __init__(self):
        """
        Initialize the indexer.
        """
        self.batch_size = settings.SEARCH_INDEXER_BATCH_SIZE
        self.indexer_url = settings.SEARCH_INDEXER_URL
        self.indexer_secret = settings.SEARCH_INDEXER_SECRET
        self.search_url = settings.SEARCH_INDEXER_QUERY_URL
        self.search_limit = settings.SEARCH_INDEXER_QUERY_LIMIT

        if not self.indexer_url:
            raise ImproperlyConfigured(
                "SEARCH_INDEXER_URL must be set in Django settings."
            )

        if not self.indexer_secret:
            raise ImproperlyConfigured(
                "SEARCH_INDEXER_SECRET must be set in Django settings."
            )

        if not self.search_url:
            raise ImproperlyConfigured(
                "SEARCH_INDEXER_QUERY_URL must be set in Django settings."
            )

    def index(self, queryset=None, batch_size=None):
        """
        Fetch documents in batches, serialize them, and push to the search backend.

        Args:
            queryset (optional): Document queryset
                Defaults to all documents without filter.
            batch_size (int, optional): Number of documents per batch.
                Defaults to settings.SEARCH_INDEXER_BATCH_SIZE.
        """
        last_id = 0
        count = 0
        queryset = queryset or models.Document.objects.all()
        batch_size = batch_size or self.batch_size

        while True:
            documents_batch = list(
                queryset.filter(
                    id__gt=last_id,
                ).order_by("id")[:batch_size]
            )

            if not documents_batch:
                break

            doc_paths = [doc.path for doc in documents_batch]
            last_id = documents_batch[-1].id
            accesses_by_document_path = get_batch_accesses_by_users_and_teams(doc_paths)

            serialized_batch = [
                self.serialize_document(document, accesses_by_document_path)
                for document in documents_batch
                if document.content or document.title
            ]

            if serialized_batch:
                self.push(serialized_batch)
                count += len(serialized_batch)

        return count

    @abstractmethod
    def serialize_document(self, document, accesses):
        """
        Convert a Document instance to a JSON-serializable format for indexing.

        Must be implemented by subclasses.
        """

    @abstractmethod
    def push(self, data):
        """
        Push a batch of serialized documents to the backend.

        Must be implemented by subclasses.
        """

    # pylint: disable-next=too-many-arguments,too-many-positional-arguments
    def search(self, q, token, visited=(), nb_results=None, path=None):
        """
        Search for documents in Find app.
        Ensure the same default ordering as "Docs" list : -updated_at

        Returns ids of the documents

        Args:
            q (str): user query.
            token (str): OIDC Authentication token.
            visited (list, optional):
                List of ids of active public documents with LinkTrace
                Defaults to settings.SEARCH_INDEXER_BATCH_SIZE.
            nb_results (int, optional):
                The number of results to return.
                Defaults to 50 if not specified.
            path (str, optional):
                The parent path to search descendants of.
        """
        nb_results = nb_results or self.search_limit
        results = self.search_query(
            data={
                "q": q,
                "visited": visited,
                "services": ["docs"],
                "nb_results": nb_results,
                "order_by": "updated_at",
                "order_direction": "desc",
                "path": path,
            },
            token=token,
        )

        return results

    @abstractmethod
    def search_query(self, data, token) -> dict:
        """
        Retrieve documents from the Find app API.

        Must be implemented by subclasses.
        """


class FindDocumentIndexer(BaseDocumentIndexer):
    """
    Document indexer that indexes and searches documents with La Suite Find app.
    """

    # pylint: disable=too-many-arguments,too-many-positional-arguments
    def search(self, q, token, visited=(), nb_results=None, path=None):
        """format Find search results"""
        search_results = super().search(q, token, visited, nb_results, path)
        return [
            {
                **hit["_source"],
                "id": hit["_id"],
                "title": self.get_title(hit["_source"]),
            }
            for hit in search_results
        ]

    @staticmethod
    def get_title(source):
        """
        Find returns the titles with an extension depending on the language.
        This function extracts the title in a generic way.

        Handles multiple cases:
        - Localized title fields like "title.<some_extension>"
        - Fallback to plain "title" field if localized version not found
        - Returns empty string if no title field exists

        Args:
            source (dict): The _source dictionary from a search hit

        Returns:
            str: The extracted title or empty string if not found

        Example:
            >>> get_title({"title.fr": "Bonjour", "id": 1})
            "Bonjour"
            >>> get_title({"title": "Hello", "id": 1})
            "Hello"
            >>> get_title({"id": 1})
            ""
        """
        titles = utils.get_value_by_pattern(source, r"^title\.")
        for title in titles:
            if title:
                return title
        if "title" in source:
            return source["title"]
        return ""

    def serialize_document(self, document, accesses):
        """
        Convert a Document to the JSON format expected by La Suite Find.

        Args:
            document (Document): The document instance.
            accesses (dict): Mapping of document ID to user/team access.

        Returns:
            dict: A JSON-serializable dictionary.
        """
        doc_path = document.path
        doc_content = document.content
        text_content = utils.base64_yjs_to_text(doc_content) if doc_content else ""

        return {
            "id": str(document.id),
            "title": document.title or "",
            "content": text_content,
            "depth": document.depth,
            "path": document.path,
            "numchild": document.numchild,
            "created_at": document.created_at.isoformat(),
            "updated_at": document.updated_at.isoformat(),
            "users": list(accesses.get(doc_path, {}).get("users", set())),
            "groups": list(accesses.get(doc_path, {}).get("teams", set())),
            "reach": document.computed_link_reach,
            "size": len(text_content.encode("utf-8")),
            "is_active": not bool(document.ancestors_deleted_at),
        }

    def search_query(self, data, token) -> requests.Response:
        """
        Retrieve documents from the Find app API.

        Args:
            data (dict): search data
            token (str): OICD token

        Returns:
            dict: A JSON-serializable dictionary.
        """
        response = requests.post(
            self.search_url,
            json=data,
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        response.raise_for_status()
        return response.json()

    def push(self, data):
        """
        Push a batch of documents to the Find backend.

        Args:
            data (list): List of document dictionaries.
        """
        response = requests.post(
            self.indexer_url,
            json=data,
            headers={"Authorization": f"Bearer {self.indexer_secret}"},
            timeout=10,
        )
        response.raise_for_status()
