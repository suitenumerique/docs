"""profile_volumetry — capture the statistical shape of a Docs database.

Read-only. Emits a JSON profile of the row counts and distributions that drive
endpoint cost — tree depth and breadth, the link_reach ratio, accesses per user
and per document, attachments cardinality, favorites — so that
``generate_volumetry`` can rebuild a same-shaped dataset in staging *without
copying any production content*.

Every incident of the 2026-08-18 media-auth class is impossible to reproduce in
staging because staging never has production's volumetry: too few non-restricted
documents, too shallow a tree, too small a "worst" user. This command measures
exactly those drivers as aggregates only — no rows, no PII leaves the database —
so the shape can be reproduced elsewhere.

Run it against a READ REPLICA, never the primary. It performs a handful of
full-table aggregates (a few sequential scans / group-bys); harmless on a
replica, avoidable load on the leader.

    # print to stdout
    python manage.py profile_volumetry

    # write through the default storage backend (S3 here), overwriting the key
    python manage.py profile_volumetry --output volumetry/prod-2026-08.json

The profile is intentionally value-free: it contains counts and quantiles, never
titles, emails, keys or contents.
"""

import json
import sys

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand
from django.db import connection
from django.db import models as django_models

from core import models

# Quantiles reported for every "per-something" distribution. p99 (and max) are
# what matter for cost: the worst user, not the average one, is what melted down.
_QUANTILES = (0.5, 0.9, 0.99)


def _dist(cursor, table, group_col, count_col="*"):
    """Return {max, mean, p50, p90, p99} for the per-group row counts.

    Computes ``count(count_col)`` grouped by ``group_col`` and summarises the
    resulting counts with Postgres ``percentile_disc``. All identifiers come
    from Django model metadata, never user input.
    """
    counted = "count(*)" if count_col == "*" else f'count("{count_col}")'
    pct = ", ".join(
        f"percentile_disc({q}) within group (order by c)" for q in _QUANTILES
    )
    cursor.execute(
        f"select max(c), avg(c), {pct} from ("  # noqa: S608 (identifiers are trusted metadata)
        f'  select "{group_col}" g, {counted} c from "{table}"'
        f'  where "{group_col}" is not null group by "{group_col}"'
        f") s"
    )
    row = cursor.fetchone()
    if row is None or row[0] is None:
        return {"max": 0, "mean": 0.0, "p50": 0, "p90": 0, "p99": 0}
    max_, mean, p50, p90, p99 = row
    return {
        "max": int(max_),
        "mean": round(float(mean), 2),
        "p50": int(p50),
        "p90": int(p90),
        "p99": int(p99),
    }


def _histogram(qs, field):
    """Return {value: count} for a GROUP BY over one column, keys as strings."""
    rows = qs.values(field).annotate(n=django_models.Count("id")).order_by(field)
    return {str(r[field]): r["n"] for r in rows}


def build_profile():
    """Collect every distribution the generator needs, as plain JSON data."""
    doc_qs = models.Document.objects.all()
    doc_table = models.Document._meta.db_table  # noqa: SLF001
    access_table = models.DocumentAccess._meta.db_table  # noqa: SLF001
    fav_table = models.DocumentFavorite._meta.db_table  # noqa: SLF001

    non_restricted = doc_qs.exclude(
        link_reach=models.LinkReachChoices.RESTRICTED
    ).count()

    with connection.cursor() as cursor:
        # Attachments: how many documents carry keys, and how many keys each.
        cursor.execute(
            f'select count(*) filter (where cardinality("attachments") > 0), '  # noqa: S608
            f'  coalesce(sum(cardinality("attachments")), 0), '
            f'  coalesce(max(cardinality("attachments")), 0) '
            f'from "{doc_table}"'
        )
        att_docs, att_total, att_max = cursor.fetchone()

        accesses_per_user = _dist(cursor, access_table, "user_id")
        accesses_per_document = _dist(cursor, access_table, "document_id")
        favorites_per_user = _dist(cursor, fav_table, "user_id")

    team_accesses = models.DocumentAccess.objects.exclude(
        django_models.Q(team__isnull=True) | django_models.Q(team="")
    ).count()
    total_accesses = models.DocumentAccess.objects.count()

    return {
        # A note for whoever reads the file; the generator ignores it.
        "_about": (
            "Aggregate shape of a Docs database (no PII). Feed to "
            "`generate_volumetry --profile`. Quantiles are per-entity row counts."
        ),
        "counts": {
            "users": models.User.objects.count(),
            "documents": doc_qs.count(),
            "documents_root": doc_qs.filter(depth=1).count(),
            "accesses": total_accesses,
            "accesses_team_based": team_accesses,
            "favorites": models.DocumentFavorite.objects.count(),
            "invitations": models.Invitation.objects.count(),
            "link_traces": models.LinkTrace.objects.count(),
        },
        "link_reach": _histogram(doc_qs, "link_reach"),
        "link_role": _histogram(doc_qs, "link_role"),
        # depth = len(path)/steplen, stored denormalised on the row; breadth is
        # numchild. Together they fix the tree shape the generator rebuilds.
        "depth_histogram": _histogram(doc_qs, "depth"),
        "numchild_histogram": _histogram(doc_qs, "numchild"),
        "role_distribution": _histogram(models.DocumentAccess.objects.all(), "role"),
        "accesses_per_user": accesses_per_user,
        "accesses_per_document": accesses_per_document,
        "favorites_per_user": favorites_per_user,
        "attachments": {
            "documents_with_attachments": att_docs,
            "keys_total": int(att_total),
            "max_per_document": int(att_max),
        },
        "deleted": {
            "soft_deleted": doc_qs.filter(deleted_at__isnull=False).count(),
            "ancestor_deleted": doc_qs.filter(
                ancestors_deleted_at__isnull=False
            ).count(),
        },
        # The crux number for the media-auth class of incident: the size of the
        # largest readable-per-se set a single user can hold is bounded below by
        # the non-restricted document count (everyone sees those) plus that
        # user's direct accesses. The generator seeds one worst-case user to
        # this scale so the pathology actually reproduces.
        "worst_case_readable_per_se": {
            "non_restricted_documents": non_restricted,
            "max_accesses_per_user": accesses_per_user["max"],
            "estimated": non_restricted + accesses_per_user["max"],
        },
    }


class Command(BaseCommand):
    """Emit a JSON volumetry profile of the current database (read-only)."""

    help = __doc__

    def add_arguments(self, parser):
        """Define command arguments."""
        parser.add_argument(
            "-o",
            "--output",
            type=str,
            default=None,
            help=(
                "Storage key to write the profile to via Django's default storage "
                "backend, e.g. volumetry/prod.json (default: print to stdout)."
            ),
        )
        parser.add_argument(
            "--indent",
            type=int,
            default=2,
            help="JSON indentation (default: 2).",
        )

    def handle(self, *args, **options):
        """Build the profile and write it out."""
        profile = build_profile()
        text = json.dumps(profile, indent=options["indent"], sort_keys=True) + "\n"

        output = options["output"]
        if not output:
            sys.stdout.write(text)
            return

        # Persist through Django's storage framework (the configured default
        # storage — S3 in this project) so the artifact lands in durable,
        # config-driven storage rather than an ephemeral pod filesystem when the
        # profiler runs against a production/staging replica.
        if default_storage.exists(output):
            # save() would otherwise write to a suffixed key; we want the path
            # the caller asked for, overwriting any earlier profile there.
            default_storage.delete(output)
        name = default_storage.save(output, ContentFile(text.encode("utf-8")))

        self.stderr.write(
            self.style.SUCCESS(
                f"Wrote profile to storage key '{name}': "
                f"{profile['counts']['documents']} documents, "
                f"{profile['counts']['users']} users, worst-case readable set "
                f"~{profile['worst_case_readable_per_se']['estimated']}."
            )
        )
