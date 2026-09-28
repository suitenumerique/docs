"""Test the s3 response stream utilities."""

from collections.abc import AsyncIterator, Iterator

import pytest
from asgiref.sync import async_to_sync

from core.utils.s3_response_stream import async_stream, content_stream, sync_stream

pytestmark = pytest.mark.django_db


class FakeS3Body:
    """Minimal stand-in for a botocore StreamingBody."""

    def __init__(self, chunks):
        self._chunks = chunks
        self.closed = False

    def iter_chunks(self):
        """Yield the configured chunks, like StreamingBody.iter_chunks."""
        yield from self._chunks

    def close(self):
        """Record that the body has been closed."""
        self.closed = True


def collect_async(async_gen):
    """Consume an async generator synchronously and return its items as a list."""

    async def _collect():
        return [chunk async for chunk in async_gen]

    return async_to_sync(_collect)()


# -- sync_stream --


def test_sync_stream_yields_all_chunks():
    """Should yield every chunk of the body in order."""
    body = FakeS3Body([b"hello", b"world", b"!"])

    assert list(sync_stream(body)) == [b"hello", b"world", b"!"]


def test_sync_stream_empty_body():
    """Should yield nothing when the body is empty."""
    body = FakeS3Body([])

    assert not list(sync_stream(body))


def test_sync_stream_closes_body():
    """Should close the body once it has been fully consumed."""
    body = FakeS3Body([b"hello"])

    assert body.closed is False
    list(sync_stream(body))
    assert body.closed is True


# -- async_stream --


def test_async_stream_yields_all_chunks():
    """Should yield every chunk of the body in order."""
    body = FakeS3Body([b"hello", b"world", b"!"])

    assert collect_async(async_stream(body)) == [b"hello", b"world", b"!"]


def test_async_stream_empty_body():
    """Should yield nothing when the body is empty."""
    body = FakeS3Body([])

    assert not collect_async(async_stream(body))


def test_async_stream_closes_body():
    """Should close the body once it has been fully consumed."""
    body = FakeS3Body([b"hello"])

    assert body.closed is False
    collect_async(async_stream(body))
    assert body.closed is True


# -- content_stream --


def test_content_stream_async_mode(monkeypatch):
    """In async mode, content_stream should return an async iterator."""
    monkeypatch.setenv("PYTHON_SERVER_MODE", "async")
    body = FakeS3Body([b"hello", b"world"])

    stream = content_stream(body)

    assert isinstance(stream, AsyncIterator)
    assert collect_async(stream) == [b"hello", b"world"]


def test_content_stream_sync_mode(monkeypatch):
    """In sync mode, content_stream should return a sync iterator."""
    monkeypatch.setenv("PYTHON_SERVER_MODE", "sync")
    body = FakeS3Body([b"hello", b"world"])

    stream = content_stream(body)

    assert not isinstance(stream, AsyncIterator)
    assert isinstance(stream, Iterator)
    assert list(stream) == [b"hello", b"world"]


def test_content_stream_defaults_to_sync(monkeypatch):
    """When PYTHON_SERVER_MODE is not set, content_stream should default to sync."""
    monkeypatch.delenv("PYTHON_SERVER_MODE", raising=False)
    body = FakeS3Body([b"hello", b"world"])

    stream = content_stream(body)

    assert not isinstance(stream, AsyncIterator)
    assert isinstance(stream, Iterator)
    assert list(stream) == [b"hello", b"world"]
