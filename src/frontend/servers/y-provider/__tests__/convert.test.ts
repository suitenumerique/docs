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

const expectedBlocks = [
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
];

console.error = vi.fn();

describe('Server Tests', () => {
  test('POST /api/convert with incorrect API key responds with 401', async () => {
    const app = initApp();

    const response = await request(app)
      .post('/api/convert')
      .set('origin', origin)
      .set('authorization', 'wrong-api-key')
      .set('content-type', 'application/json');

    expect(response.status).toBe(401);
    expect(response.body).toStrictEqual({
      error: 'Unauthorized: Invalid API Key',
    });
  });

  test('POST /api/convert with incorrect Bearer token responds with 401', async () => {
    const app = initApp();

    const response = await request(app)
      .post('/api/convert')
      .set('origin', origin)
      .set('authorization', 'Bearer test-secret-api-key')
      .set('content-type', 'application/json');

    expect(response.status).toBe(401);
    expect(response.body).toStrictEqual({
      error: 'Unauthorized: Invalid API Key',
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

  test('POST /api/convert with unsupported Content-Type returns 415', async () => {
    const app = initApp();
    const response = await request(app)
      .post('/api/convert')
      .set('origin', origin)
      .set('authorization', apiKey)
      .set('content-type', 'image/png')
      .send('randomdata');
    expect(response.status).toBe(415);
    expect(response.body).toStrictEqual({ error: 'Unsupported Content-Type' });
  });

  test('POST /api/convert with unsupported Accept returns 406', async () => {
    const app = initApp();
    const response = await request(app)
      .post('/api/convert')
      .set('origin', origin)
      .set('authorization', apiKey)
      .set('content-type', 'text/markdown')
      .set('accept', 'image/png')
      .send('# Header');
    expect(response.status).toBe(406);
    expect(response.body).toStrictEqual({ error: 'Unsupported format' });
  });

  test.each([[apiKey], [`Bearer ${apiKey}`]])(
    'POST /api/convert with correct content with Authorization: %s',
    async (authHeader) => {
      const app = initApp();

      const document = [
        '# Example document',
        '',
        'Lorem ipsum dolor sit amet.',
        '',
      ].join('\n');

      const response = await request(app)
        .post('/api/convert')
        .set('Origin', origin)
        .set('Authorization', authHeader)
        .set('content-type', 'text/markdown')
        .set('accept', 'application/vnd.yjs.doc')
        .send(document);

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Buffer);

      const editor = ServerBlockNoteEditor.create();
      const doc = new Y.Doc();
      Y.applyUpdate(doc, response.body);
      const blocks = editor.yDocToBlocks(doc, 'document-store');

      expect(blocks).toStrictEqual(expectedBlocks);
    },
  );

  test('POST /api/convert Yjs to HTML', async () => {
    const app = initApp();
    const editor = ServerBlockNoteEditor.create();
    const markdownContent = '# Test Document\n\nThis is test content.';
    const blocks = await editor.tryParseMarkdownToBlocks(markdownContent);
    const yDocument = editor.blocksToYDoc(blocks, 'document-store');
    const yjsUpdate = Y.encodeStateAsUpdate(yDocument);
    const response = await request(app)
      .post('/api/convert')
      .set('origin', origin)
      .set('authorization', apiKey)
      .set('content-type', 'application/vnd.yjs.doc')
      .set('accept', 'text/html')
      .send(Buffer.from(yjsUpdate));
    expect(response.status).toBe(200);
    expect(response.header['content-type']).toBe('text/html; charset=utf-8');
    expect(typeof response.text).toBe('string');
    expect(response.text).toBe(
      '<h1>Test Document</h1><p>This is test content.</p>',
    );
  });

  test('POST /api/convert Yjs to Markdown', async () => {
    const app = initApp();
    const editor = ServerBlockNoteEditor.create();
    const markdownContent = '# Test Document\n\nThis is test content.';
    const blocks = await editor.tryParseMarkdownToBlocks(markdownContent);
    const yDocument = editor.blocksToYDoc(blocks, 'document-store');
    const yjsUpdate = Y.encodeStateAsUpdate(yDocument);
    const response = await request(app)
      .post('/api/convert')
      .set('origin', origin)
      .set('authorization', apiKey)
      .set('content-type', 'application/vnd.yjs.doc')
      .set('accept', 'text/markdown')
      .send(Buffer.from(yjsUpdate));
    expect(response.status).toBe(200);
    expect(response.header['content-type']).toBe(
      'text/markdown; charset=utf-8',
    );
    expect(typeof response.text).toBe('string');
    expect(response.text.trim()).toBe(markdownContent);
  });

  test('POST /api/convert Yjs to JSON', async () => {
    const app = initApp();
    const editor = ServerBlockNoteEditor.create();
    const markdownContent = '# Test Document\n\nThis is test content.';
    const blocks = await editor.tryParseMarkdownToBlocks(markdownContent);
    const yDocument = editor.blocksToYDoc(blocks, 'document-store');
    const yjsUpdate = Y.encodeStateAsUpdate(yDocument);
    const response = await request(app)
      .post('/api/convert')
      .set('origin', origin)
      .set('authorization', apiKey)
      .set('content-type', 'application/vnd.yjs.doc')
      .set('accept', 'application/json')
      .send(Buffer.from(yjsUpdate));
    expect(response.status).toBe(200);
    expect(response.header['content-type']).toBe(
      'application/json; charset=utf-8',
    );
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBe(2);
    expect(response.body[0].type).toBe('heading');
    expect(response.body[1].type).toBe('paragraph');
    expect(response.body[0].content[0].type).toBe('text');
    expect(response.body[0].content[0].text).toBe('Test Document');
    expect(response.body[1].content[0].type).toBe('text');
    expect(response.body[1].content[0].text).toBe('This is test content.');
  });

  test('POST /api/convert with invalid Yjs content returns 400', async () => {
    const app = initApp();
    const response = await request(app)
      .post('/api/convert')
      .set('origin', origin)
      .set('authorization', apiKey)
      .set('content-type', 'application/vnd.yjs.doc')
      .set('accept', 'application/json')
      .send(Buffer.from('notvalidyjs'));
    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: 'Invalid Yjs content' });
  });
});
