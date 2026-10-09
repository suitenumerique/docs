"""Mint and revoke the sessions of the synthetic users of a load test.

Docs only authenticates through a session, opened by an OIDC login that a load
generator cannot go through for thousands of users. The sessions are therefore
written straight to the session store, for existing (anonymised) users, exactly
as `django.contrib.auth.login` would have written them. The collaboration server
forwards the same cookie to the backend, so one session covers the API, the
websocket and its http fallback.

Everything here refuses to run unless LOAD_TEST_TOOLS_ENABLED is set, whoever
the caller is.
"""

from datetime import timedelta
from importlib import import_module

from django.conf import settings
from django.contrib.auth import BACKEND_SESSION_KEY, HASH_SESSION_KEY, SESSION_KEY
from django.core.cache import caches
from django.db.models import Count, Exists, OuterRef
from django.utils import timezone

from core import models
from core.choices import LinkReachChoices, RoleChoices

# The backend a real login records in the session. It has to be one of
# AUTHENTICATION_BACKENDS, or Django discards the session as it reads it.
AUTHENTICATION_BACKEND = "core.authentication.backends.OIDCAuthenticationBackend"
# Marks a session as minted here, for whoever inspects the session store.
SESSION_MARKER = "load_test"
# Where the keys of the minted sessions are remembered, next to the sessions
# themselves, so that they can all be revoked without the manifest at hand.
INDEX_CACHE_KEY = "loadtest:session-keys"
EDITING_ROLES = [RoleChoices.EDITOR, RoleChoices.ADMIN, RoleChoices.OWNER]
MAX_TTL = timedelta(days=7)


class LoadTestToolsDisabled(RuntimeError):
    """Raised when the tooling is used where it is not enabled."""


def ensure_enabled():
    """Refuse to go any further unless this environment is a load-test one."""
    if not settings.LOAD_TEST_TOOLS_ENABLED:
        raise LoadTestToolsDisabled(
            "LOAD_TEST_TOOLS_ENABLED is not set: sessions can only be minted with "
            "the `LoadTest` configuration."
        )
    if settings.ENVIRONMENT == "production":
        raise LoadTestToolsDisabled(
            "Sessions are never minted with the `Production` configuration."
        )


def _session_store():
    return import_module(settings.SESSION_ENGINE).SessionStore


def _index_cache():
    return caches[settings.SESSION_CACHE_ALIAS]


def select_users(count, heaviest=0):
    """
    Pick the users to log in: `heaviest` users holding the most accesses, then
    a random draw among the others, `count` in total.

    Only active users with at least one access to a document that is not deleted:
    a virtual user with nothing to open is of no use. Staff and superusers are
    never picked — a minted session of theirs would open the admin.
    """
    live_accesses = models.DocumentAccess.objects.filter(
        user=OuterRef("pk"), document__ancestors_deleted_at__isnull=True
    )
    candidates = models.User.objects.filter(
        Exists(live_accesses), is_active=True, is_staff=False, is_superuser=False
    )

    users = []
    if heaviest > 0:
        users = list(
            candidates.annotate(nb_accesses=Count("documentaccess")).order_by(
                "-nb_accesses", "pk"
            )[: min(heaviest, count)]
        )
    remaining = count - len(users)
    if remaining > 0:
        users += list(
            candidates.exclude(pk__in=[user.pk for user in users]).order_by("?")[
                :remaining
            ]
        )
    return users


def documents_of(user, limit):
    """
    The documents a user was given access to, most recently updated first, split
    by what they may do with them: `(editable ids, read-only ids)`.
    """
    accesses = (
        models.DocumentAccess.objects.filter(
            user=user, document__ancestors_deleted_at__isnull=True
        )
        .order_by("-document__updated_at")
        .values_list("document_id", "role")
    )
    editable, readonly = [], []
    for document_id, role in accesses.iterator():
        target = editable if role in EDITING_ROLES else readonly
        if len(target) < limit:
            target.append(str(document_id))
        if len(editable) >= limit and len(readonly) >= limit:
            break
    return editable, readonly


def public_documents(limit):
    """A random draw of documents anybody can open, shared by every virtual user."""
    if limit <= 0:
        return []
    return [
        str(document_id)
        for document_id in models.Document.objects.filter(
            link_reach=LinkReachChoices.PUBLIC, ancestors_deleted_at__isnull=True
        )
        .order_by("?")
        .values_list("pk", flat=True)[:limit]
    ]


def mint_session(user, ttl):
    """Write the session a login of `user` would have opened, and return its key."""
    ensure_enabled()
    session = _session_store()()
    session[SESSION_KEY] = str(user.pk)
    session[BACKEND_SESSION_KEY] = AUTHENTICATION_BACKEND
    session[HASH_SESSION_KEY] = user.get_session_auth_hash()
    session[SESSION_MARKER] = True
    session.set_expiry(int(ttl.total_seconds()))
    session.create()
    return session.session_key


def remember(session_keys, ttl):
    """Add the keys to the index the revocation reads."""
    cache = _index_cache()
    known = set(cache.get(INDEX_CACHE_KEY) or [])
    known.update(session_keys)
    # kept a little longer than the sessions: an index that expires first would
    # leave sessions nothing can find anymore
    cache.set(INDEX_CACHE_KEY, sorted(known), int(ttl.total_seconds()) + 3600)


def build_manifest(count, *, heaviest, documents_per_user, nb_public_documents, ttl):
    """
    Mint one session per selected user and describe them for a load generator.

    The manifest holds live session keys: it is a secret, to be written where
    only the load generator reads it and never to a log.
    """
    ensure_enabled()
    if ttl > MAX_TTL:
        raise ValueError(f"A load-test session cannot outlive {MAX_TTL.days} days.")

    now = timezone.now()
    sessions = []
    for user in select_users(count, heaviest):
        editable, readonly = documents_of(user, documents_per_user)
        sessions.append(
            {
                "user_id": str(user.pk),
                "session_key": mint_session(user, ttl),
                "editable_documents": editable,
                "readonly_documents": readonly,
            }
        )
    remember([session["session_key"] for session in sessions], ttl)

    return {
        "created_at": now.isoformat(),
        "expires_at": (now + ttl).isoformat(),
        "cookie_name": settings.SESSION_COOKIE_NAME,
        "public_documents": public_documents(nb_public_documents),
        "sessions": sessions,
    }


def revoke_all():
    """Delete every session minted here that is still known, and return how many."""
    ensure_enabled()
    cache = _index_cache()
    session_keys = cache.get(INDEX_CACHE_KEY) or []
    store = _session_store()
    for session_key in session_keys:
        store(session_key=session_key).delete()
    cache.delete(INDEX_CACHE_KEY)
    return len(session_keys)
