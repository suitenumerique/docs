import { decodeAny, encodeAny } from 'lib0/buffer';
import { describe, expect, it, vi } from 'vitest';

import { withJsonTransport } from '../api/httpFallbackJson';

const update = new Uint8Array([1, 2, 3, 250]);
const base64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64');

const jsonResponse = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers: { 'content-type': 'application/json', ...init.headers },
  });

describe('withJsonTransport', () => {
  it('sends what the provider publishes as json, binary parts in base64', async () => {
    const send = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const awareness = new Uint8Array([9, 8]);

    const response = await withJsonTransport(send)('http://collab/ydoc', {
      method: 'PATCH',
      headers: { 'content-type': 'application/octet-stream' },
      body: encodeAny({ update, awareness }) as BodyInit,
    });

    const [, init] = send.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    // the one content type on the wire, in both directions
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('accept')).toBe('application/json');
    expect(JSON.parse(init.body as string)).toEqual({
      update: base64(update),
      awareness: base64(awareness),
    });
    expect(init.method).toBe('PATCH');
    expect(response.status).toBe(204);
  });

  it('hands the provider the lib0-any answer it expects', async () => {
    const awareness = new Uint8Array([7]);
    const send = vi.fn().mockResolvedValue(
      jsonResponse({
        doc: base64(update),
        awareness: base64(awareness),
      }),
    );

    const response = await withJsonTransport(send)('http://collab/ydoc');

    expect(new Headers(send.mock.calls[0][1].headers).get('accept')).toBe(
      'application/json',
    );
    expect(response.headers.get('content-type')).toBe('application/x-lib0any');
    const body = decodeAny(
      new Uint8Array(await response.arrayBuffer()),
    ) as Record<string, Uint8Array>;
    expect(Array.from(body.doc)).toEqual(Array.from(update));
    expect(Array.from(body.awareness)).toEqual(Array.from(awareness));
  });

  it('keeps the error message, status and retry hint of a refusal', async () => {
    const send = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(
          { error: 'requires permission', code: 'missing-permission' },
          { status: 403, headers: { 'retry-after': '5' } },
        ),
      );

    const response = await withJsonTransport(send)('http://collab/ydoc');

    expect(response.status).toBe(403);
    expect(response.headers.get('retry-after')).toBe('5');
    expect(decodeAny(new Uint8Array(await response.arrayBuffer()))).toEqual({
      error: 'requires permission',
      code: 'missing-permission',
    });
  });

  it('leaves what is not json to the provider', async () => {
    // a proxy or a captive portal answering for the server
    const html = new Response('<html>blocked</html>', {
      status: 403,
      headers: { 'content-type': 'text/html' },
    });
    const send = vi.fn().mockResolvedValue(html);

    const response = await withJsonTransport(send)('http://collab/ydoc');

    expect(response).toBe(html);
  });

  it('leaves a body it cannot parse to the provider', async () => {
    const broken = new Response('not json', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
    const send = vi.fn().mockResolvedValue(broken);

    const response = await withJsonTransport(send)('http://collab/ydoc');

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('not json');
  });
});
