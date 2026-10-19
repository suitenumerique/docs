# Canary — a few real browsers, measuring what a user would feel

While the swarm and k6 apply load, the canary keeps a handful of real Chromium
browsers opening and editing documents through the real frontend, the real
editor and the real collaboration path, and times what a user would notice:

| Metric | What it is |
| ------ | ---------- |
| `canary_page_open_seconds` | From the navigation to the document page being visible |
| `canary_editor_ready_seconds` | From the navigation to the editor accepting input, i.e. the collaboration provider synced |
| `canary_propagation_seconds` | From a keystroke in one browser to the text showing in another browser on the same document |
| `canary_iterations_total{result}`, `canary_failures_total{step}` | Iterations, and the step the failed ones died at (`page-open`, `editor-ready`, `focus`, `propagation`) |
| `canary_console_errors_total` | Errors the pages logged |

It is the "users" board of `documentation/load-testing.md`: the swarm and k6 tell what the servers do, the canary tells what
it feels like. It is not a load generator — a few pairs of browsers, nothing
more — and it is the collaboration half's counterpart of the e2e tests, built
with the Playwright library rather than its test runner so that it can run for
hours and export metrics.

Each pair is a writer and a reader on one document. The reader keeps the
document open for the whole run, like a colleague who has the page open. Every
`--interval` seconds the writer opens the document in a new tab, waits for the
editor, types a token at the end of the document, and the reader waits for it
to show; the token is then erased. The document is left as it was found, but
the edits are in its history: **only run this against anonymised data**.

## Who the browsers are

By default the manifest that the backend's `create_load_test_sessions` command
writes (`src/backend/loadtest`, only with the `LoadTest` configuration): each
pair takes a session and opens one of that user's editable documents (or
`--doc`). The session cookie and a CSRF cookie are set on the browser context,
which is what a login would have left. **The manifest holds live sessions and
is a secret.**

`--storage-state file.json --doc <id>` runs with a Playwright storage state
instead — a real OIDC session, saved the way `src/frontend/apps/e2e`'s
`auth.setup.ts` does.

A user who has never opened Docs is shown a tour on the first document; the
canary skips it, as that user would.

## Running

```bash
cd src/loadtest/canary
yarn install --frozen-lockfile && npx playwright install --with-deps chromium && yarn build
node dist/index.js --manifest manifest.json --url https://docs.example.com \
    --pairs 3 --duration 3600 --interval 5
```

| Option | Default | What it does |
| ------ | ------- | ------------ |
| `--manifest` | — | The manifest file. Required, unless `--storage-state` |
| `--url` | — | `https://host` of the frontend. Required |
| `--pairs` | `2` | Pairs of browsers (each a writer and a reader) |
| `--duration` | `300` | Seconds to run |
| `--interval` | `5` | Seconds a pair waits between two iterations |
| `--doc` | one of the user's | The document every pair opens |
| `--timeout` | `30` | Seconds before an open, a focus or a propagation is given up on |
| `--headed` | off | Show the browsers |
| `--storage-state` | — | Playwright storage state, in place of the manifest's cookies |
| `--screenshots` | — | Directory where a screenshot of each failed iteration goes |
| `--metrics-port` | `9466` | Where `/metrics` is served, `0` for nowhere; `--metrics-token` requires a bearer token |
| `--report` | `-` | Where the JSON report goes, `-` for stdout |

Progress goes to stderr, one line per iteration. The exit code is `0` when at
least one iteration ran and none failed.

Keep it on the dev stack's `http://localhost:3000` for a local check: the
frontend served by the compose `frontend-development` container, or `yarn dev`
in `src/frontend/apps/impress`.

## Container

```bash
docker build -f src/loadtest/canary/Dockerfile -t docs-canary .
docker run --rm -v ./manifest.json:/manifest.json:ro docs-canary \
    --manifest /manifest.json --url https://docs.example.com --pairs 3
```

Run it where the swarm runs: in the cluster, on nodes that do not host the
application, through the ingress. A browser costs a few hundred MB: size the
pod for `2 × --pairs` of them.

## Development

```bash
yarn typecheck && yarn lint && yarn test
```

The tests drive a real Chromium against a page served in-process that behaves
like the editor: a skeleton, then a `contenteditable`, behind a tour to skip,
mirroring what is typed to the other tab through the server.
