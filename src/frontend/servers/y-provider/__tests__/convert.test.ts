import { ServerBlockNoteEditor } from '@blocknote/server-util';
import request from 'supertest';
import { afterEach, describe, expect, test, vi } from 'vitest';
import * as Y from 'yjs';

vi.mock('../src/env', async (importOriginal) => {
  return {
    ...(await importOriginal()),
    COLLABORATION_SERVER_ORIGIN: 'http://localhost:3000',
    Y_PROVIDER_API_KEY: 'yprovider-api-key',
  };
});

import { docsBlockNoteSchema } from '@/blockSpecs';
import { initApp } from '@/servers';

import {
  Y_PROVIDER_API_KEY as apiKey,
  COLLABORATION_SERVER_ORIGIN as origin,
} from '../src/env';

const expectedMarkdown = '# Example document\n\nLorem ipsum dolor sit amet.';
const expectedHTML =
  '<h1>Example document</h1><p>Lorem ipsum dolor sit amet.</p>';
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

describe('Conversion Testing', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test('POST /api/convert with incorrect API key responds with 401', async () => {
    const app = initApp();

    const response = await request(app)
      .post('/api/convert')
      .set('origin', origin)
      .set('authorization', `Bearer wrong-api-key`)
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
      .set('authorization', `Bearer ${apiKey}`)
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
      .set('authorization', `Bearer ${apiKey}`)
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
      .set('authorization', `Bearer ${apiKey}`)
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
      .set('authorization', `Bearer ${apiKey}`)
      .set('content-type', 'text/markdown')
      .set('accept', 'image/png')
      .send('# Header');

    expect(response.status).toBe(406);
    expect(response.body).toStrictEqual({ error: 'Unsupported format' });
  });

  test('POST /api/convert BlockNote to Markdown', async () => {
    const app = initApp();
    const response = await request(app)
      .post('/api/convert')
      .set('origin', origin)
      .set('authorization', `Bearer ${apiKey}`)
      .set('content-type', 'application/vnd.blocknote+json')
      .set('accept', 'text/markdown')
      .send(expectedBlocks);

    expect(response.status).toBe(200);
    expect(response.header['content-type']).toBe(
      'text/markdown; charset=utf-8',
    );
    expect(typeof response.text).toBe('string');
    expect(response.text.trim()).toBe(expectedMarkdown);
  });

  test('POST /api/convert BlockNote to Yjs', async () => {
    const destroySpy = vi.spyOn(Y.Doc.prototype, 'destroy');
    const app = initApp();
    const editor = ServerBlockNoteEditor.create();
    const blocks = await editor.tryParseMarkdownToBlocks(expectedMarkdown);
    const response = await request(app)
      .post('/api/convert')
      .set('origin', origin)
      .set('authorization', `Bearer ${apiKey}`)
      .set('content-type', 'application/vnd.blocknote+json')
      .set('accept', 'application/vnd.yjs.doc')
      .send(blocks)
      .responseType('blob');

    expect(response.status).toBe(200);
    expect(response.header['content-type']).toBe('application/vnd.yjs.doc');

    // Decode the Yjs response and verify it contains the correct blocks
    const responseBuffer = Buffer.from(response.body as Buffer);
    const ydoc = new Y.Doc();
    Y.applyUpdate(ydoc, responseBuffer);
    const decodedBlocks = editor.yDocToBlocks(ydoc, 'document-store');

    expect(decodedBlocks).toStrictEqual(expectedBlocks);
    expect(destroySpy).toHaveBeenCalledTimes(1);
  });

  test('POST /api/convert BlockNote to HTML', async () => {
    const app = initApp();
    const response = await request(app)
      .post('/api/convert')
      .set('origin', origin)
      .set('authorization', `Bearer ${apiKey}`)
      .set('content-type', 'application/vnd.blocknote+json')
      .set('accept', 'text/html')
      .send(expectedBlocks);

    expect(response.status).toBe(200);
    expect(response.header['content-type']).toBe('text/html; charset=utf-8');
    expect(typeof response.text).toBe('string');
    expect(response.text).toBe(expectedHTML);
  });

  test('POST /api/convert Yjs to HTML', async () => {
    const app = initApp();
    const editor = ServerBlockNoteEditor.create();
    const blocks = await editor.tryParseMarkdownToBlocks(expectedMarkdown);
    const yDocument = editor.blocksToYDoc(blocks, 'document-store');
    const yjsUpdate = Y.encodeStateAsUpdate(yDocument);
    const response = await request(app)
      .post('/api/convert')
      .set('origin', origin)
      .set('authorization', `Bearer ${apiKey}`)
      .set('content-type', 'application/vnd.yjs.doc')
      .set('accept', 'text/html')
      .send(Buffer.from(yjsUpdate));

    expect(response.status).toBe(200);
    expect(response.header['content-type']).toBe('text/html; charset=utf-8');
    expect(typeof response.text).toBe('string');
    expect(response.text).toBe(expectedHTML);
  });

  test('POST /api/convert Yjs to Markdown', async () => {
    const app = initApp();
    const editor = ServerBlockNoteEditor.create();
    const blocks = await editor.tryParseMarkdownToBlocks(expectedMarkdown);
    const yDocument = editor.blocksToYDoc(blocks, 'document-store');
    const yjsUpdate = Y.encodeStateAsUpdate(yDocument);
    const response = await request(app)
      .post('/api/convert')
      .set('origin', origin)
      .set('authorization', `Bearer ${apiKey}`)
      .set('content-type', 'application/vnd.yjs.doc')
      .set('accept', 'text/markdown')
      .send(Buffer.from(yjsUpdate));

    expect(response.status).toBe(200);
    expect(response.header['content-type']).toBe(
      'text/markdown; charset=utf-8',
    );
    expect(typeof response.text).toBe('string');
    expect(response.text.trim()).toBe(expectedMarkdown);
  });

  test('POST /api/convert Yjs to JSON', async () => {
    const destroySpy = vi.spyOn(Y.Doc.prototype, 'destroy');
    const app = initApp();
    const editor = ServerBlockNoteEditor.create();
    const blocks = await editor.tryParseMarkdownToBlocks(expectedMarkdown);
    const yDocument = editor.blocksToYDoc(blocks, 'document-store');
    const yjsUpdate = Y.encodeStateAsUpdate(yDocument);
    const response = await request(app)
      .post('/api/convert')
      .set('origin', origin)
      .set('authorization', `Bearer ${apiKey}`)
      .set('content-type', 'application/vnd.yjs.doc')
      .set('accept', 'application/json')
      .send(Buffer.from(yjsUpdate));

    expect(response.status).toBe(200);
    expect(response.header['content-type']).toBe(
      'application/json; charset=utf-8',
    );
    expect(response.body).toBeInstanceOf(Array);
    expect(response.body).toStrictEqual(expectedBlocks);
    expect(destroySpy).toHaveBeenCalledTimes(1);
  });

  test('POST /api/convert Markdown to JSON', async () => {
    const app = initApp();
    const response = await request(app)
      .post('/api/convert')
      .set('origin', origin)
      .set('authorization', `Bearer ${apiKey}`)
      .set('content-type', 'text/markdown')
      .set('accept', 'application/json')
      .send(expectedMarkdown);

    expect(response.status).toBe(200);
    expect(response.header['content-type']).toBe(
      'application/json; charset=utf-8',
    );
    expect(response.body).toBeInstanceOf(Array);
    expect(response.body).toStrictEqual(expectedBlocks);
  });

  test('POST /api/convert Yjs to HTML with callout block', async () => {
    const app = initApp();
    const editor = ServerBlockNoteEditor.create({
      schema: docsBlockNoteSchema,
    });
    const blocks = [
      {
        type: 'callout' as const,
        props: { emoji: '⚠️', backgroundColor: 'yellow' },
        content: [{ type: 'text' as const, text: 'Be careful', styles: {} }],
      },
    ];
    const yDocument = editor.blocksToYDoc(blocks, 'document-store');
    const yjsUpdate = Y.encodeStateAsUpdate(yDocument);
    const response = await request(app)
      .post('/api/convert')
      .set('origin', origin)
      .set('authorization', `Bearer ${apiKey}`)
      .set('content-type', 'application/vnd.yjs.doc')
      .set('accept', 'text/html')
      .send(Buffer.from(yjsUpdate));

    expect(response.status).toBe(200);
    expect(response.text).toContain('<aside');
    expect(response.text).toContain('role="note"');
    expect(response.text).toContain('data-emoji="⚠️"');
    expect(response.text).toContain('data-background-color="yellow"');
    expect(response.text).toContain('Be careful');
    // The inner emoji span is marked so downstream parsers can drop it
    // (the canonical emoji is on the <aside>).
    expect(response.text).toContain(
      '<span aria-hidden="true" data-emoji="⚠️">',
    );
  });

  test('POST /api/convert Yjs to Markdown preserves callout content', async () => {
    const app = initApp();
    const editor = ServerBlockNoteEditor.create({
      schema: docsBlockNoteSchema,
    });
    const blocks = [
      {
        type: 'callout' as const,
        props: { emoji: '⚠️', backgroundColor: 'yellow' },
        content: [{ type: 'text' as const, text: 'Be careful', styles: {} }],
      },
    ];
    const yDocument = editor.blocksToYDoc(blocks, 'document-store');
    const yjsUpdate = Y.encodeStateAsUpdate(yDocument);
    const response = await request(app)
      .post('/api/convert')
      .set('origin', origin)
      .set('authorization', `Bearer ${apiKey}`)
      .set('content-type', 'application/vnd.yjs.doc')
      .set('accept', 'text/markdown')
      .send(Buffer.from(yjsUpdate));

    expect(response.status).toBe(200);
    expect(response.text).toContain('⚠️');
    expect(response.text).toContain('Be careful');
  });

  test('POST /api/convert Yjs to Markdown preserves interlinking link', async () => {
    const app = initApp();
    const editor = ServerBlockNoteEditor.create({
      schema: docsBlockNoteSchema,
    });
    const blocks = [
      {
        type: 'paragraph' as const,
        content: [
          {
            type: 'interlinkingLinkInline' as const,
            props: {
              docId: '00000000-0000-0000-0000-000000000123',
              title: 'Other doc',
              disabled: false,
              trigger: '/' as const,
            },
          },
        ],
      },
    ];
    const yDocument = editor.blocksToYDoc(blocks, 'document-store');
    const yjsUpdate = Y.encodeStateAsUpdate(yDocument);
    const response = await request(app)
      .post('/api/convert')
      .set('origin', origin)
      .set('authorization', `Bearer ${apiKey}`)
      .set('content-type', 'application/vnd.yjs.doc')
      .set('accept', 'text/markdown')
      .send(Buffer.from(yjsUpdate));

    expect(response.status).toBe(200);
    expect(response.text).toContain(
      '[Other doc](/docs/00000000-0000-0000-0000-000000000123/ "Other doc")',
    );
  });

  test('POST /api/convert Yjs to HTML with PDF block', async () => {
    const app = initApp();
    const editor = ServerBlockNoteEditor.create({
      schema: docsBlockNoteSchema,
    });
    const blocks = [
      {
        type: 'pdf' as const,
        props: {
          url: 'https://example.com/file.pdf',
          name: 'Annual report',
          showPreview: true,
        },
      },
    ];
    const yDocument = editor.blocksToYDoc(blocks, 'document-store');
    const yjsUpdate = Y.encodeStateAsUpdate(yDocument);
    const response = await request(app)
      .post('/api/convert')
      .set('origin', origin)
      .set('authorization', `Bearer ${apiKey}`)
      .set('content-type', 'application/vnd.yjs.doc')
      .set('accept', 'text/html')
      .send(Buffer.from(yjsUpdate));

    expect(response.status).toBe(200);
    expect(response.text).toContain('<iframe');
    expect(response.text).toContain('src="https://example.com/file.pdf"');
    expect(response.text).toContain('title="Annual report"');
  });

  test('POST /api/convert Yjs to HTML strips unsafe PDF URL schemes', async () => {
    const app = initApp();
    const editor = ServerBlockNoteEditor.create({
      schema: docsBlockNoteSchema,
    });
    const blocks = [
      {
        type: 'pdf' as const,
        props: {
          url: 'javascript:alert(1)',
          name: 'Malicious',
          showPreview: true,
        },
      },
    ];
    const yDocument = editor.blocksToYDoc(blocks, 'document-store');
    const yjsUpdate = Y.encodeStateAsUpdate(yDocument);
    const response = await request(app)
      .post('/api/convert')
      .set('origin', origin)
      .set('authorization', `Bearer ${apiKey}`)
      .set('content-type', 'application/vnd.yjs.doc')
      .set('accept', 'text/html')
      .send(Buffer.from(yjsUpdate));

    expect(response.status).toBe(200);
    expect(response.text).not.toContain('<iframe');
    expect(response.text).not.toMatch(/(?:src|href)="javascript:/);
  });

  test('POST /api/convert Yjs to HTML with interlinking inline content', async () => {
    const app = initApp();
    const editor = ServerBlockNoteEditor.create({
      schema: docsBlockNoteSchema,
    });
    const blocks = [
      {
        type: 'paragraph' as const,
        content: [
          {
            type: 'interlinkingLinkInline' as const,
            props: {
              docId: '00000000-0000-0000-0000-000000000123',
              title: 'Other doc',
              disabled: false,
              trigger: '/' as const,
            },
          },
        ],
      },
    ];
    const yDocument = editor.blocksToYDoc(blocks, 'document-store');
    const yjsUpdate = Y.encodeStateAsUpdate(yDocument);
    const response = await request(app)
      .post('/api/convert')
      .set('origin', origin)
      .set('authorization', `Bearer ${apiKey}`)
      .set('content-type', 'application/vnd.yjs.doc')
      .set('accept', 'text/html')
      .send(Buffer.from(yjsUpdate));

    expect(response.status).toBe(200);
    expect(response.text).toContain(
      'href="/docs/00000000-0000-0000-0000-000000000123/"',
    );
    expect(response.text).toContain(
      'data-doc-id="00000000-0000-0000-0000-000000000123"',
    );
    expect(response.text).toContain('title="Other doc"');
    expect(response.text).toContain('Other doc');
    expect(response.text).not.toContain('data-inline-content-type');
  });

  test('POST /api/convert Yjs to HTML with disabled interlinking renders no link', async () => {
    const app = initApp();
    const editor = ServerBlockNoteEditor.create({
      schema: docsBlockNoteSchema,
    });
    const blocks = [
      {
        type: 'paragraph' as const,
        content: [
          {
            type: 'interlinkingLinkInline' as const,
            props: {
              docId: '00000000-0000-0000-0000-000000000123',
              title: 'Hidden',
              disabled: true,
              trigger: '/' as const,
            },
          },
        ],
      },
    ];
    const yDocument = editor.blocksToYDoc(blocks, 'document-store');
    const yjsUpdate = Y.encodeStateAsUpdate(yDocument);
    const response = await request(app)
      .post('/api/convert')
      .set('origin', origin)
      .set('authorization', `Bearer ${apiKey}`)
      .set('content-type', 'application/vnd.yjs.doc')
      .set('accept', 'text/html')
      .send(Buffer.from(yjsUpdate));

    expect(response.status).toBe(200);
    expect(response.text).not.toContain('href=');
    expect(response.text).not.toContain('data-doc-id');
    expect(response.text).not.toContain('Hidden');
  });

  test('POST /api/convert Yjs to BlockNote JSON preserves pageBreak block', async () => {
    const app = initApp();
    const editor = ServerBlockNoteEditor.create({
      schema: docsBlockNoteSchema,
    });
    const blocks = [
      {
        type: 'paragraph' as const,
        content: [{ type: 'text' as const, text: 'before', styles: {} }],
      },
      { type: 'pageBreak' as const },
      {
        type: 'paragraph' as const,
        content: [{ type: 'text' as const, text: 'after', styles: {} }],
      },
    ];
    const yDocument = editor.blocksToYDoc(blocks, 'document-store');
    const yjsUpdate = Y.encodeStateAsUpdate(yDocument);
    const response = await request(app)
      .post('/api/convert')
      .set('origin', origin)
      .set('authorization', `Bearer ${apiKey}`)
      .set('content-type', 'application/vnd.yjs.doc')
      .set('accept', 'application/json')
      .send(Buffer.from(yjsUpdate));

    expect(response.status).toBe(200);
    const types = (response.body as { type: string }[]).map((b) => b.type);
    expect(types).toContain('pageBreak');
  });

  test('POST /api/convert Yjs to BlockNote JSON preserves uploadLoader block', async () => {
    const app = initApp();
    const editor = ServerBlockNoteEditor.create({
      schema: docsBlockNoteSchema,
    });
    const blocks = [
      {
        type: 'uploadLoader' as const,
        props: {
          information: 'uploading',
          type: 'loading' as const,
          blockUploadName: 'doc.pdf',
        },
      },
    ];
    const yDocument = editor.blocksToYDoc(blocks, 'document-store');
    const yjsUpdate = Y.encodeStateAsUpdate(yDocument);
    const response = await request(app)
      .post('/api/convert')
      .set('origin', origin)
      .set('authorization', `Bearer ${apiKey}`)
      .set('content-type', 'application/vnd.yjs.doc')
      .set('accept', 'application/json')
      .send(Buffer.from(yjsUpdate));

    expect(response.status).toBe(200);
    const uploadLoader = (
      response.body as { type: string; props: Record<string, unknown> }[]
    ).find((b) => b.type === 'uploadLoader');
    expect(uploadLoader).toBeDefined();
    expect(uploadLoader?.props).toMatchObject({
      information: 'uploading',
      type: 'loading',
      blockUploadName: 'doc.pdf',
    });
  });

  test('POST /api/convert with invalid Yjs content returns 400', async () => {
    const destroySpy = vi.spyOn(Y.Doc.prototype, 'destroy');
    const app = initApp();
    const response = await request(app)
      .post('/api/convert')
      .set('origin', origin)
      .set('authorization', `Bearer ${apiKey}`)
      .set('content-type', 'application/vnd.yjs.doc')
      .set('accept', 'application/json')
      .send(Buffer.from('notvalidyjs'));

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: 'Invalid content' });
    expect(destroySpy).toHaveBeenCalledTimes(1);
  });
});
