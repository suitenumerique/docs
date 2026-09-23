# Swarm — websocket load generator for the collaboration server

Opens many clients on the Docs collaboration server (yhub) with the very stack
the frontend uses — `yjs`, `y-websocket`'s `WebsocketProvider` with the same
options, a `ws` socket carrying the session cookie and the origin a browser
would send — and measures what a user would feel: time to connect, time to the
first sync, and how long an edit takes to reach the other clients of the same
document. It is the collaboration half of `documentation/load-testing.md`;
the HTTP half is k6.

It is a standalone package (its own `package.json` and `yarn.lock`, not a
workspace of `src/frontend`), like `src/yhub-server`.

## Who the clients are

The swarm logs nobody in. It reads the manifest that the backend's
`create_load_test_sessions` command writes (`src/backend/loadtest`, only with
the `LoadTest` configuration): the cookie name, and per logged-in user a
session key and the documents that user may edit or read. **The manifest holds
live sessions and is a secret**: hand it to the swarm and to nothing else, and
revoke the sessions when the campaign is over.

Every client uses one session of the manifest, in turn. With more clients than
sessions a user is logged in several times, which the report warns about: the
API throttles per user, so ask for at least as many sessions as clients.

## Running it

```bash
cd src/loadtest/swarm
yarn install --frozen-lockfile && yarn build
node dist/index.js --manifest manifest.json --url wss://docs.example.com \
    --mode wide --clients 500 --ramp 20 --duration 600 --writers 0.3
```

| Option | Default | What it does |
| ------ | ------- | ------------ |
| `--manifest` | — | The manifest file. Required |
| `--url` | — | `wss://host` of the collaboration server, the ingress in a deployment. Required |
| `--origin` | `https://host` of the url | The `Origin` header. yhub refuses origins outside `COLLABORATION_SERVER_ORIGIN` |
| `--org` | `docs` | The yhub organisation (`YHUB_ORG`) |
| `--clients` | `10` | Virtual clients |
| `--ramp` | `10` | Connections opened per second |
| `--duration` | `60` | Seconds to hold once everybody is asked to connect |
| `--mode` | `wide` | `hot`: everybody on one document. `wide`: each client on a document of its own user. `idle`: `wide` with nobody writing |
| `--doc` | first public document | The document of `hot` mode |
| `--writers` | `0.3` (`0` in `idle`) | Share of the clients that edit |
| `--edit-interval` | `2000` | Milliseconds between two edits of a writer |
| `--edit-size` | `12` | Characters typed per edit |
| `--awareness-interval` | `5000` | Milliseconds between two awareness updates of a writer, `0` for none |
| `--storm-at` | `0` | Second of the hold at which every client drops its socket and reconnects (with `--reconnect-jitter` ms of jitter, `3000` like the frontend) |
| `--settle` | `15` | Seconds to wait after the last edit before checking convergence |
| `--metrics-port` | `9465` | Where `/metrics` is served, `0` for nowhere. `--metrics-token` requires a bearer token on it |
| `--report` | `-` | Where the JSON report goes, `-` for stdout |

Progress goes to stderr every `--progress-interval` seconds. The exit code is
`0` when every client connected at least once and every document converged.

Scenarios of the plan, as options:

| Scenario | Options |
| -------- | ------- |
| connect ramp | `--mode idle --ramp N`, raise N |
| idle steady state | `--mode idle --clients 10000 --duration 1800` |
| hot document | `--mode hot --clients 200 --writers 0.5 --edit-interval 500` |
| wide editing | `--mode wide --clients 3000 --writers 0.3` |
| reconnect storm | any of the above with `--storm-at 300` — or restart yhub during the hold: the clients reconnect on their own, as the frontend does |

Several swarms can run at once (one per pod) against the same manifest, each
with a distinct slice of it: split the manifest's `sessions` beforehand. The
propagation latency compares the clocks of the writer and of the reader, which
is exact inside one process and only as good as the clock sync between pods.

## What it measures

On `/metrics`, and summarised as percentiles in the report:

| Metric | What it is |
| ------ | ---------- |
| `swarm_clients{state}` | Clients by socket state |
| `swarm_connect_duration_seconds` | From asking for a connection to the socket being open. yhub authenticates the upgrade against the backend, and seeds the document under soft migration, before answering: this is what that costs |
| `swarm_sync_duration_seconds` | From the socket being open to the first sync of the document |
| `swarm_propagation_latency_seconds` | From an edit to its arrival on another client of the document |
| `swarm_edits_total`, `swarm_updates_received_total` | Edits made, updates received |
| `swarm_ws_messages_total{direction}`, `swarm_ws_bytes_total{direction}` | Websocket traffic |
| `swarm_reconnects_total`, `swarm_ws_closes_total{code}` | Reconnections, and why the sockets closed |
| `swarm_upgrade_failures_total{status}` | Upgrades the server refused, by http status (a `503` is yhub not reaching the backend) |
| `nodejs_*` | The swarm's own runtime: past a point the load generator saturates before the server does, and its event-loop lag says so |

The report also holds the convergence check: after `--settle` seconds, every
client of a document must hold the same content. Documents that do not are
listed under `convergence.diverged`.

## What it writes into the documents

Edits go into a `Y.Text` and a `Y.Map` of the document that the editor does not
render (`loadtest-text`, `loadtest-stamps`): the server persists and fans them
out like any content. A document a swarm wrote to keeps those types in its
history. **Only run this against anonymised data**, never against a document
someone uses.

## Container

```bash
docker build -f src/loadtest/swarm/Dockerfile -t docs-swarm .
docker run --rm -v ./manifest.json:/manifest.json:ro docs-swarm \
    --manifest /manifest.json --url wss://docs.example.com --clients 100
```

In a cluster, run it as a Job on nodes that do not host the application, going
through the ingress like a browser would.

## Development

```bash
yarn typecheck && yarn lint && yarn test
```

The tests run a small y-websocket protocol server in-process
(`__tests__/_server.ts`) — no yhub, no store — and drive a real swarm against
it: cookies, origin, edits, propagation, convergence, storms, refused upgrades.
