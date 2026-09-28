# ruff: noqa: S311, S106
"""generate_volumetry — rebuild a Docs database at a profiled scale.

Takes a JSON profile produced by ``profile_volumetry`` and synthesises a dataset
with the same *shape* — tree depth and breadth, link_reach ratio, accesses per
user and per document, favorites, link traces, attachment keys — but with no
real content, titles or emails. The point is to reproduce, in staging, the exact
volumetry that makes incidents like the 2026-08-18 media-auth thundering herd
appear, without ever copying production data.

    python manage.py generate_volumetry --profile prod-2026-08.json --scale 1.0

What it reproduces, and which endpoint each driver feeds:
  * tree depth + breadth        -> tree / children / all / list root reduction
  * link_reach ratio            -> readable_per_se selectivity (media_auth, list)
  * accesses per user/document  -> get_queryset id-lists + user_roles annotation
  * a single WORST-CASE user    -> the large readable set the herd melted on
  * favorites / link traces     -> favorite_list / annotate_is_favorite / list

It writes rows with ``bulk_create`` (no ``save()``, no S3, no ``full_clean``),
computing treebeard ``path``/``depth``/``numchild`` directly, exactly like the
``create_demo`` command. Attachment keys are synthetic strings; the S3 objects
they name need not exist — the media_auth DB queries run before ``head_object``.

Run it against a throwaway staging database. It refuses a non-empty document
table (path collisions, skewed counts) and, like the demo command, refuses to
run outside DEBUG without ``--force``.
"""

import json
import math
import random
from collections import defaultdict
from uuid import uuid4

from django import db
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from core import models

# Emails/subs are namespaced so a run is trivially identifiable and removable.
DOMAIN = "volumetry.local"
WORST_CASE_EMAIL = f"worst.case@{DOMAIN}"


class BulkQueue:
    """Create model instances in bulk by pushing to a per-model queue.

    Mirrors demo.create_demo's helper: it batches ``bulk_create`` and resets the
    query cache to avoid the DEBUG-mode memory leak. ``ignore_conflicts`` lets
    the relation tables tolerate the odd duplicate ``(user, document)`` pair.
    """

    BATCH_SIZE = 20000

    def __init__(self, stdout, ignore_conflicts=False):
        self.queue = defaultdict(list)
        self.stdout = stdout
        self.ignore_conflicts = ignore_conflicts

    def _bulk_create(self, objects):
        """Insert one model's queued instances and clear the query cache."""
        if not objects:
            return
        objects[0]._meta.model.objects.bulk_create(  # noqa: SLF001
            objects, ignore_conflicts=self.ignore_conflicts
        )
        db.reset_queries()  # DEBUG keeps a query cache -> memory leak at scale
        self.queue[objects[0]._meta.model.__name__] = []  # noqa: SLF001

    def push(self, obj):
        """Queue an instance, flushing its model's batch once it is full."""
        objects = self.queue[obj._meta.model.__name__]  # noqa: SLF001
        objects.append(obj)
        if len(objects) > self.BATCH_SIZE:
            self._bulk_create(objects)
            self.stdout.write(".", ending="")
            self.stdout.flush()

    def flush(self):
        """Create every remaining queued instance across all models."""
        for objects in list(self.queue.values()):
            self._bulk_create(objects)


class Picker:
    """Weighted categorical sampler over a {value: weight} histogram.

    Precomputes a cumulative table so each draw is one ``random.random`` plus a
    linear scan — fast enough to call once per document for millions of rows.
    """

    def __init__(self, histogram, fallback):
        items = [(v, float(w)) for v, w in histogram.items() if float(w) > 0]
        if not items:
            items = [(fallback, 1.0)]
        total = sum(w for _, w in items)
        acc, self.cum = 0.0, []
        for value, weight in items:
            acc += weight / total
            self.cum.append((acc, value))

    def draw(self):
        """Return one value, sampled in proportion to its weight."""
        r = random.random()
        for threshold, value in self.cum:
            if r <= threshold:
                return value
        return self.cum[-1][1]


def _step(cls, n):
    """The n-th (0-based) treebeard path segment: ``_int2str(n)`` left-padded."""
    key = cls._int2str(n)  # pylint: disable=protected-access
    return cls.alphabet[0] * (cls.steplen - len(key)) + key


def _build_forest(depth_histogram, scale):
    """Return (paths, depths, numchildren) reproducing the depth histogram.

    Level 1 becomes the roots; every deeper level's nodes are scattered at
    random over the previous level, which yields a natural breadth spread (many
    leaves, a few high-fan-out parents) whose *totals per depth* match the
    profile exactly. Breadth average therefore matches; the numchild tail is
    approximated, which is immaterial to the endpoints' cost.
    """
    cls = models.Document
    levels = {
        int(d): max(0, int(round(int(n) * scale))) for d, n in depth_histogram.items()
    }
    if levels.get(1, 0) == 0:
        # A tree must have roots; seed at least one if the profile scaled to zero.
        levels[1] = max(1, levels.get(1, 0))
    max_depth = max(levels)

    paths, depths, numchildren = [], [], []
    prev_paths, prev_index = [], []  # prev_index -> position in numchildren

    # Roots
    for i in range(levels.get(1, 0)):
        prev_paths.append(_step(cls, i))
        prev_index.append(len(paths))
        paths.append(prev_paths[-1])
        depths.append(1)
        numchildren.append(0)

    for depth in range(2, max_depth + 1):
        count = levels.get(depth, 0)
        if count == 0 or not prev_paths:
            prev_paths, prev_index = [], []
            continue
        per_parent = [0] * len(prev_paths)
        cur_paths, cur_index = [], []
        for _ in range(count):
            pi = random.randrange(len(prev_paths))
            child_path = prev_paths[pi] + _step(cls, per_parent[pi])
            per_parent[pi] += 1
            cur_index.append(len(paths))
            cur_paths.append(child_path)
            paths.append(child_path)
            depths.append(depth)
            numchildren.append(0)
        for local_i, made in enumerate(per_parent):
            numchildren[prev_index[local_i]] = made
        prev_paths, prev_index = cur_paths, cur_index

    return paths, depths, numchildren


def _sample_count(mean, cap):
    """A non-negative integer with expectation ~mean, capped at ``cap``."""
    if mean <= 0 or cap <= 0:
        return 0
    value = int(round(random.gauss(mean, math.sqrt(mean))))
    return max(0, min(cap, value))


class Command(BaseCommand):  # pylint: disable=too-many-instance-attributes
    """Synthesise a same-shaped Docs dataset from a volumetry profile."""

    help = __doc__

    def __init__(self, *args, **kwargs):
        """Declare the run-scoped state shared across the generation steps."""
        super().__init__(*args, **kwargs)
        self.profile = {}
        self.counts = {}
        self.scale = 1.0
        self.worst_email = WORST_CASE_EMAIL
        self.docs_queue = None
        self.rel_queue = None
        self.user_ids = []
        self.doc_ids = []
        self.worst_id = None
        self.n_users = 0
        self.n_docs = 0

    def add_arguments(self, parser):
        """Define command arguments."""
        parser.add_argument(
            "-p",
            "--profile",
            required=True,
            help="Path to a profile_volumetry JSON file.",
        )
        parser.add_argument(
            "--scale",
            type=float,
            default=1.0,
            help="Multiply every count by this factor (default: 1.0 = production size).",
        )
        parser.add_argument(
            "--seed",
            type=int,
            default=0,
            help="RNG seed for reproducible runs (default: 0).",
        )
        parser.add_argument(
            "--worst-case-email",
            default=WORST_CASE_EMAIL,
            help=f"Email of the seeded worst-case user (default: {WORST_CASE_EMAIL}).",
        )
        parser.add_argument(
            "--no-attachments",
            action="store_true",
            help="Skip attachment-key generation (media_auth load testing needs them).",
        )
        parser.add_argument(
            "-f",
            "--force",
            action="store_true",
            help="Run despite DEBUG=False and/or a non-empty document table.",
        )

    def handle(self, *args, **options):
        """Read the profile and generate the dataset."""
        if not settings.DEBUG and not options["force"]:
            raise CommandError(
                "Refusing to run outside DEBUG. This writes a large synthetic "
                "dataset; only run it on a throwaway staging DB, with --force."
            )
        if models.Document.objects.exists() and not options["force"]:
            raise CommandError(
                "The document table is not empty. This command expects a fresh "
                "database (path collisions, skewed counts otherwise). Reset the "
                "staging database first, or pass --force to append anyway."
            )

        with open(options["profile"], encoding="utf-8") as handle:
            self.profile = json.load(handle)

        self.scale = options["scale"]
        self.counts = self.profile["counts"]
        self.worst_email = options["worst_case_email"]
        random.seed(options["seed"])

        # Two queues: strict for the entities we author from scratch (a path bug
        # must surface), tolerant for the relation tables (the odd duplicate
        # (user, document) pair is expected and harmless).
        self.docs_queue = BulkQueue(self.stdout)
        self.rel_queue = BulkQueue(self.stdout, ignore_conflicts=True)

        self._create_users()
        self._create_documents()
        self._create_accesses()
        self._grant_worst_case()
        self._seed_pairs(
            models.DocumentFavorite,
            mean=self._mean("favorites_per_user", "favorites"),
            label="favorites",
        )
        self._seed_pairs(
            models.LinkTrace,
            mean=(self.counts["link_traces"] / max(1, self.n_users)),
            label="link traces",
        )
        if not options["no_attachments"]:
            self._seed_attachments()
        self._report()

    def _scaled(self, n):
        """Scale a production count by --scale, never below zero."""
        return max(0, int(round(int(n) * self.scale)))

    def _create_users(self):
        """Create the user population plus one designated worst-case user."""
        self.n_users = max(1, self._scaled(self.counts["users"]))
        self.stdout.write(f"Creating {self.n_users} users", ending="")
        for i in range(self.n_users):
            self.docs_queue.push(
                models.User(
                    sub=f"vol-{i:d}",
                    email=f"user.vol{i:d}@{DOMAIN}",
                    admin_email=f"user.vol{i:d}@{DOMAIN}",
                    password="!",
                    is_active=True,
                    is_first_connection=False,
                )
            )
        worst_user = models.User(
            sub="vol-worst-case",
            email=self.worst_email,
            admin_email=self.worst_email,
            password="!",
            is_active=True,
            is_first_connection=False,
        )
        self.docs_queue.push(worst_user)
        self.docs_queue.flush()
        self.stdout.write(" done")
        self.user_ids = list(models.User.objects.values_list("id", flat=True))
        self.worst_id = worst_user.id

    def _create_documents(self):
        """Insert the whole document forest with computed treebeard paths."""
        self.stdout.write("Building tree shape", ending="")
        paths, depths, numchildren = _build_forest(
            self.profile["depth_histogram"], self.scale
        )
        self.stdout.write(f" -> {len(paths)} documents; inserting", ending="")
        reach = Picker(
            self.profile.get("link_reach", {}), models.LinkReachChoices.RESTRICTED
        )
        link_role = Picker(
            self.profile.get("link_role", {}), models.LinkRoleChoices.READER
        )
        for path, depth, numchild in zip(paths, depths, numchildren, strict=True):
            self.docs_queue.push(
                models.Document(
                    id=uuid4(),
                    path=path,
                    depth=depth,
                    numchild=numchild,
                    title=f"doc-{path}",
                    link_reach=reach.draw(),
                    link_role=link_role.draw(),
                    creator_id=random.choice(self.user_ids),
                )
            )
        self.docs_queue.flush()
        self.stdout.write(" done")
        del paths, depths, numchildren  # free the in-memory forest before the joins
        self.doc_ids = list(models.Document.objects.values_list("id", flat=True))
        self.n_docs = len(self.doc_ids)

    def _create_accesses(self):
        """Create accesses: per-document count centred on the profiled mean.

        Distinct users per document (so no duplicate (user, document)); a slice
        made team-based to match the observed team share; roles drawn from the
        profiled mix. Per-user counts fall out ~Poisson, as in reality.
        """
        counts = self.counts
        mean_per_doc = (
            counts["accesses"] / counts["documents"] if counts["documents"] else 0
        )
        team_share = (
            counts["accesses_team_based"] / counts["accesses"]
            if counts.get("accesses")
            else 0
        )
        role = Picker(
            self.profile.get("role_distribution", {}), models.RoleChoices.READER
        )
        self.stdout.write("Creating accesses", ending="")
        for doc_id in self.doc_ids:
            k = _sample_count(mean_per_doc, cap=min(len(self.user_ids), 200))
            if not k:
                continue
            for uid in random.sample(self.user_ids, k):
                if random.random() < team_share:
                    self.rel_queue.push(
                        models.DocumentAccess(
                            document_id=doc_id,
                            user=None,
                            team=f"team-{random.randint(0, max(1, self.n_users // 5)):d}",
                            role=role.draw(),
                        )
                    )
                else:
                    self.rel_queue.push(
                        models.DocumentAccess(
                            document_id=doc_id, user_id=uid, role=role.draw()
                        )
                    )
        self.rel_queue.flush()
        self.stdout.write(" done")

    def _grant_worst_case(self):
        """Give the worst-case user a deliberately large readable set.

        readable_per_se already hands this user every non-restricted document;
        on top of that we give them direct OWNER access to a wide sample so the
        role annotation and id-list paths are stressed as in the incident.
        """
        worst_target = min(
            self.n_docs,
            self._scaled(
                self.profile["worst_case_readable_per_se"]["max_accesses_per_user"]
            ),
        )
        if not worst_target:
            return
        self.stdout.write(
            f"Granting the worst-case user ({self.worst_email}) direct access to "
            f"{worst_target} documents",
            ending="",
        )
        for doc_id in random.sample(self.doc_ids, worst_target):
            self.rel_queue.push(
                models.DocumentAccess(
                    document_id=doc_id,
                    user_id=self.worst_id,
                    role=models.RoleChoices.OWNER,
                )
            )
        self.rel_queue.flush()
        self.stdout.write(" done")

    def _mean(self, dist_key, count_key):
        """Prefer the profiled per-user mean; fall back to total/users."""
        dist = self.profile.get(dist_key)
        if dist and dist.get("mean"):
            return float(dist["mean"])
        return self.counts.get(count_key, 0) / (self.counts["users"] or 1)

    def _seed_pairs(self, model, mean, label):
        """Create ~mean rows per user of a (user, document) relation model."""
        if mean <= 0 or not self.doc_ids:
            return
        self.stdout.write(f"Creating {label}", ending="")
        for uid in self.user_ids:
            k = _sample_count(mean, cap=min(len(self.doc_ids), 500))
            if not k:
                continue
            for doc_id in random.sample(self.doc_ids, k):
                self.rel_queue.push(model(user_id=uid, document_id=doc_id))
        self.rel_queue.flush()
        self.stdout.write(" done")

    def _seed_attachments(self):
        """Stamp synthetic attachment keys onto a sample of documents.

        Keys follow the real ``<document_id>/attachments/<uuid>.<ext>`` shape so
        the ``attachments @> [key]`` GIN lookup behaves as in production. The S3
        objects are never created; media_auth's queries precede head_object.
        """
        att = self.profile.get("attachments", {})
        target_docs = self._scaled(att.get("documents_with_attachments", 0))
        if not target_docs:
            return
        max_per = max(1, int(att.get("max_per_document", 1)))
        ids = list(
            models.Document.objects.filter(attachments=[]).values_list("id", flat=True)
        )
        random.shuffle(ids)
        chosen = ids[:target_docs]
        self.stdout.write(f"Stamping attachments on {len(chosen)} documents", ending="")
        for i, doc_id in enumerate(chosen):
            n = random.randint(1, max_per)
            keys = [f"{doc_id!s}/attachments/{uuid4()!s}.pdf" for _ in range(n)]
            models.Document.objects.filter(id=doc_id).update(attachments=keys)
            if i % 5000 == 0:
                db.reset_queries()  # DEBUG query cache would grow over the loop
        self.stdout.write(" done")

    def _report(self):
        """Print a summary and how to drive load against the worst-case user."""
        self.stdout.write(self.style.SUCCESS("\nGeneration complete."))
        self.stdout.write(
            f"  scale {self.scale}  ->  {self.n_docs} documents, "
            f"{models.User.objects.count()} users, "
            f"{models.DocumentAccess.objects.count()} accesses"
        )
        self.stdout.write(
            "  Run VACUUM ANALYZE before load-testing so the planner sees the new "
            "volumetry (index vs seq-scan crossover depends on it)."
        )
        self.stdout.write(
            f"  Worst-case user: {self.worst_email} — mint a session for it (e.g. "
            "via shell force_login) and point data/logs/production/media_stress.py "
            "at a document it can reach to reproduce the herd."
        )
