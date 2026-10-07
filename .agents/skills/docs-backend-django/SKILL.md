---
name: docs-backend-django
description: Work safely and efficiently on the Django backend of La Suite Docs. Use this skill when modifying Python/Django backend code, API endpoints, serializers, permissions, models, migrations, Celery tasks, database queries, tests, or backend configuration.
------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# Docs Django Backend

## description: Work safely and efficiently on the Django backend of La Suite Docs. Use this skill when modifying Python/Django backend code, API endpoints, serializers, permissions, models, migrations, Celery tasks, database queries, tests, or backend configuration.

# Docs Django Backend

Use this skill whenever working on the Django backend of La Suite Docs.

The backend source code lives in:

```text
src/backend/
```

The main development Docker Compose service is:

```text
app-dev
```

Inside this container, the backend is mounted at:

```text
/app
```

The development Django configuration is:

```text
DJANGO_CONFIGURATION=Development
```

The backend application is exposed locally on:

```text
http://localhost:8071
```

## Prefer project commands

Do not invent Docker, pytest, Django, lint, or migration commands when an existing Make target already exists.

Prefer the repository Makefile because it encapsulates the correct Docker user, environment, volumes, configuration, and service dependencies.

Before introducing a new development command, check whether an equivalent Make target already exists.

## Starting the backend

To start the backend and its required services:

```bash
make run-backend
```

This starts the backend-related stack, including the Django application and supporting services.

To inspect service status:

```bash
make status
```

To follow Django application logs:

```bash
make logs
```

Avoid running a second Django development instance manually when `app-dev` is already running unless there is a specific reason.

## Django container

The main Django service is:

```text
app-dev
```

For exceptional commands not covered by the Makefile, use:

```bash
docker compose exec app-dev <command>
```

For example:

```bash
docker compose exec app-dev python manage.py check
```

However, prefer existing Makefile targets whenever possible.

## Running Django management commands

The Makefile runs management commands through an ephemeral `app-dev` container with the expected development environment.

Available project commands include:

```bash
make migrate
make makemigrations
make shell
make dbshell
make superuser
```

Use these instead of directly invoking `python manage.py` from the host.

If an uncommon management command is needed, follow the same project convention:

```bash
docker compose run --rm app-dev python manage.py <command>
```

## Tests

Backend tests should be executed through the project's test commands.

### Run the whole backend test suite

Prefer:

```bash
make test
```

This currently runs backend tests in parallel.

Equivalent explicit command:

```bash
make test-back-parallel
```

The project uses pytest with automatic parallel execution for the complete suite.

### Run specific tests

Use:

```bash
make test-back <pytest arguments>
```

Examples:

```bash
make test-back tests/test_documents.py
```

```bash
make test-back tests/test_documents.py::test_example
```

```bash
make test-back -k permission
```

When implementing or fixing backend behavior:

1. run the most relevant focused tests first;
2. fix any failure;
3. run the broader affected test module;
4. run the full backend suite when appropriate.

Do not repeatedly run the entire test suite while iterating on a small change if a focused pytest invocation can validate it faster.

## Linting and formatting

The backend lint command is:

```bash
make lint
```

It runs the repository's backend linting pipeline.

The pipeline currently includes:

```text
ruff format
ruff check --fix
pylint
```

Individual targets are also available:

```bash
make lint-ruff-format
make lint-ruff-check
make lint-pylint
```

Important: some lint commands modify files automatically.

In particular:

```bash
ruff format .
ruff check . --fix
```

Therefore inspect the resulting diff after running lint.

Before considering a backend task complete:

```bash
make lint
```

and run the relevant tests.

## Database

The development PostgreSQL service is:

```text
postgresql
```

It listens internally on:

```text
postgresql:5432
```

and is exposed from the host on:

```text
localhost:15432
```

Prefer Django ORM access unless direct SQL inspection is useful.

For a database shell:

```bash
make dbshell
```

Do not assume schema changes are harmless.

When changing Django models:

1. determine whether a migration is required;
2. run:

```bash
make makemigrations
```

3. inspect the generated migration;
4. check that it only contains the intended changes;
5. consider production migration safety;
6. test the migration when appropriate.

Never commit an unintended migration generated by unrelated local model changes.

## Migration safety

For migrations, consider production consequences rather than only whether the migration succeeds locally.

Check for:

* long table locks;
* table rewrites;
* expensive data migrations;
* adding non-null fields to populated tables;
* expensive index creation;
* uniqueness constraints on existing data;
* backwards compatibility during rolling deployment;
* code depending on the new schema before all instances have migrated.

Keep schema migrations and large data transformations separate when that reduces operational risk.

## Django ORM

Be particularly careful with query behavior.

Look for:

* N+1 queries;
* queries inside loops;
* repeated `.exists()`, `.count()` or `.first()` calls;
* accidentally evaluating the same queryset several times;
* fetching full objects when IDs or limited fields are sufficient;
* missing `select_related`;
* missing `prefetch_related`;
* unbounded querysets;
* expensive ordering/filtering without suitable indexes.

Do not add `select_related` or `prefetch_related` mechanically. Verify that the relationship is actually traversed and that the optimization reduces queries.

For potentially expensive endpoints, reason about how query count scales with the number of documents, users, organizations, or accesses.

## Transactions and concurrency

Docs is a collaborative application and may receive concurrent requests for the same resources.

When a backend change performs multiple related writes, consider whether it requires:

```python
transaction.atomic()
```

Also reason about:

* concurrent updates;
* stale reads;
* duplicate requests;
* retries;
* idempotency;
* uniqueness constraints;
* Celery retries;
* multiple backend replicas;
* race conditions between checks and writes.

Do not assume a sequence such as:

```python
if not object_exists():
    create_object()
```

is safe under concurrency.

Prefer enforcing critical invariants at the database level when appropriate.

## Permissions

Permissions are a critical part of Docs backend changes.

Never rely on frontend checks for authorization.

For every new or changed endpoint, determine:

* who can read the resource;
* who can modify it;
* who can delete it;
* whether anonymous access is allowed;
* whether public/share-link access changes behavior;
* whether organization or workspace boundaries apply.

Check object-level permissions, not only authentication.

When an object ID comes from a request, make sure a user cannot substitute another valid ID and access a resource they do not own or cannot access.

Prefer filtering the queryset according to permissions over retrieving an unrestricted object and checking too late.

Permission-related changes should generally have explicit tests.

At minimum, consider tests for:

```text
authorized user
unauthorized authenticated user
anonymous user
different organization/workspace
read-only user
```

where applicable.

## API changes

When modifying Django REST API behavior, inspect:

* serializer validation;
* writable/read-only fields;
* optional vs required fields;
* `null` vs missing values;
* defaults;
* HTTP status codes;
* error response shape;
* backwards compatibility;
* pagination;
* permission classes;
* object lookup behavior.

If frontend code already consumes the endpoint, search for its usages before changing its contract.

Avoid silently changing response structures used by existing clients.

## Models

When modifying Django models:

* preserve domain invariants;
* prefer explicit constraints when they protect data integrity;
* consider indexes for new common lookup patterns;
* avoid putting surprising network or heavy side effects in model methods;
* consider deletion behavior and related objects;
* review `on_delete` semantics;
* consider whether nullable fields are actually desirable.

For uniqueness or consistency requirements, prefer database constraints over application-only checks when possible.

## Celery

The development worker runs in:

```text
celery-dev
```

It uses the same backend development image as Django.

When creating or changing Celery tasks, consider:

* retries;
* duplicate execution;
* idempotency;
* partial failure;
* transaction boundaries;
* task execution before a database transaction is committed;
* serialization of task arguments;
* stale model state;
* worker restarts.

Avoid passing large serialized model structures to tasks.

Prefer stable identifiers and reload the current state inside the worker.

When scheduling a task as part of a database transaction, consider whether it needs to be triggered only after commit.

## Redis

The development Redis service is:

```text
redis
```

Be cautious when using Redis for correctness-critical state.

Treat caches as disposable unless the architecture explicitly guarantees otherwise.

Avoid relying exclusively on cached data for authorization or durable application state.

## Object storage

The development environment uses MinIO.

Services involved include:

```text
minio
createbuckets
```

When changing file or object-storage behavior, consider:

* failed uploads;
* failed database writes after uploads;
* orphaned objects;
* deletion consistency;
* retries;
* permissions;
* untrusted filenames;
* content types;
* object size.

Do not assume local filesystem behavior represents production object storage behavior.

## Backend architecture

Before implementing new behavior:

1. search for an existing equivalent pattern;
2. inspect nearby views, serializers, services, models, permissions and tests;
3. follow existing project conventions where they are sound;
4. avoid creating a new abstraction when an existing one fits.

Prefer small, focused changes over broad refactoring unless the task explicitly requires architectural work.

Do not move unrelated code while implementing a feature or bug fix.

## Testing expectations

New behavior should normally include tests when it changes observable backend behavior.

Prioritize tests for:

* permissions;
* API behavior;
* validation;
* domain invariants;
* regression bugs;
* concurrency-sensitive operations where feasible;
* failure paths;
* Celery task behavior;
* migrations when they contain meaningful logic.

Avoid tests that merely reproduce Django or library behavior.

Test project-specific behavior.

## Debugging

When debugging a backend problem:

1. reproduce the issue;
2. inspect the relevant logs;
3. identify the request/task execution path;
4. inspect related tests;
5. inspect database state if needed;
6. form a concrete hypothesis;
7. make the smallest change that addresses the cause;
8. run focused tests;
9. run lint;
10. review the final diff.

Do not start refactoring before the root cause is understood.

## Before finishing a backend task

Review:

```bash
git diff
```

Check that no unrelated files were modified.

Then run appropriate focused tests.

When practical, run:

```bash
make lint
```

and:

```bash
make test-back <relevant tests>
```

For significant backend changes, also consider:

```bash
make test
```

Before presenting the result, summarize:

* what changed;
* important implementation decisions;
* tests executed;
* linting executed;
* anything not verified.

Never claim tests or lint passed unless they were actually executed successfully.

If new setting is added the documentation should be updated accordingly: `/documentation/env.md`
