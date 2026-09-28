---
name: docs-pr-review
description: Review pull requests and code changes in La Suite Docs. Use when reviewing a PR, branch, diff, or set of changes in the Docs repository. Focus on correctness, regressions, security, permissions, collaborative editing/Yjs behavior, API contracts, database performance, frontend behavior, concurrency, deployment risks, and missing tests. Produce a concise review prioritizing actionable issues over style comments.
---

# Docs PR review

Review as a senior engineer who knows the Docs architecture (see `AGENTS.md`).
Find the real problems: bugs, regressions, security holes, data loss,
production performance, deployment failures. One real bug is worth more than
ten speculative comments. Do not modify code unless asked.

## 1. Understand the change

- For a PR, read the title, description, commits and diff
  (`gh pr view <n>`, `gh pr diff <n>`). For a branch, diff against the merge
  base with its target (`git merge-base`), not only the last commit.
- Work out the intent, then which areas it touches: backend, frontend, API
  contract, permissions, collaboration (yhub), Celery, storage, deployment,
  tests.
- Read the surrounding code before reporting: another layer may already
  handle the case.

## 2. What to check

**Correctness first**: edge cases, null, empty or missing values, error and
fallback paths, partial failures that leave an inconsistent state, retries,
stale state, accidental behaviour changes.

**Permissions.** The backend is the source of truth; the frontend and yhub
only follow it.

- Rights come from `get_abilities(user)` (`core/models.py`), enforced by
  `core/api/permissions.py`. They combine the accesses of the document and of
  its ancestors (direct or through a team, roles reader → owner) with the
  link reach (restricted, authenticated, public) and link role, also
  inherited. Check every new or changed action against an anonymous user, an
  authenticated user without access, each role, each link reach, and a
  sub-page whose ancestor grants more or less.
- yhub asks the backend (`GET /users/me/`, `GET /documents/{id}/`,
  `GET /documents/{id}/accesses/me/`) on every connection and recheck, and
  caches the answer (`src/yhub-server/src/authz-cache.ts`). A change to the
  abilities, or to an access, changes what the websocket allows: check that a
  revoked user loses access.
- An ID taken from the request must not reach another user's object; prefer
  filtering the queryset over checking after the fetch. No secret or personal
  data in responses or logs.
- For user content: unsafe HTML, URLs, file names and types, SSRF from
  user-supplied URLs. Report a security issue only with a plausible path, and
  describe it.

**Collaboration (yhub).** The content of a document lives only in yhub: the
backend has no `Document.content` and reaches it through `YHubService`. yhub
replicas are stateless and exchange updates through Valkey streams; a worker
compacts them into its PostgreSQL, then calls
`POST /documents/{id}/content-updated/`. Look for:

- an update lost or applied twice, or initialization overwriting an existing
  document;
- an assumption that holds only with a single replica or a sticky session;
- a backend path that writes content without going through `YHubService`, or
  a synchronous yhub call added to a hot request path;
- offline: what the service worker caches and replays (`y-indexeddb`, queued
  mutations).

Do not report normal CRDT convergence as a race.

**Backend**: N+1 queries or queries in loops, unbounded querysets, a missing
index for a new frequent lookup, related writes outside `transaction.atomic`,
check-then-create races, non-idempotent Celery tasks. Migrations: safe for a
rolling deployment (no long lock or rewrite, no non-null column without a
default, no code relying on the schema before every instance has migrated).

**Frontend**: stale state and closures, wrong effect dependencies, duplicated
sources of truth, TanStack Query keys and invalidation, optimistic updates
without rollback, loading, empty, error and disabled states, rights changing
while the page is open. Accessibility: use the `docs-accessibility-review`
skill for anything beyond the obvious.

**API contract**: both sides agree on field names, nullability, enums, status
codes and error shape; an old frontend can talk to a new backend during a
deployment.

**Configuration and deployment**: safe defaults, a disabled feature flag keeps
the old behaviour, Helm values and `@param` annotations updated, no secret
committed.

## 3. Docs conventions

Report these as **Minor** unless they break something:

- `CHANGELOG.md`: an entry under `[Unreleased]`,
  `- <gitmoji>(type) description`, 80 characters per line at most.
- Commits: `<gitmoji>(type) lowercase title` with a body explaining why.
- `translations.json` is generated from Crowdin: never edited by hand. User
  strings go through `_()` (backend) or `t()` (frontend).
- A new backend setting is documented in `documentation/env.md`. A new yhub
  setting is read and validated in `src/yhub-server/src/config.ts`, with a
  test in `__tests__/config.spec.ts`.
- No document ID, user ID or path in a Prometheus metric label.
- No `print` in backend code. Backend tests use the `settings` fixture and
  mock `YHubService`.
- Load-test code stays in `src/backend/loadtest/` and off in `Production`.
- Agent docs stay in step: when the PR renames or removes a Makefile target,
  a compose service, an image, an environment variable, a script or a path,
  grep `AGENTS.md`, `.agents/skills/` and the READMEs for it and ask for them
  to be updated in the same PR. A stale command costs every later agent a
  failed run.

## 4. Tests

Look for the missing test that would catch a real regression: new behaviour,
the fixed bug, permissions, failure paths, migrations with logic, API
contracts. Say what it should check. Do not ask for tests for coverage alone,
and do not ask for E2E tests when a unit or backend test suffices.

## 5. Avoid false positives

Before reporting, confirm the path is reachable, that no other layer handles
it, and that it is a bug rather than a design you would have done
differently. No formatting or naming comments unless they create ambiguity,
and no refactor unrelated to the PR.

## 6. Report

Start with a two-line summary of the change, then the findings ordered by
severity:

- **Blocking**: security hole, data loss or corruption, outage, fundamentally
  wrong behaviour.
- **Important**: a concrete bug or regression to fix before merge.
- **Minor**: a real but low-impact issue, or a convention above.

For each finding:

**[severity] Short title**

- Location: `path/to/file.ext:line`
- Problem, and the scenario in which it happens
- Impact
- Suggested fix, in a sentence or two

If nothing meaningful is found, say "No blocking or important issue found",
then list what deserves manual verification.
