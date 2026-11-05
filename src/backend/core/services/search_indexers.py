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

from core import models
from core.services.find_tokens import forget_find_token, get_find_token
from core.services.yhub_services import YHubError, YHubService
from core.utils.paths import get_ancestor_to_descendants_map
from core.utils.yjs import yjs_to_text

logger = logging.getLogger(__name__)


class SearchIndexerError(Exception):
    """The search indexer could not answer a search."""


class SearchIndexerAuthenticationError(SearchIndexerError):
    """The search indexer rejected the token of the user."""


class SearchIndexerUnavailableError(SearchIndexerError):
    """
    The search indexer cannot search for this session, e.g. it holds no token for
    it. Not a failure: the search is expected to be made otherwise.
    """


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
    ancestor_map = get_ancestor_to_descendants_map(
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


def get_visited_document_ids_of(queryset, user) -> tuple[str, ...]:
    """
    Returns the ids of the documents that have a linktrace to the user and NOT owned.
    It will be use to limit the opensearch responses to the public documents already
    "visited" by the user.
    """
    if isinstance(user, AnonymousUser):
        return []

    visited_ids = models.LinkTrace.objects.filter(user=user).values_list(
        "document_id", flat=True
    )

    docs = (
        queryset.exclude(accesses__user=user)
        .filter(
            deleted_at__isnull=True,
            ancestors_deleted_at__isnull=True,
        )
        .filter(pk__in=visited_ids)
        .order_by("pk")
        .distinct("pk")
    )

    return tuple(str(id) for id in docs.values_list("pk", flat=True))


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
        self.indexer_url = settings.INDEXING_URL
        self.indexer_secret = settings.SEARCH_INDEXER_SECRET
        self.search_url = settings.SEARCH_URL
        self.search_limit = settings.SEARCH_INDEXER_QUERY_LIMIT

        if not self.indexer_url:
            raise ImproperlyConfigured("INDEXING_URL must be set in Django settings.")

        if not self.indexer_secret:
            raise ImproperlyConfigured(
                "SEARCH_INDEXER_SECRET must be set in Django settings."
            )

        if not self.search_url:
            raise ImproperlyConfigured("SEARCH_URL must be set in Django settings.")

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

            serialized_batch = []
            for document in documents_batch:
                try:
                    content = self.get_document_content(document)
                except YHubError:
                    # A document whose content we could not read is left alone:
                    # pushing it with an empty content would erase what the
                    # search backend knows of it over a transient failure.
                    logger.exception(
                        "Document %s was not indexed, its content could not be "
                        "read from the collaboration server",
                        document.pk,
                    )
                    continue

                if content or document.title:
                    serialized_batch.append(
                        self.serialize_document(
                            document, content, accesses_by_document_path
                        )
                    )

            if serialized_batch:
                self.push(serialized_batch)
                count += len(serialized_batch)

        return count

    @staticmethod
    def get_document_content(document):
        """
        Return the text of a document, as the collaboration server has it.

        The collaboration server owns the content of the documents, so it is
        read from there and never from the database. A document it holds no
        content for has none, and is indexed on its metadata alone.
        """
        update = YHubService().get_ydoc(document)

        return yjs_to_text(update) if update else ""

    @abstractmethod
    def serialize_document(self, document, content, accesses):
        """
        Convert a Document instance to a JSON-serializable format for indexing.

        The content is passed in rather than read from the document: it is
        fetched once, from the collaboration server, by `index`.

        Must be implemented by subclasses.
        """

    @abstractmethod
    def push(self, data):
        """
        Push a batch of serialized documents to the backend.

        Must be implemented by subclasses.
        """

    def search(
        self,
        q: str,
        session,
        visited: tuple[str, ...] = (),
        nb_results: int = None,
        path: str = None,
    ):
        """
        Search for documents in Find app, in the services of FIND_SEARCH_SERVICES.
        Ensure the same default ordering as "Docs" list : -updated_at

        Returns ids of the documents

        Raises:
            SearchIndexerUnavailableError: the indexer cannot search for this
                session.
            SearchIndexerError: the indexer could not answer.

        Args:
            q (str): user query.
            session: Session of the user, which holds what the indexer needs to
                authenticate them.
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
                "services": list(settings.FIND_SEARCH_SERVICES),
                "nb_results": nb_results,
                "order_by": "updated_at",
                "order_direction": "desc",
                "path": path,
            },
            session=session,
        )

        return results

    @abstractmethod
    def search_query(self, data, session) -> dict:
        """
        Retrieve documents from the Find app API.

        Must be implemented by subclasses.
        """


class FindDocumentIndexer(BaseDocumentIndexer):
    """
    Document indexer that indexes and searches documents with La Suite Find app.
    """

    def search(
        self,
        q: str,
        session,
        visited: tuple[()] = (),
        nb_results: int = None,
        path: str = None,
    ):
        """
        Return the documents matching the query, as listed by Find.

        Find answers with {"results": [...]}, each result already carrying its
        id and its title, whatever the language it was indexed under.
        """
        body = super().search(
            q=q,
            session=session,
            visited=visited,
            nb_results=nb_results,
            path=path,
        )
        results = body.get("results") if isinstance(body, dict) else None
        if not isinstance(results, list):
            raise SearchIndexerError("Find answered a search without results")
        return results

    def serialize_document(self, document, content, accesses):
        """
        Convert a Document to the JSON format expected by La Suite Find.

        Args:
            document (Document): The document instance.
            content (str): The text of the document, as read from the
                collaboration server.
            accesses (dict): Mapping of document ID to user/team access.

        Returns:
            dict: A JSON-serializable dictionary.
        """
        doc_path = document.path

        return {
            "id": str(document.id),
            "title": document.title or "",
            "content": content,
            "depth": document.depth,
            "path": document.path,
            "numchild": document.numchild,
            "created_at": document.created_at.isoformat(),
            "updated_at": document.updated_at.isoformat(),
            "users": list(accesses.get(doc_path, {}).get("users", set())),
            "groups": list(accesses.get(doc_path, {}).get("teams", set())),
            "reach": document.computed_link_reach,
            "size": len(content.encode("utf-8")),
            "is_active": not bool(document.ancestors_deleted_at),
        }

    def search_query(self, data, session) -> dict:
        """
        Retrieve documents from the Find app API, with the Find token exchanged at
        the login of the user and kept in their session.

        Args:
            data (dict): search data
            session: Session of the user

        Returns:
            dict: The body of the answer of Find.

        Raises:
            SearchIndexerUnavailableError: the session holds no usable Find token
                (anonymous user, Menshen failing at login, token expired...).
            SearchIndexerAuthenticationError: Find rejected the token (401), which
                is dropped from the session: there is no use sending it again.
            SearchIndexerError: Find could not be reached or did not answer
                a search result.
        """
        token = get_find_token(session)
        if not token:
            raise SearchIndexerUnavailableError("No usable Find token in the session")

        try:
            response = requests.post(
                self.search_url,
                json=data,
                headers={"Authorization": f"Bearer {token}"},
                timeout=10,
            )
        except requests.RequestException as error:
            raise SearchIndexerError(f"Find could not be reached: {error}") from error

        if response.status_code == 401:
            forget_find_token(session)
            raise SearchIndexerAuthenticationError(
                "Find rejected the token of the session (401), it is dropped"
            )
        if response.status_code in (400, 403):
            # Find's answer is generic, and its validation errors echo the query
            # of the user: the configuration is what helps here.
            raise SearchIndexerError(
                f"Find refused the search ({response.status_code}): the token "
                "must grant the search in each service of FIND_SEARCH_SERVICES "
                f"({settings.FIND_SEARCH_SERVICES}), check FIND_AUDIENCE "
                f"({settings.FIND_AUDIENCE}), FIND_SEARCH_ACTION_SCOPE "
                f"({settings.FIND_SEARCH_ACTION_SCOPE}) and the rule of Menshen"
            )
        if not response.ok:
            raise SearchIndexerError(f"Find answered {response.status_code}")

        try:
            return response.json()
        except ValueError as error:
            raise SearchIndexerError(
                "Find answered a search that is not JSON"
            ) from error

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
