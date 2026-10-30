---
name: docs-backend-django
description: Work safely and efficiently on the Django backend of La Suite Docs. Use this skill when modifying Python/Django backend code, API endpoints, serializers, permissions, models, migrations, Celery tasks, database queries, tests, or backend configuration.
---

# Docs Django backend

The backend lives in `src/backend/` and runs in the `app-dev` compose service
(mounted on `/app`, `DJANGO_CONFIGURATION=Development`, API on
http://localhost:8071). The Celery worker is `celery-dev`, on the same image.

## Commands

Use the Makefile and the `bin/` wrappers: they set the Docker user, the
environment and the configuration. Never call `python manage.py` from the host.

| task | command |
|---|---|
| start the backend services | `make run-backend` (`make status`, `make logs`) |
| management command | `./bin/manage <command>` (e.g. `./bin/manage check`) |
| migrations | `make makemigrations`, `make migrate` |
| shells | `make shell`, `make dbshell` (PostgreSQL on `localhost:15432`) |
| tests, all | `./bin/pytest -n auto` |
| tests, focused | `./bin/pytest -n auto path/to/test.py::test_name -x -q --tb=short` |
| lint, files you touched | `docker compose run --rm app-dev ruff check <files>` |
| lint, all | `make lint` (ruff format, ruff check --fix, pylint) |

- `bin/pytest` runs pytest in `app-dev` with `DJANGO_CONFIGURATION=Test` and
  accepts every pytest option.
- `make lint` rewrites files (`ruff format`, `ruff check --fix`): review the
  diff afterwards. `make lint-pylint` only checks the files changed from
  `origin/main`, so fetch it first.

Run the focused tests first, then the affected module, and the full suite only
once at the end.

## Docs specifics

- **The content of a document is not in the database.** It lives in the
  collaboration server (yhub) and is read and written through
  `core/services/yhub_services.py` (`YHubService`). There is no
  `Document.content`.
- **Permissions** are computed by `get_abilities(user)` on each model
  (`Document`, accesses, invitations, comments…) and enforced by the classes of
  `core/api/permissions.py` (`DocumentPermission` maps the action to an
  ability). A document's rights come from the document and all its ancestors
  in the tree:
  - the user's accesses, direct or through a team, the highest role winning
    (`get_role`, `RoleChoices`: reader, commenter, editor, administrator,
    owner);
  - the link reach and role (`LinkReachChoices`: restricted, authenticated,
    public; `ancestors_link_definition`, `computed_link_reach`);
  - soft deletion: a document under a deleted ancestor (itself included)
    answers 404 to everyone but its owner, and to everyone once the trashbin
    cutoff is past.

  The abilities are serialized to the frontend, and yhub reads them from
  `GET /documents/{id}/` to accept or refuse a connection
  (`src/yhub-server/src/authz-cache.ts`): changing one changes what both allow.
- **New setting**: read it in `impress/settings.py` and document it in
  `documentation/env.md`. In `post_setup`, change lists and dicts in place, as
  a reassignment is ignored.

## Tests

- Tests are split per endpoint and action:
  `core/tests/documents/test_api_documents_<action>.py`. Glob for the file
  before creating one.
- Build data with `core/factories.py`.
- Mock yhub, never call it. The `yhub_content` fixture of
  `core/tests/conftest.py` fakes `YHubService.get_ydoc`; patch the other
  `YHubService` methods the same way. Celery tasks run inline
  (`CELERY_TASK_ALWAYS_EAGER=True` in `Test`).
- Use the `settings` fixture of pytest-django, not `override_settings`.
- Pin the query count of list and detail endpoints with
  `django_assert_num_queries`, as the existing tests do.
- For a permission change, cover anonymous, authenticated without access, each
  relevant role, and each link reach.

## Checklist

- **Queries**: no N+1 or query in a loop; `select_related` and
  `prefetch_related` only where the relation is actually traversed; no
  unbounded queryset; an index for a new frequent lookup.
- **Writes**: `transaction.atomic()` around related writes; no
  check-then-create race (use a constraint or `get_or_create`); Celery tasks
  idempotent, given IDs rather than objects, and scheduled with
  `transaction.on_commit` when they depend on the transaction.
- **Authorization**: never trust the frontend; filter the queryset by what the
  user may see rather than checking after fetching; an ID from the request must
  not reach another user's object.
- **API contract**: status codes, error shape, nullable vs missing fields,
  pagination. Search the frontend for the endpoint before changing its
  response.
- **Migrations**: check that `makemigrations` generated only the intended
  change, and that it is safe for a rolling deployment: no long lock or table
  rewrite, no non-null column without a default on a populated table, no code
  depending on the schema before every instance has migrated. Keep large data
  migrations apart from schema changes.
- **Redis** is a cache: never the only copy of state or of an authorization
  decision.

## Before finishing

Review `git diff` for unrelated changes, then report what changed, the tests
and lint actually run, and what was not verified. Never claim a check passed
without running it.
