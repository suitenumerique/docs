"""Utils module to stream content to a StreamingHttpResponse"""

import os

from asgiref.sync import sync_to_async
from botocore.response import StreamingBody


def _is_async_server():
    """
    Return whether the app runs as an ASGI application, based on the
    PYTHON_SERVER_MODE environment variable (set in impress/asgi.py and
    impress/wsgi.py).
    """
    return os.environ.get("PYTHON_SERVER_MODE", "sync") == "async"


def sync_stream(body: StreamingBody):
    """Synchronous generator consuming s3 response body."""
    yield from body.iter_chunks()
    body.close()


async def async_stream(body: StreamingBody):
    """Asynchronous generator consuming s3 response body"""
    # The botocore stream is blocking, so each read is offloaded with
    # sync_to_async to avoid blocking the event loop.
    chunks = await sync_to_async(body.iter_chunks)()
    sentinel = object()
    while True:
        chunk = await sync_to_async(next)(chunks, sentinel)
        if chunk is sentinel:
            break
        yield chunk
    await sync_to_async(body.close)()


def content_stream(body: StreamingBody):
    """
    Depending on the server mode (set through the PYTHON_SERVER_MODE
    environment variable in impress/asgi.py and impress/wsgi.py), the
    content is streamed back with either an asynchronous or a synchronous
    iterator. Under ASGI, a synchronous iterator would trigger a Django
    warning and be consumed synchronously, defeating the purpose of
    streaming.
    """
    return async_stream(body) if _is_async_server() else sync_stream(body)
