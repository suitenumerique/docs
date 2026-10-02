---

name: docs-pr-review
description: Review pull requests and code changes in La Suite Docs. Use when reviewing a PR, branch, diff, or set of changes in the Docs repository. Focus on correctness, regressions, security, permissions, collaborative editing/Yjs behavior, API contracts, database performance, frontend behavior, concurrency, deployment risks, and missing tests. Produce a concise review prioritizing actionable issues over style comments.
------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# Docs PR Review

Review the current pull request or code changes as a senior engineer familiar with the Docs architecture.

The goal is to identify real problems that could cause bugs, regressions, security issues, data corruption, performance degradation, deployment failures, or maintainability problems.

Do not modify the code unless explicitly asked.

Avoid low-value style comments and subjective preferences.

## 1. Understand the change

Before reviewing individual lines:

1. Determine what the PR is trying to achieve.
2. Identify the components affected.
3. Inspect the surrounding implementation when necessary.
4. Understand the existing architecture before suggesting a different approach.
5. Determine whether the change affects:

   * frontend
   * backend
   * API contracts
   * PostgreSQL
   * permissions
   * authentication
   * collaborative editing
   * Yjs / WebSocket infrastructure
   * asynchronous processing
   * storage
   * deployment/configuration
   * tests

When a GitHub PR is available, inspect its title, description, commits, and diff.

When reviewing local changes without a PR, inspect the branch and diff against the appropriate base branch.

Do not review the diff in isolation when surrounding code is necessary to determine whether something is actually wrong.

## 2. Prioritize correctness

Look for concrete bugs first.

Check for:

* incorrect assumptions
* broken edge cases
* invalid state transitions
* race conditions
* concurrency problems
* missing error handling
* incorrect fallback behavior
* inconsistent frontend/backend behavior
* accidental behavior changes
* backwards compatibility issues
* partial failures leaving inconsistent state
* incorrect handling of null, missing, empty, or unexpected values

Be particularly cautious when code appears correct for the happy path but can fail under retries, concurrent users, network failures, or stale state.

## 3. Security and permissions

Docs is a collaborative application handling user-controlled documents.

Pay special attention to authorization boundaries.

Check that:

* authentication and authorization are distinct where necessary
* backend endpoints enforce permissions independently from the frontend
* access to a document is checked server-side
* organization/workspace/document boundaries cannot be crossed
* IDs supplied by users cannot expose another user's resources
* new API routes use appropriate permission classes/checks
* write operations cannot be performed with read-only access
* anonymous/public/share-link behavior is intentional
* permission changes cannot leave stale elevated access
* sensitive information is not exposed through API responses or logs

For user-controlled content, also consider:

* injection
* unsafe HTML
* URL handling
* file handling
* SSRF-like behavior
* command execution
* template injection
* unsafe redirects

Only report a security issue when there is a plausible attack or authorization path. Explain that path.

## 4. Django / backend

For backend changes, inspect:

### API behavior

* request validation
* response shape
* HTTP status codes
* error behavior
* backwards compatibility
* serialization/deserialization
* permission enforcement

### Database access

Look for:

* N+1 queries
* queries inside loops
* missing `select_related` / `prefetch_related`
* unnecessary queries
* inefficient existence/count checks
* loading large querysets into memory
* missing indexes for new access patterns
* expensive filters or sorts
* changes that increase transaction duration

### Transactions and concurrency

Check:

* whether related writes should be atomic
* race conditions between read and update
* uniqueness assumptions
* retries
* idempotency
* locking behavior
* duplicate jobs/events

Pay extra attention to code that can run concurrently across multiple application instances.

### Migrations

For migrations, consider:

* locking
* table rewrites
* large data migrations
* backwards compatibility during rolling deployments
* adding non-null columns
* indexes created on large tables
* application code depending immediately on a migration

## 5. Collaborative editing / Yjs

Treat collaborative state as distributed state.

When changes touch Yjs, collaborative editing, providers, WebSockets, or document synchronization, explicitly reason about:

* two users editing simultaneously
* reconnect after temporary network loss
* duplicate messages
* reordered messages
* client reload
* provider restart
* multiple provider instances
* stale client state
* retry behavior
* persistence failures
* awareness/presence state
* document initialization
* synchronization between stored document state and live Yjs state

Look for situations where:

* an update can be lost
* an update can be applied twice incorrectly
* server state and client state diverge
* initialization overwrites an existing document
* reconnection produces stale content
* assumptions only hold with one application instance

Do not flag normal CRDT behavior as a race condition without understanding the Yjs semantics involved.

## 6. Frontend

For React / Next.js / TypeScript changes, review:

### State

Check for:

* stale state
* stale closures
* incorrect effect dependencies
* duplicated sources of truth
* race conditions between requests
* optimistic updates without correct rollback
* cache invalidation problems
* state updates after navigation/unmount
* assumptions about request ordering

### TanStack Query

When applicable, inspect:

* query keys
* invalidation
* enabled conditions
* stale/cache behavior
* optimistic mutations
* rollback
* duplicate requests
* server/client consistency

### React

Look for:

* unnecessary effects
* effects used to derive state
* unstable dependencies
* remounts caused by unstable keys
* unnecessary rerenders when they are significant
* broken controlled/uncontrolled behavior
* incorrect memoization assumptions

Do not recommend memoization without a concrete reason.

### User experience

Consider:

* loading states
* empty states
* error states
* disabled states
* permissions changing while the page is open
* keyboard interaction where relevant
* accessibility regressions
* mobile/responsive regressions when relevant

## 7. API contract changes

When frontend and backend communicate through modified APIs:

Verify both sides agree about:

* field names
* optional vs required fields
* nullability
* enums
* error responses
* pagination
* status codes
* defaults
* backwards compatibility

Be alert to deployment situations where old frontend code can temporarily communicate with new backend code or vice versa.

## 8. Performance

Only report performance issues that have a realistic impact.

Look especially for:

* DB queries scaling with document count or user count
* repeated API calls
* expensive work performed on every render/request
* serialization of unnecessarily large payloads
* loading entire documents when partial information is sufficient
* WebSocket message amplification
* repeated collaborative-state conversions
* synchronous work added to latency-sensitive paths
* unbounded loops, collections, caches, or queues

Distinguish theoretical micro-optimizations from issues that can matter in production.

## 9. Configuration and deployment

For Docker, Helm, Kubernetes, environment variables, CI/CD, or deployment-related changes, check:

* safe defaults
* missing environment variables
* configuration differences between environments
* backwards compatibility during rolling deployments
* readiness/liveness behavior
* startup failures
* resource assumptions
* service discovery
* secrets handling
* feature flags
* rollback behavior

For feature flags:

* disabled behavior should preserve existing behavior
* frontend and backend flags should remain compatible
* partially rolled-out deployments should be considered

## 10. Tests

Determine whether the change is adequately tested.

Look for missing tests around:

* newly introduced behavior
* bug regressions
* permissions
* failure paths
* concurrency-sensitive behavior
* API contracts
* feature flags
* migrations
* collaborative editing behavior

Do not request tests merely for coverage.

Explain what behavior should be tested and what regression the test would prevent.

## 11. Avoid false positives

Before reporting an issue:

1. Inspect the relevant surrounding code.
2. Check whether another layer already handles it.
3. Confirm that the problematic execution path is actually reachable.
4. Consider framework behavior before assuming custom handling is required.
5. Distinguish a bug from a possible alternative design.

Do not report an issue solely because you would have implemented it differently.

Do not suggest broad refactors unrelated to the PR.

Do not comment on formatting or naming unless it creates ambiguity or a maintainability problem.

## 12. Review output

Start with a short summary of what the change does.

Then report findings ordered by severity.

Use these severities:

### Blocking

A problem likely to cause:

* security vulnerability
* data loss or corruption
* major production outage
* fundamentally incorrect behavior

### Important

A concrete bug or regression worth fixing before merge.

### Minor

A real but lower-impact issue.

For each finding provide:

**[severity] Short title**

* Location: `path/to/file.ext:line`
* Problem: explain what is wrong.
* Scenario: describe how the problem can actually happen.
* Impact: describe the consequence.
* Suggested fix: give a concise direction for fixing it.

Whenever possible, point to exact files and lines.

If there are no meaningful issues, say explicitly:

> No blocking or important issue found.

Then optionally mention areas that deserve manual verification.

## Review principles

A good review should have a high signal-to-noise ratio.

Prefer finding one real production bug over writing ten speculative comments.

Prioritize:

1. security and authorization
2. data integrity
3. correctness
4. concurrency and collaboration
5. production regressions
6. API compatibility
7. performance
8. tests
9. maintainability

Be concise, specific, and actionable.
