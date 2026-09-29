"""
Test media-auth authorization API endpoint in docs core app.
"""

import time
from io import BytesIO
from unittest.mock import patch
from urllib.parse import urlparse
from uuid import uuid4

from django.core.files.storage import default_storage
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

import pytest
import requests
from botocore.client import BaseClient
from freezegun import freeze_time
from rest_framework.test import APIClient

from core import factories, models
from core.enums import DocumentAttachmentStatus
from core.tests.conftest import TEAM, USER, VIA

pytestmark = pytest.mark.django_db


def test_api_documents_media_auth_unkown_document():
    """
    Trying to download a media related to a document ID that does not exist
    should not have the side effect to create it (no regression test).
    """
    original_url = f"http://localhost/media/{uuid4()!s}/attachments/{uuid4()!s}.jpg"

    response = APIClient().get(
        "/api/v1.0/documents/media-auth/", HTTP_X_ORIGINAL_URL=original_url
    )

    assert response.status_code == 403
    assert models.Document.objects.exists() is False


def test_api_documents_media_auth_anonymous_public(settings):
    """Anonymous users should be able to retrieve attachments linked to a public document"""
    document_id = uuid4()
    filename = f"{uuid4()!s}.jpg"
    key = f"{document_id!s}/attachments/{filename:s}"
    default_storage.connection.meta.client.put_object(
        Bucket=default_storage.bucket_name,
        Key=key,
        Body=BytesIO(b"my prose"),
        ContentType="text/plain",
        Metadata={"status": DocumentAttachmentStatus.READY},
    )

    factories.DocumentFactory(id=document_id, link_reach="public", attachments=[key])

    original_url = f"http://localhost/media/{key:s}"
    now = timezone.now()
    with freeze_time(now):
        response = APIClient().get(
            "/api/v1.0/documents/media-auth/", HTTP_X_ORIGINAL_URL=original_url
        )

    assert response.status_code == 200

    authorization = response["Authorization"]
    assert "AWS4-HMAC-SHA256 Credential=" in authorization
    assert (
        "SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature="
        in authorization
    )
    assert response["X-Amz-Date"] == now.strftime("%Y%m%dT%H%M%SZ")

    s3_url = urlparse(settings.AWS_S3_ENDPOINT_URL)
    file_url = f"{settings.AWS_S3_ENDPOINT_URL:s}/impress-media-storage/{key:s}"
    response = requests.get(
        file_url,
        headers={
            "authorization": authorization,
            "x-amz-date": response["x-amz-date"],
            "x-amz-content-sha256": response["x-amz-content-sha256"],
            "Host": f"{s3_url.hostname:s}:{s3_url.port:d}",
        },
        timeout=1,
    )
    assert response.content.decode("utf-8") == "my prose"


def test_api_documents_media_auth_extensions():
    """Files with extensions of any format should work."""
    extensions = [
        "c",
        "go",
        "gif",
        "mp4",
        "woff2",
        "appimage",
    ]
    document_id = uuid4()
    keys = []
    for ext in extensions:
        filename = f"{uuid4()!s}.{ext:s}"
        key = f"{document_id!s}/attachments/{filename:s}"
        default_storage.connection.meta.client.put_object(
            Bucket=default_storage.bucket_name,
            Key=key,
            Body=BytesIO(b"my prose"),
            ContentType="text/plain",
            Metadata={"status": DocumentAttachmentStatus.READY},
        )
        keys.append(key)

    factories.DocumentFactory(link_reach="public", attachments=keys)

    for key in keys:
        original_url = f"http://localhost/media/{key:s}"
        response = APIClient().get(
            "/api/v1.0/documents/media-auth/", HTTP_X_ORIGINAL_URL=original_url
        )

        assert response.status_code == 200


@pytest.mark.parametrize("reach", ["authenticated", "restricted"])
def test_api_documents_media_auth_anonymous_authenticated_or_restricted(reach):
    """
    Anonymous users should not be allowed to retrieve attachments linked to a document
    with link reach set to authenticated or restricted.
    """
    document_id = uuid4()
    filename = f"{uuid4()!s}.jpg"
    media_url = f"http://localhost/media/{document_id!s}/attachments/{filename:s}"

    factories.DocumentFactory(id=document_id, link_reach=reach)

    response = APIClient().get(
        "/api/v1.0/documents/media-auth/", HTTP_X_ORIGINAL_URL=media_url
    )

    assert response.status_code == 403
    assert "Authorization" not in response


def test_api_documents_media_auth_anonymous_attachments(settings):
    """
    Declaring a media key as original attachment on a document to which
    a user has access should give them access to the attachment file
    regardless of their access rights on the original document.
    """
    document_id = uuid4()
    filename = f"{uuid4()!s}.jpg"
    key = f"{document_id!s}/attachments/{filename:s}"
    media_url = f"http://localhost/media/{key:s}"

    default_storage.connection.meta.client.put_object(
        Bucket=default_storage.bucket_name,
        Key=key,
        Body=BytesIO(b"my prose"),
        ContentType="text/plain",
        Metadata={"status": DocumentAttachmentStatus.READY},
    )

    factories.DocumentFactory(id=document_id, link_reach="restricted")

    response = APIClient().get(
        "/api/v1.0/documents/media-auth/", HTTP_X_ORIGINAL_URL=media_url
    )
    assert response.status_code == 403

    # Let's now add a document to which the anonymous user has access and
    # pointing to the attachment
    parent = factories.DocumentFactory(link_reach="public")
    factories.DocumentFactory(parent=parent, link_reach="restricted", attachments=[key])

    now = timezone.now()
    with freeze_time(now):
        response = APIClient().get(
            "/api/v1.0/documents/media-auth/", HTTP_X_ORIGINAL_URL=media_url
        )

    assert response.status_code == 200

    authorization = response["Authorization"]
    assert "AWS4-HMAC-SHA256 Credential=" in authorization
    assert (
        "SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature="
        in authorization
    )
    assert response["X-Amz-Date"] == now.strftime("%Y%m%dT%H%M%SZ")

    s3_url = urlparse(settings.AWS_S3_ENDPOINT_URL)
    file_url = f"{settings.AWS_S3_ENDPOINT_URL:s}/impress-media-storage/{key:s}"
    response = requests.get(
        file_url,
        headers={
            "authorization": authorization,
            "x-amz-date": response["x-amz-date"],
            "x-amz-content-sha256": response["x-amz-content-sha256"],
            "Host": f"{s3_url.hostname:s}:{s3_url.port:d}",
        },
        timeout=1,
    )
    assert response.content.decode("utf-8") == "my prose"


@pytest.mark.parametrize("reach", ["public", "authenticated"])
def test_api_documents_media_auth_authenticated_public_or_authenticated(
    reach, settings
):
    """
    Authenticated users who are not related to a document should be able to retrieve
    attachments related to a document with public or authenticated link reach.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document_id = uuid4()
    filename = f"{uuid4()!s}.jpg"
    key = f"{document_id!s}/attachments/{filename:s}"
    media_url = f"http://localhost/media/{key:s}"

    default_storage.connection.meta.client.put_object(
        Bucket=default_storage.bucket_name,
        Key=key,
        Body=BytesIO(b"my prose"),
        ContentType="text/plain",
        Metadata={"status": DocumentAttachmentStatus.READY},
    )

    factories.DocumentFactory(id=document_id, link_reach=reach, attachments=[key])

    now = timezone.now()
    with freeze_time(now):
        response = client.get(
            "/api/v1.0/documents/media-auth/", HTTP_X_ORIGINAL_URL=media_url
        )

    assert response.status_code == 200

    authorization = response["Authorization"]
    assert "AWS4-HMAC-SHA256 Credential=" in authorization
    assert (
        "SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature="
        in authorization
    )
    assert response["X-Amz-Date"] == now.strftime("%Y%m%dT%H%M%SZ")

    s3_url = urlparse(settings.AWS_S3_ENDPOINT_URL)
    file_url = f"{settings.AWS_S3_ENDPOINT_URL:s}/impress-media-storage/{key:s}"
    response = requests.get(
        file_url,
        headers={
            "authorization": authorization,
            "x-amz-date": response["x-amz-date"],
            "x-amz-content-sha256": response["x-amz-content-sha256"],
            "Host": f"{s3_url.hostname:s}:{s3_url.port:d}",
        },
        timeout=1,
    )
    assert response.content.decode("utf-8") == "my prose"


def test_api_documents_media_auth_authenticated_restricted():
    """
    Authenticated users who are not related to a document should not be allowed to
    retrieve attachments linked to a document that is restricted.
    """
    user = factories.UserFactory(with_owned_document=True)
    client = APIClient()
    client.force_login(user)

    document_id = uuid4()
    filename = f"{uuid4()!s}.jpg"
    key = f"{document_id!s}/attachments/{filename:s}"
    media_url = f"http://localhost/media/{key:s}"

    factories.DocumentFactory(
        id=document_id, link_reach="restricted", attachments=[key]
    )

    response = client.get(
        "/api/v1.0/documents/media-auth/", HTTP_X_ORIGINAL_URL=media_url
    )

    assert response.status_code == 403
    assert "Authorization" not in response


@pytest.mark.parametrize("via", VIA)
def test_api_documents_media_auth_related(via, mock_user_teams, settings):
    """
    Users who have a specific access to a document, whatever the role, should be able to
    retrieve related attachments.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document_id = uuid4()
    filename = f"{uuid4()!s}.jpg"
    key = f"{document_id!s}/attachments/{filename:s}"
    media_url = f"http://localhost/media/{key:s}"
    default_storage.connection.meta.client.put_object(
        Bucket=default_storage.bucket_name,
        Key=key,
        Body=BytesIO(b"my prose"),
        ContentType="text/plain",
        Metadata={"status": DocumentAttachmentStatus.READY},
    )

    document = factories.DocumentFactory(
        id=document_id, link_reach="restricted", attachments=[key]
    )
    if via == USER:
        factories.UserDocumentAccessFactory(document=document, user=user)
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(document=document, team="lasuite")

    now = timezone.now()
    with freeze_time(now):
        response = client.get(
            "/api/v1.0/documents/media-auth/", HTTP_X_ORIGINAL_URL=media_url
        )

    assert response.status_code == 200

    authorization = response["Authorization"]
    assert "AWS4-HMAC-SHA256 Credential=" in authorization
    assert (
        "SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature="
        in authorization
    )
    assert response["X-Amz-Date"] == now.strftime("%Y%m%dT%H%M%SZ")

    s3_url = urlparse(settings.AWS_S3_ENDPOINT_URL)
    file_url = f"{settings.AWS_S3_ENDPOINT_URL:s}/impress-media-storage/{key:s}"
    response = requests.get(
        file_url,
        headers={
            "authorization": authorization,
            "x-amz-date": response["x-amz-date"],
            "x-amz-content-sha256": response["x-amz-content-sha256"],
            "Host": f"{s3_url.hostname:s}:{s3_url.port:d}",
        },
        timeout=1,
    )
    assert response.content.decode("utf-8") == "my prose"


def test_api_documents_media_auth_not_ready_status():
    """Attachments with status not ready should not be accessible"""
    document_id = uuid4()
    filename = f"{uuid4()!s}.jpg"
    key = f"{document_id!s}/attachments/{filename:s}"
    default_storage.connection.meta.client.put_object(
        Bucket=default_storage.bucket_name,
        Key=key,
        Body=BytesIO(b"my prose"),
        ContentType="text/plain",
        Metadata={"status": DocumentAttachmentStatus.PROCESSING},
    )

    factories.DocumentFactory(id=document_id, link_reach="public", attachments=[key])

    original_url = f"http://localhost/media/{key:s}"
    response = APIClient().get(
        "/api/v1.0/documents/media-auth/", HTTP_X_ORIGINAL_URL=original_url
    )

    assert response.status_code == 403


def test_api_documents_media_auth_uppercase_status_metadata():
    """
    Object storage metadata keys are case insensitive, and some S3 implementations give them
    back capitalized. A ready attachment should still be served in that case.
    """
    document_id = uuid4()
    filename = f"{uuid4()!s}.jpg"
    key = f"{document_id!s}/attachments/{filename:s}"

    factories.DocumentFactory(id=document_id, link_reach="public", attachments=[key])

    head_resp = {
        "ContentType": "text/plain",
        "Metadata": {"Status": DocumentAttachmentStatus.READY.value},
    }

    original_url = f"http://localhost/media/{key:s}"
    with patch.object(
        default_storage.connection.meta.client, "head_object", return_value=head_resp
    ):
        response = APIClient().get(
            "/api/v1.0/documents/media-auth/", HTTP_X_ORIGINAL_URL=original_url
        )

    assert response.status_code == 200
    assert "AWS4-HMAC-SHA256 Credential=" in response["Authorization"]


def test_api_documents_media_auth_missing_status_metadata(settings):
    """Attachments without status metadata should be considered as ready"""
    document_id = uuid4()
    filename = f"{uuid4()!s}.jpg"
    key = f"{document_id!s}/attachments/{filename:s}"
    default_storage.connection.meta.client.put_object(
        Bucket=default_storage.bucket_name,
        Key=key,
        Body=BytesIO(b"my prose"),
        ContentType="text/plain",
    )

    factories.DocumentFactory(id=document_id, link_reach="public", attachments=[key])

    now = timezone.now()
    original_url = f"http://localhost/media/{key:s}"
    with freeze_time(now):
        response = APIClient().get(
            "/api/v1.0/documents/media-auth/", HTTP_X_ORIGINAL_URL=original_url
        )

    assert response.status_code == 200

    authorization = response["Authorization"]
    assert "AWS4-HMAC-SHA256 Credential=" in authorization
    assert (
        "SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature="
        in authorization
    )
    assert response["X-Amz-Date"] == now.strftime("%Y%m%dT%H%M%SZ")

    s3_url = urlparse(settings.AWS_S3_ENDPOINT_URL)
    file_url = f"{settings.AWS_S3_ENDPOINT_URL:s}/impress-media-storage/{key:s}"
    response = requests.get(
        file_url,
        headers={
            "authorization": authorization,
            "x-amz-date": response["x-amz-date"],
            "x-amz-content-sha256": response["x-amz-content-sha256"],
            "Host": f"{s3_url.hostname:s}:{s3_url.port:d}",
        },
        timeout=1,
    )
    assert response.content.decode("utf-8") == "my prose"


def test_api_documents_media_auth_anonymous_public_custom_origin_header(settings):
    """Changing the setting MEDIA_AUTH_ORIGINAL_URL_HEADER to match other header should work"""
    settings.MEDIA_AUTH_ORIGINAL_URL_HEADER = "HTTP_X_FORWARDED_URI"
    document_id = uuid4()
    filename = f"{uuid4()!s}.jpg"
    key = f"{document_id!s}/attachments/{filename:s}"
    default_storage.connection.meta.client.put_object(
        Bucket=default_storage.bucket_name,
        Key=key,
        Body=BytesIO(b"my prose"),
        ContentType="text/plain",
        Metadata={"status": DocumentAttachmentStatus.READY},
    )

    factories.DocumentFactory(id=document_id, link_reach="public", attachments=[key])

    original_url = f"http://localhost/media/{key:s}"
    now = timezone.now()
    with freeze_time(now):
        response = APIClient().get(
            "/api/v1.0/documents/media-auth/", HTTP_X_FORWARDED_URI=original_url
        )

    assert response.status_code == 200

    authorization = response["Authorization"]
    assert "AWS4-HMAC-SHA256 Credential=" in authorization
    assert (
        "SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature="
        in authorization
    )
    assert response["X-Amz-Date"] == now.strftime("%Y%m%dT%H%M%SZ")

    s3_url = urlparse(settings.AWS_S3_ENDPOINT_URL)
    file_url = f"{settings.AWS_S3_ENDPOINT_URL:s}/impress-media-storage/{key:s}"
    response = requests.get(
        file_url,
        headers={
            "authorization": authorization,
            "x-amz-date": response["x-amz-date"],
            "x-amz-content-sha256": response["x-amz-content-sha256"],
            "Host": f"{s3_url.hostname:s}:{s3_url.port:d}",
        },
        timeout=1,
    )
    assert response.content.decode("utf-8") == "my prose"


def _media_auth_ready(user, key):
    """
    Call media-auth for `key` as `user` (None = anonymous), with the object
    storage HEAD mocked as a READY attachment so the test exercises only the
    authorization logic and does not depend on a live object store.
    """
    client = APIClient()
    if user is not None:
        client.force_login(user)

    real_make_api_call = BaseClient._make_api_call  # pylint: disable=protected-access

    def fake_make_api_call(self, operation_name, api_params):
        if operation_name == "HeadObject":
            return {"Metadata": {"status": DocumentAttachmentStatus.READY}}
        return real_make_api_call(self, operation_name, api_params)

    with patch.object(BaseClient, "_make_api_call", new=fake_make_api_call):
        return client.get(
            "/api/v1.0/documents/media-auth/",
            HTTP_X_ORIGINAL_URL=f"http://localhost/media/{key:s}",
        )


def test_api_documents_media_auth_grant_via_deep_ancestor():
    """
    Access to an attachment is granted when a *distant* ancestor of the
    document holding it is readable, even though the document and every
    intermediate ancestor are restricted and the user has no direct access to
    them. This mirrors the production scenario where the attachment lived on a
    deeply nested document.
    """
    user = factories.UserFactory()

    # User has access only at the root; everything below is restricted.
    root = factories.DocumentFactory(users=[user], link_reach="restricted")
    level1 = factories.DocumentFactory(parent=root, link_reach="restricted")
    level2 = factories.DocumentFactory(parent=level1, link_reach="restricted")

    filename = f"{uuid4()!s}.jpg"
    key = f"{level2.id!s}/attachments/{filename:s}"
    factories.DocumentFactory(parent=level2, link_reach="restricted", attachments=[key])

    response = _media_auth_ready(user, key)

    assert response.status_code == 200
    assert "AWS4-HMAC-SHA256 Credential=" in response["Authorization"]

    # A user with no access anywhere in the tree is denied.
    other = factories.UserFactory()
    assert _media_auth_ready(other, key).status_code == 403


# Number of DB queries a single media-auth authorization performs, end to end
# (session + user resolution, the attachment lookup and the readable EXISTS).
# It is a small constant and, crucially, independent of how many documents the
# instance holds -- that invariance is the regression guard for the thundering
# herd, where the check used to materialise the user's entire readable set.
MEDIA_AUTH_QUERY_COUNT = 5


def test_api_documents_media_auth_authorization_cost_is_bounded(
    django_assert_num_queries,
):
    """
    The authorization decision must not get more expensive as the instance
    grows: adding many unrelated readable documents leaves the query count
    unchanged.
    """
    user = factories.UserFactory()
    filename = f"{uuid4()!s}.jpg"
    document = factories.DocumentFactory(users=[user], link_reach="restricted")
    key = f"{document.id!s}/attachments/{filename:s}"
    document.attachments = [key]
    document.save()

    with django_assert_num_queries(MEDIA_AUTH_QUERY_COUNT):
        assert _media_auth_ready(user, key).status_code == 200

    # Flood the instance with unrelated readable (public) documents: the query
    # count must not change. Another attachment is authorized, so the decision
    # cache does not come into play.
    factories.DocumentFactory.create_batch(30, link_reach="public")
    other_document = factories.DocumentFactory(users=[user], link_reach="restricted")
    other_key = f"{other_document.id!s}/attachments/{uuid4()!s}.jpg"
    other_document.attachments = [other_key]
    other_document.save()

    with django_assert_num_queries(MEDIA_AUTH_QUERY_COUNT):
        assert _media_auth_ready(user, other_key).status_code == 200


class HeadObjectSpy:
    """
    Count the HeadObject calls the media-auth endpoint makes to the storage.

    The object storage is the boundary the decision cache is meant to
    protect, so the tests below assert on how many times it is hit rather
    than on the cache itself.
    """

    def __init__(self):
        self.keys = []
        self._real_make_api_call = BaseClient._make_api_call  # pylint: disable=protected-access

    def media_auth(self, client, key):
        """Run a media-auth request with the spy installed."""
        spy = self
        real_make_api_call = self._real_make_api_call

        # Built as a plain function and installed on the class: the descriptor
        # protocol then binds it to the botocore client, which is how it gets
        # handed the very instance a patched method still needs to make the
        # calls it does not want to answer itself.
        def fake_make_api_call(boto_client, operation_name, api_params):
            """Answer HeadObject as ready, recording it, defer the rest."""
            if operation_name == "HeadObject":
                spy.keys.append(api_params["Key"])
                return {"Metadata": {"status": DocumentAttachmentStatus.READY}}
            return real_make_api_call(boto_client, operation_name, api_params)

        with patch.object(BaseClient, "_make_api_call", new=fake_make_api_call):
            return client.get(
                "/api/v1.0/documents/media-auth/",
                HTTP_X_ORIGINAL_URL=f"http://localhost/media/{key:s}",
            )


def _document_queries(context):
    """Return the queries a captured context ran against the documents table."""
    table = models.Document._meta.db_table
    return [query["sql"] for query in context.captured_queries if table in query["sql"]]


def test_api_documents_media_auth_caches_allow_decision():
    """
    Authorizing the same attachment twice for the same user must not repeat the
    authorization work: neither the database lookups that establish the
    decision nor the object storage check run again, which is what keeps a page
    holding many attachments from multiplying the very same calls.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(users=[user], link_reach="restricted")
    key = f"{document.id!s}/attachments/{uuid4()!s}.jpg"
    document.attachments = [key]
    document.save()

    client = APIClient()
    client.force_login(user)
    spy = HeadObjectSpy()

    with CaptureQueriesContext(connection) as first_call:
        assert spy.media_auth(client, key).status_code == 200

    with CaptureQueriesContext(connection) as second_call:
        assert spy.media_auth(client, key).status_code == 200

    # Asserted on both sides against passing vacuously: the first call has to
    # query the documents table, otherwise the absence of such a query on the
    # second one proves nothing (a wrong table name would read green forever).
    assert _document_queries(first_call) != []
    assert _document_queries(second_call) == []
    assert len(second_call.captured_queries) < len(first_call.captured_queries)

    # The object storage is checked once too, not once per authorization.
    assert spy.keys == [key]


def test_api_documents_media_auth_cache_does_not_leak_across_users():
    """
    An allow cached for a user must never authorize another user on the same
    attachment: the cache key carries the user, or this test would read 200.
    """
    user = factories.UserFactory()
    other = factories.UserFactory()
    document = factories.DocumentFactory(users=[user], link_reach="restricted")
    key = f"{document.id!s}/attachments/{uuid4()!s}.jpg"
    document.attachments = [key]
    document.save()

    spy = HeadObjectSpy()

    client = APIClient()
    client.force_login(user)
    assert spy.media_auth(client, key).status_code == 200

    other_client = APIClient()
    other_client.force_login(other)
    assert spy.media_auth(other_client, key).status_code == 403


def test_api_documents_media_auth_cached_decision_expires(settings):
    """
    The cached allow must expire after MEDIA_AUTH_CACHE_TTL seconds: the
    object storage is checked again past the TTL, or a revoked access would
    keep passing forever.
    """
    ttl = 1
    settings.MEDIA_AUTH_CACHE_TTL = ttl

    user = factories.UserFactory()
    document = factories.DocumentFactory(users=[user], link_reach="restricted")
    key = f"{document.id!s}/attachments/{uuid4()!s}.jpg"
    document.attachments = [key]
    document.save()

    client = APIClient()
    client.force_login(user)
    spy = HeadObjectSpy()

    assert spy.media_auth(client, key).status_code == 200

    # Waited out for real instead of with freezegun: whatever backend the
    # settings select, expiry must follow the passage of time an attacker of
    # a frozen clock cannot argue with, not the clock of this process.
    time.sleep(ttl + 0.5)

    assert spy.media_auth(client, key).status_code == 200

    assert spy.keys == [key, key]


def test_api_documents_media_auth_deny_is_not_cached():
    """
    A denied authorization must not be cached: an access granted right after
    a denial is effective at once, without waiting for any TTL.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach="restricted")
    key = f"{document.id!s}/attachments/{uuid4()!s}.jpg"
    document.attachments = [key]
    document.save()

    client = APIClient()
    client.force_login(user)
    spy = HeadObjectSpy()

    assert spy.media_auth(client, key).status_code == 403

    factories.UserDocumentAccessFactory(document=document, user=user)
    assert spy.media_auth(client, key).status_code == 200
