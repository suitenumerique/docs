---

name: docs-e2e-test
description: Work on end-to-end tests for La Suite Docs using Playwright. Use this skill when creating, modifying, debugging, or reviewing E2E tests, especially under src/frontend/apps/e2e/**tests**/app-impress. Prefer focused Chromium tests, reuse existing utilities and existing tests before creating new code, and avoid running the full E2E suite unless explicitly necessary.
------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# Docs E2E Tests

Use this skill whenever working on end-to-end tests for La Suite Docs.

The main Impress E2E tests live in:

```text
src/frontend/apps/e2e/__tests__/app-impress
```

The E2E application uses Playwright.

The relevant package is:

```text
src/frontend/apps/e2e
```

## Core principles

E2E tests are expensive.

They consume significantly more CPU, memory, browser resources, CI resources, and execution time than lower-level tests.

Therefore:

1. do not run the entire E2E test suite by default;
2. run the smallest relevant subset of tests;
3. test only with Chromium unless explicitly requested otherwise;
4. reuse existing test utilities before writing custom Playwright code;
5. reuse or improve existing tests before creating new tests;
6. avoid duplicating scenarios already covered elsewhere;
7. only add a new E2E test when it provides meaningful coverage that cannot reasonably fit into an existing scenario.

The goal is not to maximize the number of E2E tests.

The goal is to maintain high-value coverage with the smallest, fastest and most maintainable E2E suite possible.

## Chromium only

The Docs E2E suite currently targets Chromium for development and validation.

Do not run Firefox or WebKit.

Do not run:

```bash
yarn test:ui::firefox
yarn test:ui::webkit
```

Do not add Firefox- or WebKit-specific validation unless explicitly requested.

When a Playwright project needs to be specified, use:

```bash
--project=chromium
```

For example:

```bash
yarn test __tests__/app-impress/<relevant-test>.spec.ts --project=chromium
```

or:

```bash
yarn test __tests__/app-impress/<relevant-test>.spec.ts \
  --project=chromium \
  -g "test name"
```

Do not spend development resources checking cross-browser compatibility unless the project's browser coverage policy changes.

## Do not run all E2E tests by default

Do not use:

```bash
yarn test
```

without restricting its scope unless there is a specific reason.

Running the whole Playwright suite is heavy for the development machine and should not be used as the default validation strategy.

When implementing or debugging a change:

1. identify the relevant existing test file;
2. run only that test file;
3. when possible, run only the relevant test with `-g`;
4. run it on Chromium only;
5. widen the test scope only when necessary.

Prefer:

```bash
yarn test __tests__/app-impress/<relevant-test>.spec.ts \
  --project=chromium \
  -g "relevant test name"
```

Then, if useful:

```bash
yarn test __tests__/app-impress/<relevant-test>.spec.ts \
  --project=chromium
```

Use actual existing filenames and test names found in the repository.

Do not invent test paths.

## Search before writing

Before creating or modifying E2E code, inspect the existing tests and utilities under:

```text
src/frontend/apps/e2e/__tests__/app-impress
```

Search for:

* the feature name;
* relevant UI labels;
* similar user workflows;
* existing test cases;
* existing fixtures;
* existing utility functions;
* authentication helpers;
* document helpers;
* editor helpers;
* sharing helpers;
* sub-page helpers;
* mocking helpers.

Do not immediately start writing Playwright instructions from scratch.

First understand how equivalent operations are already implemented in the E2E suite.

## Reuse existing utilities

The E2E suite already contains utilities for common workflows.

Use them whenever they match the required behavior.

Before implementing custom Playwright interactions, inspect the relevant `utils-*` files.

Existing utilities include areas such as:

```text
utils-common
utils-editor
utils-export
utils-share
utils-signin
utils-sub-pages
```

Examples of existing capabilities include:

* creating documents;
* navigating documents;
* updating document titles;
* saving editor content;
* opening header menus;
* overriding frontend configuration;
* mocking documents and API responses;
* interacting with the editor;
* writing content into the editor;
* opening editor suggestion menus;
* signing users in and out;
* configuring sharing;
* adding members;
* changing member roles;
* connecting another user to a collaborative document;
* working with sub-pages;
* export/PDF helpers.

Before writing something like:

```ts
await page.getByRole(...).click();
await page.waitForResponse(...);
await page.getByLabel(...).fill(...);
```

check whether an existing utility already encapsulates that workflow.

Prefer:

```ts
await createDoc(...);
```

over reimplementing document creation.

Prefer:

```ts
await SignIn(...);
```

over manually reproducing authentication.

Prefer:

```ts
await writeInEditor(...);
```

or the appropriate editor utility over duplicating editor-specific selectors.

Prefer:

```ts
await updateShareLink(...);
```

over duplicating the sharing workflow.

## Improve utilities when appropriate

If several tests require behavior that is almost covered by an existing utility, consider extending that utility instead of introducing slightly different implementations in multiple tests.

For example, prefer evolving:

```text
createDoc(...)
```

with a sensible optional argument when the new behavior is genuinely part of document creation, rather than creating:

```text
createSpecialDoc(...)
createAnotherDoc(...)
createDocForFeatureX(...)
```

with mostly duplicated implementations.

However, do not turn utilities into large generic abstractions with many unrelated options.

A utility should represent a clear reusable E2E operation.

## Do not duplicate utility logic inside tests

Avoid copying code from a utility into a test merely because the test needs a small variation.

Instead:

1. check whether the existing utility already supports the scenario;
2. determine whether the utility can be safely improved;
3. reuse the utility where appropriate;
4. only write custom logic when the behavior is genuinely specific to the test.

When custom logic is necessary, keep it local unless it becomes reusable.

## Prefer existing tests

Before creating a new test case or test file:

1. search existing tests for the same feature;
2. identify whether the workflow is already partially covered;
3. determine whether the new assertion can fit naturally into that scenario;
4. prefer extending the existing test when it remains readable.

Avoid creating a second E2E scenario that repeats:

```text
sign in
→ create document
→ open document
→ navigate somewhere
→ perform one slightly different action
```

when the existing scenario can validate the additional behavior cheaply and clearly.

## Minimize suite growth

Every additional E2E test has a permanent cost:

* execution time;
* CI time;
* CPU;
* memory;
* browser resources;
* setup time;
* maintenance;
* debugging;
* flakiness surface.

Before adding a test, ask:

```text
Can this behavior be verified by improving an existing E2E test?
```

If yes, prefer that.

Then ask:

```text
Does this behavior really need E2E coverage?
```

Some behavior is better covered through:

* frontend unit tests;
* component tests;
* backend tests;
* API tests.

E2E tests should focus on important user-visible workflows and integration boundaries.

## Keep tests focused

A good E2E test should represent a meaningful user workflow.

Prefer coverage such as:

* creating and editing a document;
* permissions and access behavior;
* sharing;
* collaboration;
* sub-pages;
* authentication;
* important editor functionality;
* critical navigation;
* frontend/backend integration.

Avoid using E2E tests to verify implementation details.

## Keep tests independent

Tests should not depend on their execution order.

A test should not require another test to run first.

Avoid shared mutable state between tests unless the existing architecture explicitly requires it.

Create only the state necessary for the scenario.

## Avoid expensive UI setup when appropriate

Use existing helpers and setup mechanisms to avoid repeatedly executing UI flows that are unrelated to what the test validates.

For example, a test about editor behavior does not necessarily need to independently test every step of authentication and document creation.

Reuse the established helpers.

However, do not bypass a UI workflow if that workflow is itself what the test needs to validate.

## Playwright selectors

Follow the selectors already used by the E2E suite.

Prefer semantic selectors such as:

```text
getByRole
getByLabel
getByText
getByTestId
```

Avoid fragile selectors based on:

* generated classes;
* DOM hierarchy;
* styling;
* arbitrary indexes.

Do not introduce a new `data-testid` automatically if an existing accessible selector is stable enough.

## Assertions and waits

Prefer Playwright's observable conditions and auto-waiting.

Prefer:

```ts
await expect(element).toBeVisible();
```

over:

```ts
await page.waitForTimeout(2000);
```

Do not add arbitrary sleeps as the first solution to synchronization problems.

Some existing tests or helpers may contain `waitForTimeout`. Do not copy that pattern automatically into new tests.

One legitimate exception: the version history groups edits into versions by a time window (60 s by default), keyed on timestamps set by the yhub server, so `page.clock` cannot shorten it. Shrink the window with `overrideConfig(page, { COLLABORATION_VERSION_GRANULARITY_MS: '2000' })` and wait a real `waitForTimeout` longer than it between edits, as `doc-version.spec.ts` does.

If a deterministic event, request, element state, URL change, or response can be awaited instead, prefer that.

## Respect synchronization utilities

Some existing utilities encode important synchronization behavior.

For example, a helper may wait for:

* a backend PATCH;
* a document save;
* a grid reload;
* a URL transition;
* a collaborative update.

Do not bypass such utilities by reproducing only the visible interactions.

The synchronization behavior may be the reason the helper exists.

Understand an existing helper before replacing it with seemingly simpler Playwright commands.

## Collaborative editing

Docs is a collaborative application.

When testing multiple users or real-time editing, consider:

* initial synchronization;
* WebSocket propagation;
* concurrent changes;
* reconnect behavior;
* async document updates;
* presence/awareness;
* stale editor state.

Reuse existing collaboration helpers when available.

Do not add fixed delays to approximate collaborative synchronization when an observable state can be awaited.

## Flakiness

Treat flaky tests as problems to investigate.

Look for:

* missing awaits;
* race conditions;
* API completion;
* asynchronous UI updates;
* WebSocket synchronization;
* unstable selectors;
* test data collisions;
* leaked state;
* eventual consistency.

Do not hide flakes by blindly increasing timeouts or adding sleeps.

Find the synchronization point.

## Debugging tests

When debugging a failing test:

1. run only the failing test;
2. run it with Chromium;
3. reproduce the failure;
4. inspect whether the problem is in the application or test;
5. inspect existing helpers;
6. fix the underlying issue;
7. rerun the same test;
8. optionally run closely related tests.

Do not rerun the full E2E suite after every modification.

## UI mode

The package exposes Playwright UI mode.

For Chromium:

```bash
yarn test:ui::chromium
```

Use UI mode when it materially helps investigate a failing or flaky test.

Do not start Firefox or WebKit UI modes.

## Linting

The E2E package provides:

```bash
yarn lint
```

Run linting for E2E code when practical.

Do not run unrelated repository-wide linting solely because an E2E test changed.

## When modifying an existing test

Prefer the smallest coherent change.

Do not reorganize unrelated test scenarios.

If an existing test naturally covers the new behavior, extend it.

If adding the behavior would make the scenario confusing or mix unrelated workflows, creating a separate test can be justified.

## When creating a new test

A new test should be justified by at least one of:

* no existing scenario covers the workflow;
* extending an existing test would significantly harm readability;
* the behavior is an important independent user journey;
* independent failure reporting is valuable;
* the setup or permissions differ substantially;
* it represents a regression that deserves explicit isolated coverage.

Before creating a new `.spec.ts` file, check whether the test belongs in an existing feature file.

Prefer:

```text
existing spec + new focused test
```

over:

```text
new spec file
```

unless a new file is genuinely warranted.

## Avoid over-testing

Do not repeatedly assert common setup behavior in every scenario.

If document creation is used as setup, every test that creates a document does not need to fully validate document creation again.

Focus assertions on the behavior the test is intended to protect.

## Keep execution efficient

While writing or reviewing tests, look for:

* redundant authentication;
* redundant document creation;
* duplicate navigation;
* unnecessary browser contexts;
* duplicate scenarios;
* unnecessary expensive setup.

Reuse utilities to remove such duplication.

Do not optimize by introducing shared mutable state or dependencies between tests.

Reliability remains more important than saving a few seconds.

## Before finishing an E2E task

Review:

```bash
git diff
```

Check that:

* no unrelated tests were modified;
* existing utilities were reused where appropriate;
* existing tests were extended where appropriate;
* no duplicate scenario was introduced;
* no unnecessary new helper was introduced;
* selectors are stable;
* arbitrary sleeps were not introduced unnecessarily.

Then run the smallest relevant test on Chromium.

Prefer:

```bash
yarn test __tests__/app-impress/<relevant-test>.spec.ts \
  --project=chromium \
  -g "relevant test"
```

If needed, run the whole relevant spec:

```bash
yarn test __tests__/app-impress/<relevant-test>.spec.ts \
  --project=chromium
```

Do not run the entire E2E suite solely to report that all tests pass.

Run the full suite only when:

* explicitly requested;
* shared E2E infrastructure changed significantly;
* global setup changed;
* a broad validation is specifically justified.

Even in that case, use Chromium only unless explicitly instructed otherwise.

Before presenting the result, summarize:

* which existing tests were reused or modified;
* which utilities were reused or changed;
* whether a new test was created and why;
* which exact tests were executed;
* confirmation that Chromium was used;
* linting performed;
* anything not verified.

Never claim the complete E2E suite passes unless it was actually executed.

Never claim Firefox or WebKit compatibility was verified unless explicitly tested.
