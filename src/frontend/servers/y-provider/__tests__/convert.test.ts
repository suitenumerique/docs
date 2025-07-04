import { ServerBlockNoteEditor } from '@blocknote/server-util';
import request from 'supertest';
import { describe, expect, test, vi } from 'vitest';
import * as Y from 'yjs';

vi.mock('../src/env', async (importOriginal) => {
  return {
    ...(await importOriginal()),
    COLLABORATION_SERVER_ORIGIN: 'http://localhost:3000',
    Y_PROVIDER_API_KEY: 'yprovider-api-key',
  };
});

import { initApp } from '@/servers';

import {
  Y_PROVIDER_API_KEY as apiKey,
  COLLABORATION_SERVER_ORIGIN as origin,
} from '../src/env';

console.error = vi.fn();

describe('Server Tests', () => {
  test('POST /api/convert with incorrect API key should responds with 401', async () => {
    const app = initApp();

    const response = await request(app)
      .post('/api/convert')
      .set('origin', origin)
      .set('authorization', 'wrong-api-key')
      .set('content-type', 'application/json');

    expect(response.status).toBe(401);
    expect(response.body).toStrictEqual({
      error: 'Forbidden: Invalid API Key',
    });
  });

  test('POST /api/convert with a Bearer token', async () => {
    const app = initApp();

    const response = await request(app)
      .post('/api/convert')
      .set('origin', origin)
      .set('authorization', 'Bearer test-secret-api-key')
      .set('content-type', 'application/json');

    // Warning: Changing the authorization header to Bearer token format will break backend compatibility with this microservice.
    expect(response.status).toBe(401);
    expect(response.body).toStrictEqual({
      error: 'Forbidden: Invalid API Key',
    });
  });

  test('POST /api/convert with missing body param content', async () => {
    const app = initApp();

    const response = await request(app)
      .post('/api/convert')
      .set('origin', origin)
      .set('authorization', apiKey)
      .set('content-type', 'application/json');

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({
      error: 'Invalid request: missing content',
    });
  });

  test('POST /api/convert with body param content being an empty string', async () => {
    const app = initApp();

    const response = await request(app)
      .post('/api/convert')
      .set('origin', origin)
      .set('authorization', apiKey)
      .set('content-type', 'application/json')
      .send('');

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({
      error: 'Invalid request: missing content',
    });
  });

  test('POST /api/convert with correct content', async () => {
    const app = initApp();

    const document = [
      '# Example document',
      '',
      'Lorem ipsum dolor sit amet.',
      '',
    ].join('\n');

    const response = await request(app)
      .post('/api/convert')
      .set('origin', origin)
      .set('authorization', apiKey)
      .set('content-type', 'application/json')
      .send(document);

    expect(response.status).toBe(200);
    expect(response.body).toBeInstanceOf(Buffer);

    const editor = ServerBlockNoteEditor.create();
    const doc = new Y.Doc();
    Y.applyUpdate(doc, response.body);
    const blocks = editor.yDocToBlocks(doc, 'document-store');

    expect(blocks).toStrictEqual([
      {
        children: [],
        content: [
          {
            styles: {},
            text: 'Example document',
            type: 'text',
          },
        ],
        id: expect.any(String),
        props: {
          backgroundColor: 'default',
          isToggleable: false,
          level: 1,
          textAlignment: 'left',
          textColor: 'default',
        },
        type: 'heading',
      },
      {
        children: [],
        content: [
          {
            styles: {},
            text: 'Lorem ipsum dolor sit amet.',
            type: 'text',
          },
        ],
        id: expect.any(String),
        props: {
          backgroundColor: 'default',
          textAlignment: 'left',
          textColor: 'default',
        },
        type: 'paragraph',
      },
    ]);
  });
});
