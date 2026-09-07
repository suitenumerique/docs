import {
  apiError,
  createAuthPlugin,
  createAuthorize,
  createYHub,
  logger,
} from '@y/hub';
import { S3PersistenceV1 } from '@y/hub/plugins/s3';
import type { JWTPayload } from 'jose';
import { jwtVerify } from 'jose';

import { api } from './api.js';
// outbound calls to the Docs Django backend, and the keys both ends verify with
import type { BackendDocument, BackendUser } from './backend.js';
import { JWKS, backendFetch, touchDocument } from './backend.js';
import {
  ANONYMOUS_USERID,
  API_PREFIX,
  MIN_MESSAGE_LIFETIME_MS,
  ORG,
  PORT,
  POSTGRES,
  REDIS,
  REDIS_PREFIX,
  ROLE,
  RUNS_SERVER,
  RUNS_WORKER,
  S3_PERSISTENCE,
  TASK_CONCURRENCY,
  TASK_DEBOUNCE_MS,
  UUID4,
  YHUB_AUDIENCE,
  YHUB_S3_ACCESS_KEY_ID,
  YHUB_S3_BUCKET_NAME,
  YHUB_S3_ENDPOINT_URL,
  YHUB_S3_REGION_NAME,
  YHUB_S3_SECRET_ACCESS_KEY,
  allowedOrigins,
} from './config.js';
// legacy Django/S3 document store — see migration.ts and README.md
import {
  SOFT_MIGRATION,
  isPermanentFailure,
  maybeMigrate,
  migrationLog,
} from './migration.js';
// Docs' access policy as yhub permission objects — see permissions.spec.ts
import {
  adminDocumentPermissions,
  browserDocumentPermissions,
  publicGlobalPermissions,
  resolveHistoryFrom,
} from './permissions.js';
import type { AppAuthInfo, DocRef, YHub } from './yhub.js';

// Read the ad-hoc tags the error paths below switch on without trusting the
// error's runtime shape.
const errStatus = (err: unknown): number | undefined =>
  typeof err === 'object' &&
  err !== null &&
  'status' in err &&
  typeof (err as { status: unknown }).status === 'number'
    ? (err as { status: number }).status
    : undefined;
const errCode = (err: unknown): string | undefined =>
  typeof err === 'object' &&
  err !== null &&
  'code' in err &&
  typeof (err as { code: unknown }).code === 'string'
    ? (err as { code: string }).code
    : undefined;

// First access to a room yhub does not know: seed it from the legacy Django S3
// store before admitting the caller. Awaited inside the upgrade handler, so the
// post-upgrade initial sync (which merges postgres and the stream from clock 0)
// is guaranteed to include the seed.
//
// Seeding never decides whether the caller may read the document — that is the
// backend's answer alone. There are two ways this ends other than a seed:
//
//   the legacy object cannot be migrated (it does not decode) — retrying will
//     not change that, so the room opens as a new document. Refusing instead
//     would lock a document nobody can repair from the outside. Logged per
//     access, because the caller is now editing alongside legacy content that
//     stayed behind in S3.
//   the legacy store could not be reached (timeout, network, backpressure) —
//     the same request later may well succeed, so it answers 503 rather than
//     silently starting an empty document on top of content that exists.
const seedFromLegacyStore = async (docRef: DocRef): Promise<void> => {
  try {
    // `yhub` is declared at the bottom of this file — safe: auth callbacks only
    // fire once the server is up, i.e. after that assignment
    await maybeMigrate(yhub, docRef);
  } catch (err) {
    if (!isPermanentFailure(err)) {
      throw apiError(503, 'Legacy document store is unavailable');
    }
    // why it failed was logged once, at the attempt, inside maybeMigrate
    migrationLog.warn(
      {
        event: 'seed.skipped',
        docid: docRef.docid,
        err: err instanceof Error ? err.message : undefined,
      },
      'admitting caller to a document that could not be migrated; it opens as new',
    );
  }
};

const auth = createAuthPlugin<AppAuthInfo>({
  /**
   * Who is asking. Returning `null` here would mean "an anonymous caller" — it is
   * not a refusal, and `authorize` is still asked — so every rejection below is a
   * thrown `apiError(401)` and every unauthenticated caller gets an identity.
   * Under 0.7 this callback denied by returning `null`, which is the one change
   * in this file that would fail open rather than closed if it were missed.
   */
  async authenticate(req) {
    // uws req is only valid synchronously — read headers AND the url before the
    // first await.
    const authorization = req.getHeader('authorization');
    const cookie = req.getHeader('cookie');
    const origin = req.getHeader('origin');
    // 0.8 dropped `accessPurpose`, and `authorize` is told the scope and the
    // resource but not the route. The seed below needs to know one thing about
    // the route — whether this is the `migrate` call — so the endpoint name is
    // read off the path here, where the request still exists, and carried on the
    // identity. `/collaboration/{name}/{version}/...` → index 2.
    const endpoint = req.getUrl().split('/')[2] ?? '';

    if (authorization !== '') {
      // backend-to-server call: RS256 JWT signed by Django, verified against
      // its JWKS. A browser cannot attach an Authorization header to a ws
      // upgrade or a credentialed cross-origin fetch, so this never shadows a
      // real user session. present-but-invalid is rejected here (401) instead of
      // falling through to the cookie flow, which would mask a misconfiguration
      // as an anonymous browse.
      const token = authorization.startsWith('Bearer ')
        ? authorization.slice('Bearer '.length)
        : authorization;
      let payload: JWTPayload;
      try {
        // clockTolerance absorbs Django's cache-at-exp race (the admin token
        // is cached for exactly its lifetime, so it can arrive here moments
        // after exp) plus small clock skew — without it a kick would be
        // silently dropped as a 401.
        ({ payload } = await jwtVerify(token, JWKS, {
          algorithms: ['RS256'],
          audience: YHUB_AUDIENCE,
          clockTolerance: 5,
        }));
      } catch (err) {
        // jose tags every token-validation failure with an `ERR_J…` code (bad
        // signature, expired, wrong or missing audience) — those are permanent,
        // fail closed. A JWKS fetch that times out or never connects has no
        // such code (or ERR_JWKS_TIMEOUT): the token may be perfectly valid and
        // we simply cannot check it, so report it as retryable instead of
        // accusing the caller of forging it.
        const code = errCode(err);
        if (
          code === 'ERR_JWKS_TIMEOUT' ||
          typeof code !== 'string' ||
          !code.startsWith('ERR_J')
        ) {
          throw apiError(503, 'Token verification keys are unavailable');
        }
        throw apiError(401, 'Invalid token');
      }
      if (payload.admin !== true) {
        // a valid token that is not an admin one is a credential we refuse, not
        // an anonymous caller: returning null here — which is what 0.7 did —
        // would now silently downgrade a service call into a public browse
        throw apiError(401, 'Not an admin token');
      }
      // admin tokens act as the "system" user (no per-user admin identities yet)
      return { userid: 'system', admin: true, endpoint };
    }
    // No origin check here: `server.cors` below is the allowlist, and yhub applies it to the
    // websocket upgrade and to every REST request before this runs. Checking it a second time
    // would also refuse the http fallback's polls — a same-origin `fetch` GET carries no
    // `Origin` header at all, so on a deployment where the page and /collaboration/ share a
    // host every round would 401 while the PATCH beside it succeeded.
    //
    // A caller with no cookie at all is anonymous too: the probes arrive that way, and so does
    // a public document opened in a fresh browser. What they may do is `authorize`'s answer.
    if (!cookie) {
      return { userid: ANONYMOUS_USERID, origin, endpoint };
    }
    try {
      const user = await backendFetch<BackendUser>('/api/v1.0/users/me/', {
        cookie,
        origin,
      });
      return { userid: String(user.id), cookie, origin, endpoint };
    } catch (err) {
      // Only a genuine "not signed in" falls back to the anonymous identity.
      // On backend failure (5xx/network) still refuse to admit the connection —
      // a signed-in editor authorized under an anon userid would be invisible
      // to the targeted reset-connections recheck (users: [<uuid>]) for the
      // connection's whole lifetime — but report it as retryable rather than as
      // an authentication failure the client should give up on.
      const status = errStatus(err);
      if (status !== 401 && status !== 403) {
        throw apiError(503, 'Authentication backend is unavailable');
      }
      // the cookie is kept: it is a session the backend still answers document
      // questions about, which is how a public document resolves below
      return { userid: ANONYMOUS_USERID, cookie, origin, endpoint };
    }
  },
  /**
   * What that caller may do. One handler per scope; a scope without a handler
   * denies, which is what closes `org` and `branch` here. Denial is a value —
   * returning `null`, never throwing: an error thrown during a websocket recheck
   * disconnects with the transient close code 1013 instead of the revoke code
   * 4401.
   */
  authorize: createAuthorize<AppAuthInfo>({
    async document({ org, docid, branch }, user) {
      if (user?.admin === true) {
        // Django's admin token: full access. It still goes through the legacy
        // seed, on the same terms as a user, but not for `migrate` — that call
        // replays the whole version history itself, and seeding first would put
        // the newest version in the room underneath it. Without the seed a
        // backend read of an unmigrated document would answer with an *empty*
        // doc, and a create-ydoc against one would write a second lineage next
        // to the legacy content the first user access is about to seed in.
        // Access itself is never in question here — the token already granted it.
        // The same org/branch fence the user path applies below. The admin token
        // is the only identity that can name an arbitrary org or branch, and the
        // legacy store is branchless — `{docid}/file` *is* main — so seeding any
        // other room would write main's content into an orphan room, and the
        // per-docid verdict cache would then report that docid as done and leave
        // the real room empty.
        if (
          SOFT_MIGRATION &&
          user.endpoint !== 'migrate' &&
          org === ORG &&
          branch === 'main' &&
          UUID4.test(docid)
        ) {
          await seedFromLegacyStore({ org, docid, branch });
        }
        return adminDocumentPermissions;
      }
      if (org !== ORG || branch !== 'main' || !UUID4.test(docid)) {
        return null;
      }
      let doc: BackendDocument;
      try {
        doc = await backendFetch<BackendDocument>(
          `/api/v1.0/documents/${docid}/`,
          user ?? {},
        );
      } catch (err) {
        // the backend answered "no": a real, permanent denial (403 Forbidden)
        const status = errStatus(err);
        if (status === 401 || status === 403 || status === 404) {
          return null;
        }
        // it did not answer at all — say so, so the caller retries instead of
        // reading a 5xx or a network blip as a permission decision
        throw apiError(503, 'Document authorization backend is unavailable');
      }
      if (!doc.abilities?.retrieve) {
        return null;
      }
      // the backend has already decided the caller may read this document; the
      // seed only decides what is in it
      if (SOFT_MIGRATION) {
        await seedFromLegacyStore({ org, docid, branch });
      }

      // When this caller was given access, which is where the history they may
      // read starts. `resolveHistoryFrom` decides whether to ask for it at all
      // and what an unusable answer means — see permissions.ts.
      let accessSince: number | null;
      try {
        accessSince = await resolveHistoryFrom(doc.abilities, () =>
          backendFetch(`/api/v1.0/documents/${docid}/accesses/me/`, user ?? {}),
        );
      } catch {
        // the backend did not answer; same treatment as the document fetch above
        throw apiError(503, 'Document authorization backend is unavailable');
      }
      return browserDocumentPermissions(
        doc.abilities.update === true,
        accessSince,
      );
    },
    async global() {
      return publicGlobalPermissions;
    },
  }),
});

// `docUpdate` is the worker event for "this compaction found new content": the
// task returns before it when it has nothing to persist, so the awareness-only
// traffic of someone merely opening a document never reaches it. Since yhub
// 0.5.0 it is handed the room of the task alongside the merged document.
const workerEvents = {
  docUpdate: ({ docRef }: { docRef: DocRef }) => {
    // Django knows the documents of this org, on the main branch, by their uuid
    if (
      docRef.org !== ORG ||
      docRef.branch !== 'main' ||
      !UUID4.test(docRef.docid)
    ) {
      return;
    }
    // deliberately not awaited: a slow backend must not hold the worker
    void touchDocument(docRef.docid);
  },
};

// The persistence plugins yhub consults, in order, before writing a blob to
// postgres and before reading one back. An empty list keeps everything in the
// database, which is what a deployment that names no bucket gets.
//
// Naming a bucket is enough to get the plugin, whether or not the toggle asks
// for the writing: reading is the half that must never be taken away, since the
// objects an earlier run wrote are the only copy of those versions. `branches`
// is what the toggle actually moves — every branch, or none, which is a plugin
// that retrieves and deletes what is in the bucket and adds nothing to it.
//
// Read here rather than in the call below so that an incomplete configuration
// is a startup error naming what is missing: the client would otherwise be
// built anonymous or against the wrong host and only say so on the first
// compaction, which is a background task — the failure would show up as
// documents quietly not being persisted.
const persistencePlugins = () => {
  const settings: Array<[string, string | undefined]> = [
    ['YHUB_S3_ENDPOINT_URL', YHUB_S3_ENDPOINT_URL],
    ['YHUB_S3_ACCESS_KEY_ID', YHUB_S3_ACCESS_KEY_ID],
    ['YHUB_S3_SECRET_ACCESS_KEY', YHUB_S3_SECRET_ACCESS_KEY],
    ['YHUB_S3_BUCKET_NAME', YHUB_S3_BUCKET_NAME],
  ];
  const missing = settings.filter(([, value]) => !value).map(([name]) => name);
  // no bucket named at all, and the toggle does not ask for one: postgres
  // alone, and no object anywhere that would need reading back
  if (missing.length === settings.length && !S3_PERSISTENCE) return [];
  if (missing.length > 0) {
    // half a configuration is always a mistake, and the half that is set says
    // which mistake: a bucket was meant to be reachable and is not
    const named = missing.join(', ');
    throw new Error(
      S3_PERSISTENCE
        ? `YHUB_S3_PERSISTENCE=true requires ${named}`
        : `The YHUB_S3_* bucket is partly configured, missing ${named}`,
    );
  }

  // every entry of `settings` was checked non-empty just above
  const url = new URL(YHUB_S3_ENDPOINT_URL as string);
  if (url.pathname !== '/' && url.pathname !== '') {
    // the client is given a host and a port, so a base path would be dropped
    // without a word and the objects written next to where they belong
    throw new Error('YHUB_S3_ENDPOINT_URL must not contain a path');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    // the client is told "SSL or not", so any other scheme would read as "not"
    // and send the credentials in clear
    throw new Error('YHUB_S3_ENDPOINT_URL must be http:// or https://');
  }
  const useSSL = url.protocol === 'https:';

  return [
    new S3PersistenceV1({
      bucket: YHUB_S3_BUCKET_NAME as string,
      endPoint: url.hostname,
      // an implicit port parses as "", which the client reads as 0 — its way
      // of saying "whatever the scheme defaults to"
      port: Number(url.port),
      useSSL,
      accessKey: YHUB_S3_ACCESS_KEY_ID as string,
      secretKey: YHUB_S3_SECRET_ACCESS_KEY as string,
      // The branches whose blobs are written here: all of them, or none, which
      // is how the plugin is kept for reading while the writing goes back to
      // postgres. `store` declines a branch it is not given and yhub falls
      // through to the database, while `retrieve` and `delete` go on answering
      // for every object already in the bucket.
      branches: S3_PERSISTENCE ? true : [],
      // minio's Client — which the plugin spreads this whole object into —
      // discovers the bucket's region when it is not given one; passed only
      // when set, so an empty string cannot fail that discovery. Not part of
      // the plugin's published `S3Conf`, so it rides in through the conditional
      // spread rather than as a named key.
      ...(YHUB_S3_REGION_NAME ? { region: YHUB_S3_REGION_NAME } : {}),
      // On a versioned bucket a plain delete deletes nothing: it writes a
      // delete marker over the object and keeps every version underneath it.
      // Each compaction supersedes the blobs of the one before, so that would
      // be every version ever written kept forever — and a document a user
      // asked to erase still readable by anyone who can list versions. The
      // plugin records the version id it wrote at store time so that the
      // delete can name it, which is what removes the bytes. Asked for here
      // rather than left to the plugin's default: the delete is only as
      // thorough as this line.
      deleteVersions: true,
    }),
  ];
};

// the instance is referenced by the soft-migration helpers above — safe: auth
// callbacks only fire once the server is up, i.e. after this assignment
const yhub: YHub = (await createYHub({
  redis: {
    // yhub validates that both stores are configured and fails with a clear
    // message when they are not
    url: REDIS as string,
    prefix: REDIS_PREFIX,
    taskDebounce: TASK_DEBOUNCE_MS,
    minMessageLifetime: MIN_MESSAGE_LIFETIME_MS,
  },
  postgres: POSTGRES as string,
  // where the blobs live: nothing here keeps them in yhub's postgres
  persistence: persistencePlugins(),
  // Both halves are declared, and YHUB_ROLE decides which are built: a null
  // server binds no port at all (a `worker` pod has no http surface, hence no
  // probes and no service in front of it), a null worker claims no task.
  //
  // apiPrefix mounts every route — built-ins, our custom endpoints, and the
  // websocket (/collaboration/ws/v1/{org}/{docid}) — under /collaboration/.
  server: RUNS_SERVER
    ? {
        port: PORT,
        auth,
        api,
        apiPrefix: API_PREFIX,
        // What a browser may reach this server from, applied by yhub to the websocket upgrade
        // and to every REST route — the only origin check there is, `authenticate` no longer
        // does its own. `credentials` is what lets the http fallback send the session cookie
        // on a cross-origin `fetch`; it is also why the list has to be concrete, browsers
        // refusing "*" together with Access-Control-Allow-Credentials.
        cors: { origin: allowedOrigins, credentials: true },
      }
    : null,
  worker: RUNS_WORKER
    ? { taskConcurrency: TASK_CONCURRENCY, events: workerEvents }
    : null,
})) as YHub;

// What this process was configured to be, in one line: yhub's own startup log
// reports neither the role nor the stream settings, and every one of them is an
// environment variable a deployment can get wrong. The two timings are read
// back off the instance rather than from the constants above, so the line says
// what yhub is using and not merely what it was asked for.
logger.info(
  {
    role: ROLE,
    server: RUNS_SERVER,
    worker: RUNS_WORKER,
    taskConcurrency: RUNS_WORKER ? TASK_CONCURRENCY : null,
    // the bucket the plugin is attached to, null when there is no plugin at
    // all, and whether the compaction blobs are written to it or to yhub's own
    // postgres — a bucket with `s3Writes` false is one that is only read
    s3Bucket: YHUB_S3_BUCKET_NAME ?? null,
    s3Writes: S3_PERSISTENCE,
    taskDebounceMs: yhub.stream.taskDebounce,
    minMessageLifetimeMs: yhub.stream.minMessageLifetime,
  },
  'yhub configuration',
);
