# Profiling the backend with django-silk

The backend ships an **opt-in** profiler, [django-silk](https://github.com/jazzband/django-silk),
to answer questions like *"where does `media-auth` spend its time — Postgres, S3,
or Python?"* under a realistic data volume. It records, per HTTP request:

- the **SQL** it ran, each query with its own duration and the Python stack that
  issued it (so a slow `readable_per_se` `EXISTS` points straight at the line in
  `viewsets.py`);
- a **cProfile** call graph of the request, downloadable as a binary `.prof`;
- silk's own overhead, so you can subtract it.

It is **disabled by default and absent from every environment that does not opt
in, production included** — when `SILK_ENABLED` is unset, `silk` is not in
`INSTALLED_APPS`, its middleware is not installed, and `/silk/` is not routed.

> ⚠️ **Never enable silk against production with real users.** It persists
> request metadata to the database. Enable it only on an isolated environment —
> local dev, or a throwaway staging database populated with synthetic volumetry
> (see [Reproducing production volumetry](#reproducing-production-volumetry)).
> Request and response **bodies are never stored** (`SILKY_MAX_*_BODY_SIZE = 0`),
> so document content, titles and emails cannot leak into the silk tables.

## Enabling it

Set `SILK_ENABLED=1` in the backend environment and run silk's migrations once:

```bash
# in the backend container / environment
export SILK_ENABLED=1
python manage.py migrate silk
```

Then restart the backend so the middleware is picked up. The profiling UI is
served at **`/silk/`**, gated behind an authenticated **staff** session
(`SILKY_AUTHENTICATION` / `SILKY_AUTHORISATION`). Create one if needed:

```bash
python manage.py createsuperuser
```

All knobs are environment variables (defaults in `documentation/env.md`):

| Variable | Purpose | Default |
| --- | --- | --- |
| `SILK_ENABLED` | Master switch | `False` |
| `SILK_PYTHON_PROFILER` | cProfile each request | `True` |
| `SILK_PYTHON_PROFILER_BINARY` | Also emit a downloadable `.prof` | `True` |
| `SILK_INTERCEPT_PERCENT` | Sample only N % of requests | `100` |
| `SILK_MAX_RECORDED_REQUESTS` | Ring-buffer cap on stored requests | `10000` |

Under load (a thundering-herd reproduction), lower `SILK_INTERCEPT_PERCENT`
(e.g. `5`) so silk records a representative sample without becoming the
bottleneck itself, and keep `SILK_MAX_RECORDED_REQUESTS` bounded so a long run
cannot fill the disk.

## Analysing a request in the UI

1. Reproduce the traffic (open a document, or run a load test — see below).
2. Open `/silk/`, sort **Requests** by *Time* or *Overall time*.
3. Click the slow request:
   - **SQL** tab — every query with its duration and the *join / N+1* summary.
     Click a query to see its `EXPLAIN`-free timing and the **stack trace** back
     into our code.
   - **Profile** tab — the cProfile breakdown (cumulative/total time per
     function), the fastest way to see the Python↔DB↔S3 split.

## Analysing the binary `.prof` offline

With `SILK_PYTHON_PROFILER_BINARY=True`, each request's cProfile is also written
as a binary `.prof`, **through the Django storage framework** rather than the
local disk. It is stored via the `SILKY_STORAGE` entry of the `STORAGES` setting,
which points at the S3 backend under the `silk/` prefix — so profiling works on
read-only / ephemeral Kubernetes pods where there is no writable filesystem.

Download the `.prof` from the request's **Profile** tab in the UI (silk serves it
back out of object storage), then open it with any standard tool:

```bash
# interactive flame-ish call graph in the browser
pip install snakeviz && snakeviz <request>.prof

# or the stdlib, sorted by cumulative time
python -m pstats <request>.prof <<< "sort cumulative
stats 30"
```

To point the binaries at a different bucket/backend, override the `SILKY_STORAGE`
entry in `STORAGES` (any Django storage backend works).

## Cleaning up stored profiles

Silk's ring-buffer (`SILK_MAX_RECORDED_REQUESTS`) prunes the request rows in the
database, but it does **not** delete the corresponding `.prof` objects, so they
accumulate in storage. Reclaim the space with:

```bash
python manage.py purge_silk_profiles --dry-run    # preview orphans
python manage.py purge_silk_profiles              # delete orphaned profiles
python manage.py purge_silk_profiles --all        # wipe every profile
python manage.py purge_silk_profiles --older-than 7   # only >7 days old
```

By default it deletes only **orphans** (profiles no longer referenced by any
`silk.Request` row), which is always safe. `--all` is required — and is the only
mode available — when silk is disabled, since there are then no rows to compare
against. Everything goes through the `SILKY_STORAGE` backend, so it works on
filesystem-less pods.

## Profiling a code block directly (no HTTP)

To profile a specific path without going through nginx/DRF — handy for the
`media-auth` authorization logic, which normally runs as an nginx subrequest —
wrap it with silk's context manager or decorator; it appears under **Profiling**
in the UI:

```python
from silk.profiling.profiler import silk_profile

with silk_profile(name="media_auth authorization"):
    ...  # the code under test
```

## Reproducing production volumetry

Silk shows *where* time goes; it only tells the truth if the database has a
production-shaped volume. The incident class we chase (`media-auth` under a large
readable set) does not reproduce on an empty staging DB. Rebuild the shape from a
value-free profile — **without copying any production data** — then profile
against it:

```bash
# 1. On a read replica: capture the shape (counts + distributions only, no PII)
python manage.py profile_volumetry --output volumetry/prod.json

# 2. On the throwaway profiling DB: synthesize a same-shaped dataset
python manage.py generate_volumetry --profile volumetry/prod.json --scale 1.0

# 3. Enable silk, drive traffic (or the media-auth load tool), read /silk/
```

Alternatively, anonymize a real production dump in an isolated database with
`anonymize_database` and profile against that. See those commands' `--help` for
details.
