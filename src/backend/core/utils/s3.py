"""Process-global boto3 S3 client accessors.

django-storages caches its S3 connection on **thread-local** storage
(``S3Storage.connection`` / ``unsigned_connection``). Under a multi-threaded or
async-threadpool server, every thread that has not served this storage yet
rebuilds the boto3 client from scratch — and building a client makes botocore
load its service model off disk (millions of ``stat``/``listdir`` syscalls plus
a JSON decode of the model). Profiling the ``media-auth`` hot path showed that
this client construction, not PostgreSQL, dominated its CPU: ~2.6 fresh clients
were built per call, one for ``head_object`` and two more inside
``generate_s3_authorization_headers`` (signed + unsigned).

boto3 *clients* are thread-safe once built (only *resources* are not, and we use
``.meta.client`` exclusively), and their attached credential provider still
refreshes rotating credentials on demand. So we can build each variant **once
per process** and share it across every thread and request, which removes the
per-request/per-thread rebuild entirely.

The clients are captured from ``default_storage`` so they inherit its exact
configuration (endpoint, region, signature version, credentials, TLS).
"""

import threading

from django.core.files.storage import default_storage

_LOCK = threading.Lock()
_CLIENTS = {}


def _cached(name, factory):
    """Return the process-global client ``name``, building it once via factory."""
    client = _CLIENTS.get(name)
    if client is None:
        with _LOCK:
            # Re-check inside the lock: another thread may have built it while we
            # waited (double-checked locking).
            client = _CLIENTS.get(name)
            if client is None:
                client = factory()
                _CLIENTS[name] = client
    return client


def get_s3_client():
    """Return a process-global signed S3 client (thread-safe, built once)."""
    return _cached("signed", lambda: default_storage.connection.meta.client)


def get_unsigned_s3_client():
    """Return a process-global unsigned S3 client, for presigning URLs."""
    return _cached("unsigned", lambda: default_storage.unsigned_connection.meta.client)
