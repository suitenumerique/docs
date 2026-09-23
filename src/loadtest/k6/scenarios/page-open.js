/**
 * What the browser does when a user opens a document, in the order the
 * frontend does it — `config`, `users/me`, the document, its tree, the list of
 * the user's documents — plus the `media-auth` subrequest nginx makes when the
 * page loads an attachment. It is the HTTP baseline of the plan
 * (`documentation/load-testing.md`, scenario 2): run it against the
 * current release and against this branch, on the same data, with the same
 * options.
 *
 *   k6 run --env MANIFEST=manifest.json --env BASE_URL=https://docs.example.com \
 *          --env RATE=50 --env DURATION=10m scenarios/page-open.js
 *
 * RATE is in page opens per second, ramped up over RAMP (default 1m), held for
 * DURATION, then ramped down over RAMP. Each open is 5 to 6 requests.
 */
import { group, sleep } from 'k6';

import { expect, get } from '../lib/api.js';
import { myDocument, mySession, sessionCount } from '../lib/session.js';

const RATE = Number(__ENV.RATE || 10);
const RAMP = __ENV.RAMP || '1m';
const DURATION = __ENV.DURATION || '5m';
// one VU serves about one open per second when the API answers in well under
// that; more are preallocated so that a slow API does not starve the rate
const VUS = Number(__ENV.VUS || Math.max(10, RATE * 4));

export const options = {
  scenarios: {
    page_open: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: VUS,
      maxVUs: VUS,
      stages: [
        { target: RATE, duration: RAMP },
        { target: RATE, duration: DURATION },
        { target: 0, duration: RAMP },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:documents/{id}/}': ['p(95)<1000'],
    'http_req_duration{name:documents/{id}/tree/}': ['p(95)<1000'],
    'http_req_duration{name:documents/}': ['p(95)<1000'],
    'http_req_duration{name:documents/media-auth/}': ['p(95)<500'],
    checks: ['rate>0.99'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

export function setup() {
  if (VUS > sessionCount()) {
    console.warn(`${VUS} VUs for ${sessionCount()} sessions: some users are logged in several times, and the API throttles per user`);
  }
}

export default function () {
  const session = mySession();
  const doc = myDocument(session);
  if (!doc) return;

  group('open', () => {
    expect(get(session, 'config/', 'config/'), 'config/', 200);
    expect(get(session, 'users/me/', 'users/me/'), 'users/me/', 200);
    expect(get(session, `documents/${doc}/`, 'documents/{id}/'), 'documents/{id}/', 200);
    expect(get(session, `documents/${doc}/tree/`, 'documents/{id}/tree/'), 'documents/{id}/tree/', 200);
    expect(get(session, 'documents/?page=1&ordering=-updated_at', 'documents/'), 'documents/', 200);
    // the auth subrequest nginx makes for `/media/{doc}/attachments/{file}`. The
    // file need not exist for the access check — the costly part, a query
    // over the document tree — to run: a file the bucket does not hold
    // answers 403 once that check has passed
    const original = `${__ENV.MEDIA_BASE_URL || 'https://docs.example.com'}/media/${doc}/attachments/00000000-0000-4000-8000-000000000000.png`;
    expect(
      get(session, 'documents/media-auth/', 'documents/media-auth/', {
        headers: { 'X-Original-URL': original },
        expected: [200, 403],
      }),
      'documents/media-auth/',
      200, 403,
    );
  });
  // a real user does not open the next document at once
  sleep(Math.random() * 2);
}
