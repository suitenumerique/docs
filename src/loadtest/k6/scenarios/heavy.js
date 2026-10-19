/**
 * The endpoints that call the collaboration server or walk a subtree inside one
 * request (scenario 9 of the plan): `duplicate` with descendants — two yhub
 * round-trips per node, inside a transaction — `formatted-content`, document
 * creation from a file, and the delete/restore cascades that land on the single
 * Celery queue.
 *
 * Every iteration works on documents it creates itself and deletes at the end:
 * a duplicate of one of the user's own documents, then the duplicate is
 * deleted, restored and deleted again. The user's documents are only read. The
 * deleted copies stay in the trash for the retention period, so the database
 * grows by one subtree per iteration for as long as that lasts.
 *
 *   k6 run --env MANIFEST=manifest.json --env BASE_URL=https://docs.example.com \
 *          --env VUS=5 --env DURATION=5m scenarios/heavy.js
 */
import { group, sleep } from 'k6';
import http from 'k6/http';

import { del, expect, get, post, postMultipart } from '../lib/api.js';
import { myDocument, mySession } from '../lib/session.js';

const VUS = Number(__ENV.VUS || 5);
const DURATION = __ENV.DURATION || '5m';
const MARKDOWN = '# k6\n\nA document created by the load test, and deleted by it.\n';

export const options = {
  scenarios: {
    heavy: {
      executor: 'constant-vus',
      vus: VUS,
      duration: DURATION,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    'http_req_duration{name:documents/{id}/duplicate/}': ['p(95)<10000'],
    'http_req_duration{name:documents/{id}/formatted-content/}': ['p(95)<5000'],
    'http_req_duration{name:documents/ (create from file)}': ['p(95)<10000'],
    checks: ['rate>0.95'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

export default function () {
  const session = mySession();
  const doc = myDocument(session, true);
  if (!doc) return;

  group('duplicate with descendants', () => {
    const res = post(
      session,
      `documents/${doc}/duplicate/`,
      { with_accesses: false, with_descendants: true },
      'documents/{id}/duplicate/',
    );
    if (!expect(res, 'documents/{id}/duplicate/', 201)) return;
    const copy = res.json('id');

    group('formatted content', () => {
      expect(
        get(session, `documents/${copy}/formatted-content/?content_format=markdown`, 'documents/{id}/formatted-content/'),
        'documents/{id}/formatted-content/',
        200,
      );
    });

    group('delete, restore, delete', () => {
      // each delete and each restore walks the subtree from a Celery task
      expect(del(session, `documents/${copy}/`, 'documents/{id}/ (delete)'), 'documents/{id}/ (delete)', 204);
      expect(post(session, `documents/${copy}/restore/`, null, 'documents/{id}/restore/'), 'documents/{id}/restore/', 200);
      expect(del(session, `documents/${copy}/`, 'documents/{id}/ (delete)'), 'documents/{id}/ (delete)', 204);
    });
  });

  group('create from file', () => {
    // the file is converted, then handed to yhub, before the response
    const res = postMultipart(
      session,
      'documents/',
      { file: http.file(MARKDOWN, 'k6.md', 'text/markdown'), title: 'k6 import' },
      'documents/ (create from file)',
    );
    if (expect(res, 'documents/ (create from file)', 201)) {
      expect(del(session, `documents/${res.json('id')}/`, 'documents/{id}/ (delete)'), 'documents/{id}/ (delete)', 204);
    }
  });

  sleep(1);
}
