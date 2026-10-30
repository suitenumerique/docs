---
name: docs-e2e-test
description: Work on end-to-end tests for La Suite Docs using Playwright. Use this skill when creating, modifying, debugging, or reviewing E2E tests, especially under src/frontend/apps/e2e/__tests__/app-impress. Prefer focused Chromium tests, reuse existing utilities and existing tests before creating new code, and avoid running the full E2E suite unless explicitly necessary.
---

# Docs E2E tests

The Playwright tests live in `src/frontend/apps/e2e/__tests__/app-impress`.
E2E tests are the most expensive tests of the repository: keep the suite
small, run as little of it as possible, and only on Chromium.

## Run

1. The backend must be running: `make run-backend` (see the `docs-start`
   skill).
2. Install only Chromium, once: `yarn install-playwright chromium`, from
   `src/frontend/apps/e2e`.
3. Run the narrowest scope, from `src/frontend/apps/e2e`:

   ```bash
   yarn test __tests__/app-impress/<file>.spec.ts --project=chromium -g "<test name>"
   ```

   From `src/frontend`, `yarn e2e:test` takes the same arguments.

- Playwright reads `apps/e2e/.env` (`BASE_URL=http://localhost:3000`) and
  starts the frontend itself with `yarn app:dev`, or reuses whatever already
  answers on :3000.
- The global setup (`auth.setup.ts`) signs in with the seeded Keycloak users
  and saves their session.
- If tests fail with HTTP 429, the throttling of the dev backend is too low:
  the CI raises it by appending `env.d/development/common.e2e` to
  `env.d/development/common.local`. Locally, remove those lines afterwards:
  they would keep overriding the dev limits on every later backend run.
- Never run Firefox or WebKit (`--project=firefox|webkit`,
  `yarn test:ui::firefox|webkit`) unless asked. Never run the whole suite
  (`yarn test` with no file) unless asked, or after a change to the shared E2E
  setup.
- For debugging, `yarn test:ui::chromium` opens the UI mode.

Widen only when needed: one test, then its spec file, then closely related
specs.

## Reuse before writing

Search the existing specs and `utils-*.ts` for the feature, its UI labels and
a similar workflow before writing any Playwright code. The helpers often hold
the synchronization a test needs (waiting for a PATCH, a save, a URL change, a
collaborative update): do not replace them with the bare clicks.

| file | helpers |
|---|---|
| `utils-common.ts` | `createDoc`, `goToGridDoc`, `updateDocTitle`, `verifyDocName`, `overrideConfig`, `mockedDocument`, `mockedListDocs`, `openHeaderMenu`, `clickInDocOptionMenu`, `randomName` |
| `utils-editor.ts` | `getEditor`, `writeInEditor`, `openSuggestionMenu`, `mockAIResponse` |
| `utils-share.ts` | `addNewMember`, `updateShareLink`, `updateRoleUser`, `connectOtherUserToDoc` |
| `utils-signin.ts` | `SignIn`, `logOut`, `expectLoginPage` |
| `utils-sub-pages.ts` | `createRootSubPage`, `addChild`, `getTreeRow`, `navigateToPageFromTree` |
| `utils-export.ts` | `overrideDocContent`, `comparePDFWithAssetFolder` |

When a helper almost fits, give it a sensible optional argument rather than
copying it into the test. Do not turn a helper into a catch-all with
unrelated options.

## Add as little as possible

1. Can an existing test assert the new behaviour cheaply and still read well?
   Extend it.
2. Does the behaviour need E2E at all? A Vitest test next to the component, or
   a backend test, is often enough. E2E is for user workflows and
   frontend/backend integration: editing, sharing and permissions,
   collaboration, sub-pages, sign-in, export.
3. Otherwise, add a focused test to the existing spec of the feature. Create a
   new spec file only when no feature file fits.

Do not re-assert the setup (sign-in, document creation) in every test, and do
not repeat a scenario that differs from an existing one by a single action.

## Write reliable tests

- Selectors: `getByRole`, `getByLabel`, `getByText`, then `getByTestId`. No
  generated classes, DOM paths or indexes. Do not add a `data-testid` when an
  accessible selector is stable.
- Waits: web-first assertions (`await expect(locator).toBeVisible()`),
  awaited responses or URL changes. No `waitForTimeout` to fix a race, even
  if older tests do it.
  - One legitimate exception: the version history groups edits by a time
    window (60 s by default) keyed on timestamps set by yhub, so `page.clock`
    cannot shorten it. Shrink it with
    `overrideConfig(page, { COLLABORATION_VERSION_GRANULARITY_MS: '2000' })`
    and wait a real `waitForTimeout` longer than it between edits, as
    `doc-version.spec.ts` does.
- Independence: a test never depends on another one or on its order, and
  creates only the data it needs (`randomName` avoids collisions).
- Collaboration: use `connectOtherUserToDoc` and wait for the visible result
  of the remote edit, never a fixed delay.
- A flaky test is a bug: find the missing synchronization point (missing
  `await`, unawaited request, unstable selector, shared data) instead of
  raising a timeout.

## Before finishing

- `yarn lint` in `src/frontend/apps/e2e`.
- Review `git diff`: no unrelated test changed, helpers reused, no new sleep,
  no duplicated scenario.
- Report the tests reused, modified or created (and why a new one was
  needed), the exact commands run, that only Chromium was used, and what was
  not verified. Never claim the whole suite or another browser passed without
  running it.
