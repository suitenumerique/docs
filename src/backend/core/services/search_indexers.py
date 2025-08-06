"""Document search index management utilities and indexers"""

import logging
from abc import ABC, abstractmethod
from collections import defaultdict

from django.conf import settings
from django.contrib.auth.models import AnonymousUser

import requests

from core import models, utils

logger = logging.getLogger(__name__)


def get_batch_accesses_by_users_and_teams(paths):
    """
    Get accesses related to a list of document paths,
    grouped by users and teams, including all ancestor paths.
    """
    # print("paths: ", paths)
    ancestor_map = utils.get_ancestor_to_descendants_map(
        paths, steplen=models.Document.steplen
    )
    ancestor_paths = list(ancestor_map.keys())
    # print("ancestor map: ", ancestor_map)
    # print("ancestor paths: ", ancestor_paths)

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


def get_visited_document_ids_of(user):
    if isinstance(user, AnonymousUser):
        return []

    # TODO : exclude links when user already have a specific access to the doc
    qs = models.LinkTrace.objects.filter(
        user=user
    ).exclude(
        document__accesses__user=user,
    )

    return list({
        str(id) for id in qs.values_list("document_id", flat=True)
    })


class BaseDocumentIndexer(ABC):
    """
    Base class for document indexers.

    Handles batching and access resolution. Subclasses must implement both
    `serialize_document()` and `push()` to define backend-specific behavior.
    """

    def __init__(self, batch_size=None):
        """
        Initialize the indexer.

        Args:
            batch_size (int, optional): Number of documents per batch.
                Defaults to settings.SEARCH_INDEXER_BATCH_SIZE.
        """
        self.batch_size = batch_size or settings.SEARCH_INDEXER_BATCH_SIZE

    def index(self):
        """
        Fetch documents in batches, serialize them, and push to the search backend.
        """
        last_id = 0
        while True:
            documents_batch = list(
                models.Document.objects.filter(
                    id__gt=last_id,
                ).order_by("id")[: self.batch_size]
            )

            if not documents_batch:
                break

            doc_paths = [doc.path for doc in documents_batch]
            last_id = documents_batch[-1].id
            accesses_by_document_path = get_batch_accesses_by_users_and_teams(doc_paths)

            serialized_batch = [
                self.serialize_document(document, accesses_by_document_path)
                for document in documents_batch
                if document.content
            ]
            self.push(serialized_batch)

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

    def search(self, text, user, token):
        """
        Search for documents in Find app.
        """
        visited_ids = get_visited_document_ids_of(user)

        response = self.search_query(data={
            "q": text,
            "visited": visited_ids,
            "services": ["docs"],
        }, token=token)

        print(response)

        return self.format_response(response)

    @abstractmethod
    def search_query(self, data, token) -> dict:
        """
        Retreive documents from the Find app API.

        Must be implemented by subclasses.
        """

    @abstractmethod
    def format_response(self, data: dict):
        """
        Convert the JSON response from Find app as document queryset.

        Must be implemented by subclasses.
        """


class FindDocumentIndexer(BaseDocumentIndexer):
    """
    Document indexer that pushes documents to La Suite Find app.
    """

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
        url = getattr(settings, "SEARCH_INDEXER_QUERY_URL", None)

        if not url:
            raise RuntimeError(
                "SEARCH_INDEXER_QUERY_URL must be set in Django settings before indexing."
            )

        try:
            response = requests.post(
                url,
                json=data,
                headers={"Authorization": f"Bearer {token}"},
                timeout=10,
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as e:
            logger.error("HTTPError: %s", e)
            logger.error("Response content: %s", response.text)  # type: ignore
            raise

    def format_response(self, data: dict):
        """
        Retrieve documents ids from Find app response and return a queryset.
        """
        return models.Document.objects.filter(pk__in=[
            d['_id'] for d in data
        ])

    def push(self, data):
        """
        Push a batch of documents to the Find backend.

        Args:
            data (list): List of document dictionaries.
        """
        url = getattr(settings, "SEARCH_INDEXER_URL", None)
        if not url:
            raise RuntimeError(
                "SEARCH_INDEXER_URL must be set in Django settings before indexing."
            )

        secret = getattr(settings, "SEARCH_INDEXER_SECRET", None)
        if not secret:
            raise RuntimeError(
                "SEARCH_INDEXER_SECRET must be set in Django settings before indexing."
            )

        try:
            response = requests.post(
                url,
                json=data,
                headers={"Authorization": f"Bearer {secret}"},
                timeout=10,
            )
            response.raise_for_status()
        except requests.exceptions.HTTPError as e:
            logger.error("HTTPError: %s", e)
            logger.error("Response content: %s", response.text)
            raise
