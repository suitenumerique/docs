/**
 * Calls to the Docs API as a logged-in browser would make them: the session
 * cookie, and on unsafe methods Django's double-submit CSRF token (a cookie and
 * the same value in `X-CSRFToken`) with the `Origin` of the application.
 *
 * Every request is tagged with a `name` free of identifiers (`documents/{id}/`
 * rather than the url): k6 keeps one time series per distinct tag value, and
 * one per document would be one per document.
 */
import http from 'k6/http';
import { check } from 'k6';

import { COOKIE_NAME } from './session.js';

export const BASE_URL = (__ENV.BASE_URL || 'http://localhost:8071').replace(/\/+$/, '');
export const API = `${BASE_URL}/api/v1.0`;
// The `Origin` a browser on the application sends, which Django checks a POST
// against (CSRF_TRUSTED_ORIGINS): the frontend's origin, which is BASE_URL in a
// deployment where /api is routed on the application's host, and something else
// in the dev stack (`http://localhost:3000`).
export const ORIGIN = __ENV.ORIGIN || BASE_URL;
// Django accepts any 32 alphanumeric characters as long as the cookie and the header agree
const CSRF_TOKEN = 'k6loadtestk6loadtestk6loadtest00';

const headers = (session, unsafe) => ({
  Accept: 'application/json',
  'Content-Type': 'application/json',
  Cookie: unsafe
    ? `${COOKIE_NAME}=${session.session_key}; csrftoken=${CSRF_TOKEN}`
    : `${COOKIE_NAME}=${session.session_key}`,
  ...(unsafe ? { 'X-CSRFToken': CSRF_TOKEN, Origin: ORIGIN } : {}),
});

const params = (session, name, unsafe, extra = {}) => ({
  headers: { ...headers(session, unsafe), ...(extra.headers || {}) },
  tags: { name, ...(extra.tags || {}) },
  // the cookie is in the header: k6's own jar must not add what the server sets
  jar: http.cookieJar(),
  timeout: extra.timeout || '60s',
  // what `http_req_failed` counts: an answer the scenario expects is not a
  // failure. The key is only set when asked for — set to `undefined` it turns
  // k6's default classification off
  ...(extra.expected ? { responseCallback: http.expectedStatuses(...extra.expected) } : {}),
});

export const get = (session, path, name, extra) =>
  http.get(`${API}/${path}`, params(session, name, false, extra));

export const post = (session, path, body, name, extra) =>
  http.post(`${API}/${path}`, body == null ? null : JSON.stringify(body), params(session, name, true, extra));

export const del = (session, path, name, extra) =>
  http.del(`${API}/${path}`, null, params(session, name, true, extra));

/**
 * Check the status, under the request's name. An unexpected answer is logged
 * with the start of its body: the summary only says how many failed, not why.
 */
export const expect = (response, name, ...statuses) => {
  const ok = check(response, { [`${name} → ${statuses.join('|')}`]: (r) => statuses.includes(r.status) }, { name });
  if (!ok) {
    console.warn(`${name}: ${response.status} ${String(response.body || '').slice(0, 200)}`);
  }
  return ok;
};

/** A multipart POST (a file upload): the same cookie and CSRF pair, no JSON content type. */
export const postMultipart = (session, path, body, name, extra = {}) => {
  const { 'Content-Type': _json, ...rest } = headers(session, true);
  return http.post(`${API}/${path}`, body, {
    headers: rest,
    tags: { name },
    jar: http.cookieJar(),
    timeout: extra.timeout || '120s',
    ...(extra.expected ? { responseCallback: http.expectedStatuses(...extra.expected) } : {}),
  });
};
