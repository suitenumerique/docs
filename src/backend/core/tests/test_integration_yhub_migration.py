"""
Integration tests for the migration of legacy documents into the collaboration
server (yhub).

These talk to a *running* yhub, and through it to MinIO. They need no database:
the admin JWT short-circuits yhub's document authorization, so nothing here
creates a ``Document`` row — the fixtures are S3 objects and yhub rooms keyed on
a random uuid.

Two paths are covered, in the order a real corpus goes through them:

``soft migration``
    yhub does not know the room, so the first read seeds it from the *newest*
    S3 version. The seed carries an author but deliberately no timestamp, so it
    contributes no activity entry.

``full migration``
    ``POST /migrate`` replays *every* S3 version, crediting each with its own S3
    ``LastModified``, so the activity api reports the same timeline as the
    backend's ``/documents/{id}/versions/``.
"""

import base64
import itertools
import uuid

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage

import pytest
import requests

from core.services.jwt_services import JWTService

# yhub verifies that its own name is the audience of the token (server.js)
YHUB_AUDIENCE = "yhub"
# the org yhub is configured with; documents live under /docs/{docid}
YHUB_ORG = "docs"
TIMEOUT = 10
# see _activity: distinct values defeat yhub's few-second response cache
_cache_buster = itertools.count(1000)


def _yhub_url():
    """Base url of the collaboration api, or None when it is not configured."""
    return (settings.COLLABORATION_API_URL or "").rstrip("/") or None


def _yhub_reachable():
    """Is a collaboration server actually listening? These tests need one."""
    url = _yhub_url()
    if url is None:
        return False
    try:
        # any route answers *something*; we only care that the port is served
        requests.get(f"{url}/activity/v1/{YHUB_ORG}/nope", timeout=2)
    except requests.RequestException:
        return False
    return True


pytestmark = pytest.mark.skipif(
    not _yhub_reachable(),
    reason=(
        "needs a running collaboration server (COLLABORATION_API_URL); "
        "start the dev stack with `make run`"
    ),
)


@pytest.fixture(name="admin_headers")
def admin_headers_fixture(settings):  # pylint: disable=redefined-outer-name
    """
    Authorization for the backend-to-yhub calls.

    The token is signed with the same key the running yhub validates against
    (it fetches the JWKS from this backend), so this only works when both sides
    share ``JWT_PRIVATE_KEY`` — which they do in the dev stack and in CI.
    """
    if not settings.JWT_PRIVATE_KEY:
        pytest.skip("JWT_PRIVATE_KEY is not configured")
    token = JWTService().get_admin_token({"aud": YHUB_AUDIENCE})
    return {"Authorization": f"Bearer {token}"}


def _write_legacy_versions(docid, updates):
    """
    Write `updates` as successive versions of the legacy object `{docid}/file`.

    Mirrors what the Django backend used to do on every content save: the body
    is the base64 encoding of a raw Yjs update, and the bucket is versioned, so
    each write leaves the previous one behind as an object version.

    Returns the versions oldest first, as (version_id, last_modified).
    """
    key = f"{docid}/file"
    for update in updates:
        default_storage.save(key, ContentFile(base64.b64encode(update)))

    client = default_storage.connection.meta.client
    response = client.list_object_versions(
        Bucket=default_storage.bucket_name, Prefix=key
    )
    versions = [v for v in response.get("Versions", []) if v["Key"] == key]
    versions.sort(key=lambda v: v["LastModified"])
    return [(v["VersionId"], v["LastModified"]) for v in versions]


def _activity(docid, admin_headers, **params):
    """
    The document's activity, one entry per change, oldest first.

    ``Accept: application/json`` opts out of yhub's lib0-any encoding (0.5.0),
    which is what lets a python caller read the timeline without a decoder.
    ``group=false`` keeps one entry per version: the default grouping merges
    changes by the same author less than a second apart.

    ``groupMaxGap`` is a cache buster, not a parameter we care about: yhub
    caches activity responses for a few seconds keyed on the full query, and a
    test reads the timeline immediately after changing it. With ``group=false``
    the value is never read (``groupDistance = group ? groupMaxGap : 1``), so a
    unique one buys a fresh computation without touching the result.
    """
    response = requests.get(
        f"{_yhub_url()}/activity/v1/{YHUB_ORG}/{docid}",
        params={
            "group": "false",
            "groupMaxGap": next(_cache_buster),
            **params,
        },
        headers={**admin_headers, "Accept": "application/json"},
        timeout=TIMEOUT,
    )
    assert response.status_code == 200, response.text
    assert response.headers["content-type"].startswith("application/json")
    return response.json()["activity"]


def _read_ydoc(docid, admin_headers):
    """Read the room, which is also what triggers the lazy soft migration."""
    return requests.get(
        f"{_yhub_url()}/ydoc/v1/{YHUB_ORG}/{docid}",
        headers=admin_headers,
        timeout=TIMEOUT,
    )


def _ydoc_bytes(docid, admin_headers):
    """
    The room's Yjs state as raw bytes.

    The response is an envelope around the document, so its size says nothing
    on its own; ``Accept: application/json`` renders the field as base64, which
    is comparable.
    """
    response = requests.get(
        f"{_yhub_url()}/ydoc/v1/{YHUB_ORG}/{docid}",
        headers={**admin_headers, "Accept": "application/json"},
        timeout=TIMEOUT,
    )
    assert response.status_code == 200, response.text
    return base64.b64decode(response.json()["doc"])


def _migrate(docid, admin_headers, **params):
    """Replay the document's full legacy version history into yhub."""
    return requests.post(
        f"{_yhub_url()}/migrate/v1/{YHUB_ORG}/{docid}",
        params=params,
        headers={**admin_headers, "Accept": "application/json"},
        timeout=60,
    )


# Three successive snapshots of one Yjs document, as the legacy store held them:
# each is a full `Y.encodeStateAsUpdate` of the same doc after another insert,
# so they share a lineage and every later one is a superset of the last.
# Generated with @y/y; hardcoded so the tests need no javascript.
LEGACY_SNAPSHOTS = [
    base64.b64decode(b64)
    for b64 in (
        "AQG8yr6Vi7ATAAQBDmRvY3VtZW50LXN0b3JlCkFMUEhBLW9uZSAA",
        "AQG8yr6Vi7ATAAQBDmRvY3VtZW50LXN0b3JlFEFMUEhBLW9uZSBCUkFWTy10d28gAA==",
        "AQG8yr6Vi7ATAAQBDmRvY3VtZW50LXN0b3JlIkFMUEhBLW9uZSBCUkFWTy10d28gQ0hBUkxJRS10aHJlZSAA",
    )
]


def test_integration_yhub_soft_migration_seeds_without_a_timestamp(admin_headers):
    """
    The first read of an unknown room seeds it from the newest legacy version.

    The seed is a migration artifact, not an editing event: it has no honest
    time to report, so it writes no `insertAt` and therefore shows up in no
    activity entry. Anything else would put a second, meaningless timestamp on
    content the full migration is about to date properly.
    """
    docid = str(uuid.uuid4())
    _write_legacy_versions(docid, LEGACY_SNAPSHOTS)

    response = _read_ydoc(docid, admin_headers)

    assert response.status_code == 200, response.text
    # seeded, so the room is no longer empty (an empty update is 2 bytes)
    assert len(response.content) > 3
    assert _activity(docid, admin_headers) == []


def test_integration_yhub_soft_migration_admits_when_it_cannot_migrate(admin_headers):
    """
    A legacy object that cannot be decoded must not lock its document.

    Nobody can repair such an object from the outside, so refusing access would
    make the document permanently unopenable. It opens as a new one instead —
    the legacy bytes stay in S3, and the server logs that it admitted a caller
    without migrating.
    """
    docid = str(uuid.uuid4())
    _write_legacy_versions(docid, [b"@@not-a-valid-ydoc@@"])

    response = _read_ydoc(docid, admin_headers)

    assert response.status_code == 200, response.text
    # and what it opens is exactly what a document that never existed opens as
    never_existed = str(uuid.uuid4())
    assert _ydoc_bytes(docid, admin_headers) == _ydoc_bytes(
        never_existed, admin_headers
    )
    assert _activity(docid, admin_headers) == []


def test_integration_yhub_soft_migration_ignores_a_non_main_branch(admin_headers):
    """
    Seeding a branch other than main must not consume the document's one seed.

    The legacy store is branchless — ``{docid}/file`` *is* main — and the admin
    token is the only identity that can name another branch. Seeding one would
    write main's content into an orphan room and, because the "already seeded"
    bookkeeping is per document, leave the real room empty.
    """
    docid = str(uuid.uuid4())
    _write_legacy_versions(docid, LEGACY_SNAPSHOTS)

    on_a_branch = requests.get(
        f"{_yhub_url()}/ydoc/v1/{YHUB_ORG}/{docid}",
        params={"branch": "draft"},
        headers=admin_headers,
        timeout=TIMEOUT,
    )
    assert on_a_branch.status_code == 200, on_a_branch.text

    # main is untouched by that, so it still seeds on its own first read
    assert _read_ydoc(docid, admin_headers).status_code == 200
    assert _ydoc_bytes(docid, admin_headers) != _ydoc_bytes(
        str(uuid.uuid4()), admin_headers
    )


def test_integration_yhub_full_migration_reports_every_s3_version(admin_headers):
    """
    The migrate endpoint replays every legacy version, dated by that version.

    This is the property the whole feature exists for: activity and the
    backend's version listing describe the same timeline.
    """
    docid = str(uuid.uuid4())
    versions = _write_legacy_versions(docid, LEGACY_SNAPSHOTS)

    response = _migrate(docid, admin_headers)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["migrated"] is True
    assert body["versions"] == len(versions)
    assert body["applied"] == len(versions)
    assert body["skipped"] == 0
    assert body["dropped"] == 0
    # the decoded size of every snapshot it read, not the base64 on the wire
    assert body["bytes"] == sum(len(update) for update in LEGACY_SNAPSHOTS)

    activity = _activity(docid, admin_headers)

    assert len(activity) == len(versions)
    for entry, (_, last_modified) in zip(activity, versions, strict=True):
        # yhub stores timestamps in milliseconds (lib0 `getUnixTime` is
        # `Date.now`), which is what the S3 write time converts to
        assert entry["from"] == pytest.approx(last_modified.timestamp() * 1000, abs=1)
        assert entry["from"] == entry["to"]
        # legacy snapshots carry no author of their own
        assert entry["by"] == "system"


def test_integration_yhub_full_migration_after_a_soft_migration(admin_headers):
    """
    The two migrations compose: seeding first does not duplicate the history.

    The seed writes the legacy bytes unchanged, so its content ids are the ones
    the replay regenerates — the replay covers them and, carrying no timestamp
    of its own, the seed adds no entry beside them.
    """
    docid = str(uuid.uuid4())
    versions = _write_legacy_versions(docid, LEGACY_SNAPSHOTS)

    assert _read_ydoc(docid, admin_headers).status_code == 200
    assert _activity(docid, admin_headers) == []

    assert _migrate(docid, admin_headers).status_code == 200

    activity = _activity(docid, admin_headers)
    assert len(activity) == len(versions)
    assert [entry["from"] for entry in activity] == sorted(
        entry["from"] for entry in activity
    )


def test_integration_yhub_full_migration_is_idempotent(admin_headers):
    """
    A document is migrated once, ever.

    Replaying a second time would attribute the same content twice, so the
    docid is remembered in a valkey set and later calls decline. `?force=true`
    is the escape hatch, and the clock-0 row it writes conflicts with the first
    one, so even that leaves the timeline alone.
    """
    docid = str(uuid.uuid4())
    versions = _write_legacy_versions(docid, LEGACY_SNAPSHOTS)

    assert _migrate(docid, admin_headers).json()["migrated"] is True

    again = _migrate(docid, admin_headers)
    assert again.status_code == 200
    assert again.json() == {"message": "Already migrated", "migrated": False}

    forced = _migrate(docid, admin_headers, force="true")
    assert forced.json()["migrated"] is True

    assert len(_activity(docid, admin_headers)) == len(versions)


def test_integration_yhub_migration_without_a_legacy_document(admin_headers):
    """
    A document that never had a legacy object is nothing to migrate.

    It answers 2xx all the same, so a backfill driver walking the corpus can
    treat every success as "done" without special-casing new documents.
    """
    response = _migrate(str(uuid.uuid4()), admin_headers)

    assert response.status_code == 200
    body = response.json()
    assert body["migrated"] is False
    assert body["message"] == "No legacy document in s3"
    assert body["versions"] == 0


def test_integration_yhub_migration_skips_an_unreadable_version(admin_headers):
    """
    One corrupt snapshot must not cost the document its whole history.

    Every version is a full snapshot, so the content of an unreadable one
    arrives with the next readable version anyway — only its timeline entry is
    lost, and the migration reports how many it dropped that way.
    """
    docid = str(uuid.uuid4())
    _write_legacy_versions(
        docid,
        [LEGACY_SNAPSHOTS[0], b"@@not-a-valid-ydoc@@", LEGACY_SNAPSHOTS[2]],
    )

    body = _migrate(docid, admin_headers).json()

    assert body["migrated"] is True
    assert body["versions"] == 3
    assert body["skipped"] == 1
    assert body["applied"] == 2
    assert len(_activity(docid, admin_headers)) == 2


def test_integration_yhub_migration_rejects_a_token_for_another_audience():
    """
    An admin token minted for another service must not be replayable here.

    Django's JWTService signs for whoever asks, so the audience is the only
    thing separating the converter's token from yhub's.
    """
    token = JWTService().get_admin_token({"aud": "y-converter"})

    response = _migrate(str(uuid.uuid4()), {"Authorization": f"Bearer {token}"})

    assert response.status_code == 401
