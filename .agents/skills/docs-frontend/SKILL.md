---
name: docs-frontend
description: Work safely and efficiently on the Next.js frontend of La Suite Docs (src/frontend/apps/impress). Use this skill when modifying React components, hooks, API calls, TanStack Query, Zustand stores, the BlockNote editor, i18n strings, the service worker or offline behaviour, styles, or Vitest tests of the frontend.
---

# Docs frontend

The app lives in `src/frontend/apps/impress` (a Yarn workspace of
`src/frontend`): Next.js with the **pages router** (`src/pages/`), exported
statically, React, TanStack Query, Zustand, BlockNote, and the La Suite design
system (`@gouvfr-lasuite/ui-components`, Cunningham, Mantine for BlockNote).
Read the versions in `package.json`: they move faster than any document.
The `@/` alias points to `src/`.

## Commands

From `src/frontend/apps/impress`:

| task | command |
|---|---|
| one test file | `yarn vitest run <path>` |
| tests importing a file | `yarn vitest related <path> --run` (broad for shared modules) |
| lint the files you touched | `yarn eslint <files>` |
| type check | `yarn tsc --noEmit` |
| everything, once at the end | `yarn lint` (tsc + eslint), `yarn test` |
| format | `yarn prettier`, `yarn stylelint` |

`yarn dev` serves the app on :3000 against the backend on :8071 (see the
`docs-start` skill). `yarn build` also runs `prettier --check` and stylelint.

### Without yarn on the host

When `command -v yarn` fails, run the same commands from the repository root
in the frontend image: it ships yarn and the dependencies, and its working
directory is `apps/impress`, so the paths do not change.

```bash
docker compose exec frontend-development yarn vitest run <path>   # container running
DOCKER_USER=$(id -u):$(id -g) docker compose run --rm --no-deps \
  frontend-development sh -c 'yarn vitest run <path> && yarn eslint <files> && yarn tsc --noEmit'
```

- Prefer `exec` into the running container. Each `run` copies `node_modules`
  into a fresh volume (about 20 s), so chain the checks in one `sh -c`, and
  pass `DOCKER_USER` as the Makefile does so written files stay yours.
- After a `package.json` or `yarn.lock` change, rebuild the image
  (`make build-frontend`), then renew the `node_modules` volumes of a running
  `frontend-development` container (`--renew-anon-volumes`, see the
  `docs-start` skill): `exec` and `make run` keep the old ones.
- `make frontend-test`, `make frontend-lint` and `make run-frontend-development`
  call yarn on the host. Run `yarn test` in the image, and serve the frontend
  with its container, not `yarn dev`: `make run`, or
  `DOCKER_USER=$(id -u):$(id -g) docker compose up -d frontend-development`
  when the backend already runs.
- `make frontend-lint` covers five workspaces: `yarn lint` in the frontend
  image (impress) and in `y-provider-development-converter` (y-provider),
  `yarn workspace eslint-plugin-docs run lint` in the frontend image with
  `-w /home/frontend`, and `npx --no-install eslint` from `src/frontend/apps/e2e`
  and `src/frontend/packages/i18n`, which no image holds: without Node and
  `src/frontend/node_modules` on the host, report those two as not run.
- The `frontend-i18n-*` targets, and so the frontend half of `make i18n-*`,
  need yarn on the host (the i18n scripts call it themselves): without it, say
  so and do not run them. `make back-i18n-*` and `crowdin-*` still work.

## Where things are

- `src/features/<feature>/` holds one feature: `api/` (fetchers and query
  hooks), `components/`, `hooks/`, `stores/`, `types`, `__tests__/`, and an
  `index.ts` that re-exports its public API. The document features are under
  `src/features/docs/` (`doc-editor`, `doc-management`, `doc-share`,
  `doc-tree`, `doc-versioning`, `doc-comments`, `doc-export`…).
- `src/components/`: shared primitives (`Box`, `Text`, `Icon`, `DropButton`,
  `modal/`, `dropdown-menu/`, `quick-search/`). Reuse them before adding a new
  one; a change there affects every caller.
- `src/api/`: `fetchAPI` (base URL, CSRF token, credentials), `APIError` and
  `errorCauses`, `fetchCollaborationApi` for yhub's REST routes.
- `src/stores/`: global Zustand stores (`useBroadcastStore` for cross-tab
  sync, `useFocusStore`, `useResponsiveStore`).
- `src/features/service-worker/`: offline support.

## Conventions

- **Code quality**: DRY, KISS, and the Docs code standard (`AGENTS.md`, and
  the code around yours). Reuse an existing component, hook or helper before
  writing a new one, and add an abstraction only for a second real use.
- **Server state** goes through TanStack Query, following
  `features/docs/doc-management/api/useDoc.tsx`: a plain fetcher on
  `fetchAPI` that throws `APIError` with `errorCauses(response)`, an exported
  `KEY_*` query key, and a hook that accepts the query options. A mutation
  invalidates the keys it affects (`queryClient.invalidateQueries`), including
  the lists and the doc tree when a document changes.
- **Rights**: show or enable an action from the `abilities` the backend
  returns with the object (`doc.abilities.update`…), never from a role computed
  on the client. The backend enforces them anyway.
- **Client state** in a Zustand store only when several components share it;
  otherwise keep it local.
- **i18n**: every user-visible string, `aria-label` and announcement goes
  through `const { t } = useTranslation()`, and every `t()` call carries a
  `description` giving the translator the context (what it is, where it is
  shown): `t('Search', { description: 'Placeholder of a search input' })`.
  Add it to the `t()` calls you write or touch, not to the whole file. Never
  edit `translations.json`: it is pulled from Crowdin.
- **Styles**: the `$css` and layout props of `Box`/`Text`, and the Cunningham
  tokens, rather than hard-coded colours or sizes.
- Accessibility of a new or changed interaction: follow the
  `docs-accessibility-review` skill.

## Pitfalls

- **Editor**: check the installed BlockNote API (`node_modules/@blocknote/*`,
  or `/home/frontend/node_modules/@blocknote/*` in the frontend image when
  nothing is installed locally) before using one from memory; it changes between minor versions. Custom
  blocks live in `features/docs/doc-editor/components/custom-blocks/`; some
  wrap a BlockNote spec to sanitize legacy content (`CodeBlock.tsx`).
- **Collaboration**: the document content is a Yjs document synchronized with
  yhub (`features/docs/doc-management/stores/useProviderStore.tsx`), not a
  field fetched from the API. Never write content through the REST API, and
  never let a remote change move the local user's focus or selection.
- **Offline**: the service worker caches the API answers and queues the
  document mutations made offline (`service-worker-api.ts`,
  `plugins/ApiPlugin.ts`). When you add or change a `documents/` endpoint or
  its response, check whether it is cached or replayed there, and keep the
  shape compatible with what is already stored in the browser (`DocsDB`).
- **Controlled `DropdownMenu`**: with `isOpen` controlled, `onOpenChange`
  does not fire on open, only on Escape, an outside click or an item chosen.
  Update anything that tracks the open state from the trigger handler.
- **Next.js**: pages router and a static export: no server components, no API
  routes, no `getServerSideProps`.

## Tests

- Vitest + Testing Library + `fetch-mock`, in a `__tests__/` folder next to
  the code (`*.test.ts(x)`). Render with the `AppWrapper` of
  `src/tests/utils.tsx` (it provides the query client), mock the API with
  `fetchMock.mockGlobal()` and the URL `http://test.jest/api/v1.0/...`, and
  reset it in `beforeEach` (see
  `features/docs/doc-management/api/__tests__/useCreateChildDoc.test.tsx`).
- Query elements by role and accessible name (`getByRole`, `getByLabelText`).
- A Vitest test is the default for a component or hook; an E2E test only for a
  user workflow across the backend, and only when asked (see the
  `docs-e2e-test` skill).

## Before finishing

Run the tests of the files you changed, `yarn eslint` on them and
`yarn tsc --noEmit` (in the frontend image without yarn on the host), review
`git diff`, and add a `CHANGELOG.md` entry under `[Unreleased]` for a
user-visible change. Report what was run and what was not verified.
