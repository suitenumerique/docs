import { decodeAny, encodeAny, fromBase64, toBase64 } from 'lib0/buffer';

const LIB0_ANY = 'application/x-lib0any';

type Fields = Record<string, unknown>;

const mapFields = (fields: Fields, convert: (value: Uint8Array) => unknown) =>
  Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [
      key,
      value instanceof Uint8Array ? convert(value) : value,
    ]),
  );

/**
 * The http fallback speaks lib0-any: its `PATCH` is an `application/octet-stream` body and
 * its answers are `application/x-lib0any`, which some firewalls refuse. The collaboration
 * server also speaks json, with the binary fields in base64, when asked with `Accept` and
 * `Content-Type`.
 *
 * The provider cannot be told to use it, so this wraps the `fetch` it is given: what goes out
 * is json, and what comes back is turned into the lib0-any `Response` the provider expects.
 * That `Response` is made here and never crosses the network, so the only content type on
 * the wire is `application/json`.
 *
 * What is not understood is passed through untouched — a proxy's html page, an empty body —
 * so the provider reports it as it would have.
 */
export const withJsonTransport =
  (send: typeof fetch): typeof fetch =>
  async (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set('Accept', 'application/json');

    let body = init?.body;
    if (body instanceof Uint8Array) {
      headers.set('Content-Type', 'application/json');
      body = JSON.stringify(
        mapFields(decodeAny(body) as Fields, (bytes) => toBase64(bytes)),
      );
    }

    const response = await send(input, { ...init, headers, body });

    if (!response.headers.get('content-type')?.includes('application/json')) {
      return response;
    }

    // read once: a body that does not parse is handed back as it came
    const text = await response.text();
    let decoded: Fields;
    try {
      decoded = JSON.parse(text) as Fields;
    } catch {
      return new Response(text, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }

    // `doc` and `awareness` come back as base64 strings; an error body is `{ error, code }`
    const fields: Fields = { ...decoded };
    for (const key of ['doc', 'awareness']) {
      if (response.ok && typeof fields[key] === 'string') {
        fields[key] = fromBase64(fields[key]);
      }
    }

    const answerHeaders = new Headers(response.headers);
    answerHeaders.set('Content-Type', LIB0_ANY);
    answerHeaders.delete('Content-Length');

    return new Response(encodeAny(fields) as BodyInit, {
      status: response.status,
      statusText: response.statusText,
      headers: answerHeaders,
    });
  };
