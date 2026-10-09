# k6 — HTTP load scenarios for the backend

The HTTP half of `documentation/load-testing.md`: what a browser asks the
Django backend when a user opens a document, and the endpoints that call the
collaboration server or walk a subtree inside one request. The websocket half is
`../swarm`.

Plain [k6](https://grafana.com/docs/k6/) scripts, no build step, no
dependencies: the `grafana/k6` image runs them as they are.

## Who the virtual users are

The scripts log nobody in. They read the manifest that the backend's
`create_load_test_sessions` command writes (`src/backend/loadtest`, only with
the `LoadTest` configuration): the cookie name, and per logged-in user a session
key and the documents that user may edit or read. **The manifest holds live
sessions and is a secret**: hand it to k6 and to nothing else, and revoke the
sessions when the campaign is over.

Each VU keeps the session of its rank. With more VUs than sessions a user is
logged in several times, and the API throttles per user (80 requests a minute
on the document endpoints): ask for at least as many sessions as VUs.

Unsafe requests carry Django's double-submit CSRF pair (a `csrftoken` cookie and
the same value in `X-CSRFToken`) and the `Origin` of the application, which has
to be one of the backend's `CSRF_TRUSTED_ORIGINS`.

## Running

```bash
docker run --rm -v ./src/loadtest/k6:/k6:ro -v ./manifest.json:/manifest.json:ro \
    -e MANIFEST=/manifest.json -e BASE_URL=https://docs.example.com \
    -e RATE=50 -e DURATION=10m -w /k6 grafana/k6 run scenarios/page-open.js
```

| Variable | Default | What it is |
| -------- | ------- | ---------- |
| `MANIFEST` | `/manifest.json` | The manifest file |
| `BASE_URL` | `http://localhost:8071` | Where the API is, without `/api/v1.0` |
| `ORIGIN` | `BASE_URL` | The frontend's origin, for CSRF. `http://localhost:3000` in the dev stack |
| `MEDIA_BASE_URL` | `https://docs.example.com` | The host of the media urls `media-auth` is asked about |

### `scenarios/page-open.js` — the HTTP baseline (plan, scenario 2)

The sequence the frontend runs when a document is opened: `config/`,
`users/me/`, `documents/{id}/`, `documents/{id}/tree/`, `documents/?page=1`,
and the `media-auth` subrequest nginx makes when the page loads an attachment.
A rate-based scenario: `RATE` page opens per second (5 to 6 requests each),
ramped up over `RAMP` (default `1m`), held for `DURATION` (default `5m`),
ramped down. `VUS` (default `4 × RATE`, at least 10) bounds the concurrency
when the API slows down: past it, iterations are dropped and
`dropped_iterations` says so.

Run it against the current release and against this branch, on the same data,
with the same options: what differs is what the new architecture costs on the
HTTP side.

The `media-auth` call names a file the bucket does not hold: the access check
— the costly part, an access check over the document tree — runs, and
the answer is a 403 once it has passed. That status is expected and not counted
as a failure.

### `scenarios/heavy.js` — the synchronous endpoints (plan, scenario 9)

`VUS` (default 5) users, for `DURATION` (default `5m`), each looping on:
`duplicate` of one of their documents with its descendants (two collaboration
server round-trips per node, inside a transaction), `formatted-content` of the
copy, then delete, restore and delete of the copy (each a Celery task walking
the subtree), and the creation of a document from a markdown file (converted,
then handed to the collaboration server) which is deleted too.

The users' own documents are only read. What an iteration creates it deletes,
but a deleted document stays in the trash for the retention period: the
database grows by one subtree per iteration for as long as that lasts.

## Reading the results

Every request is tagged with a `name` free of identifiers
(`documents/{id}/`, not the url), so the per-endpoint percentiles k6 prints are
one series per endpoint. Thresholds are set in each script; k6 exits non-zero
when one is crossed.

To see the run next to the server-side metrics, send k6's metrics to the
Prometheus of the campaign:

```bash
-e K6_PROMETHEUS_RW_SERVER_URL=http://prometheus:9090/api/v1/write \
grafana/k6 run -o experimental-prometheus-rw scenarios/page-open.js
```

## Where to run it

Like the swarm: in the cluster, on nodes that do not host the application,
through the ingress. A k6 process drives a few hundred requests a second
comfortably; past that, run several with distinct slices of the manifest's
`sessions`.
