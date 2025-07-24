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

describe('Content API Tests', () => {
  test('POST /api/content with incorrect API key responds with 401', async () => {
    const app = initApp();

    const response = await request(app)
      .post('/api/content')
      .set('origin', origin)
      .set('authorization', 'wrong-api-key')
      .set('content-type', 'application/json')
      .send({
        content: 'dGVzdA==', // base64 for "test"
        format: 'json',
      });

    expect(response.status).toBe(401);
    expect(response.body).toStrictEqual({
      error: 'Unauthorized: Invalid API Key',
    });
  });

  test('POST /api/content with incorrect Bearer token responds with 401', async () => {
    const app = initApp();

    const response = await request(app)
      .post('/api/content')
      .set('origin', origin)
      .set('authorization', 'Bearer test-secret-api-key')
      .set('content-type', 'application/json')
      .send({
        content: 'dGVzdA==', // base64 for "test"
        format: 'json',
      });

    expect(response.status).toBe(401);
    expect(response.body).toStrictEqual({
      error: 'Unauthorized: Invalid API Key',
    });
  });

  test('POST /api/content with missing content parameter', async () => {
    const app = initApp();

    const response = await request(app)
      .post('/api/content')
      .set('origin', origin)
      .set('authorization', apiKey)
      .set('content-type', 'application/json')
      .send({
        format: 'json',
      });

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({
      error: 'Invalid request: missing content',
    });
  });

  test('POST /api/content with empty content', async () => {
    const app = initApp();

    const response = await request(app)
      .post('/api/content')
      .set('origin', origin)
      .set('authorization', apiKey)
      .set('content-type', 'application/json')
      .send({
        content: '',
        format: 'json',
      });

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({
      error: 'Invalid request: missing content',
    });
  });

  test('POST /api/content with missing format parameter', async () => {
    const app = initApp();

    const response = await request(app)
      .post('/api/content')
      .set('origin', origin)
      .set('authorization', apiKey)
      .set('content-type', 'application/json')
      .send({
        content: 'dGVzdA==',
      });

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({
      error: 'Invalid format. Must be one of: json, markdown, html',
    });
  });

  test('POST /api/content with invalid format', async () => {
    const app = initApp();

    const response = await request(app)
      .post('/api/content')
      .set('origin', origin)
      .set('authorization', apiKey)
      .set('content-type', 'application/json')
      .send({
        content: 'dGVzdA==',
        format: 'invalid',
      });

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({
      error: 'Invalid format. Must be one of: json, markdown, html',
    });
  });

  test.each([
    { authHeader: `Bearer ${apiKey}`, format: 'json' },
    { authHeader: `Bearer ${apiKey}`, format: 'markdown' },
    { authHeader: `Bearer ${apiKey}`, format: 'html' },
  ])(
    'POST /api/content with correct content and format $format with Authorization: $authHeader',
    async ({ authHeader, format }) => {
      const app = initApp();

      // Create a simple Yjs document for testing using BlockNote
      const editor = ServerBlockNoteEditor.create();
      const markdownContent = '# Test Document\n\nThis is test content.';
      const blocks = await editor.tryParseMarkdownToBlocks(markdownContent);
      const yDocument = editor.blocksToYDoc(blocks, 'document-store');
      const yjsUpdate = Y.encodeStateAsUpdate(yDocument);
      const base64Content = Buffer.from(yjsUpdate).toString('base64');

      const response = await request(app)
        .post('/api/content')
        .set('Origin', origin)
        .set('Authorization', authHeader)
        .set('content-type', 'application/json')
        .send({
          content: base64Content,
          format: format,
        });
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('content');
      expect(response.body).toHaveProperty('format', format);

      // Verify the content based on format
      if (format === 'json') {
        const parsedContent = response.body.content;
        expect(Array.isArray(parsedContent)).toBe(true);
        expect(parsedContent.length).toBe(2);
        expect(parsedContent[0].type).toBe('heading');
        expect(parsedContent[1].type).toBe('paragraph');
        expect(parsedContent[0].content[0].type).toBe('text');
        expect(parsedContent[0].content[0].text).toBe('Test Document');
        expect(parsedContent[1].content[0].type).toBe('text');
        expect(parsedContent[1].content[0].text).toBe('This is test content.');
      } else if (format === 'markdown') {
        expect(typeof response.body.content).toBe('string');
        expect(response.body.content.trim()).toBe(markdownContent);
      } else if (format === 'html') {
        expect(typeof response.body.content).toBe('string');
        expect(response.body.content).toBe(
          '<h1>Test Document</h1><p>This is test content.</p>',
        );
      }
    },
  );

  test('POST /api/content with invalid base64 content returns 500', async () => {
    const app = initApp();

    const response = await request(app)
      .post('/api/content')
      .set('origin', origin)
      .set('authorization', apiKey)
      .set('content-type', 'application/json')
      .send({
        content: 'invalid-base64-content!@#',
        format: 'json',
      });

    expect(response.status).toBe(500);
    expect(response.body).toStrictEqual({
      error: 'An error occurred during conversion',
    });
  });
});
