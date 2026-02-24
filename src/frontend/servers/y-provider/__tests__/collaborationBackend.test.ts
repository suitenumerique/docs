import axios from 'axios';
import { describe, expect, test, vi } from 'vitest';

vi.mock('../src/env', () => ({
  COLLABORATION_BACKEND_BASE_URL: 'http://app-dev:8000',
  Y_PROVIDER_API_KEY: 'test-yprovider-key',
}));

describe('CollaborationBackend', () => {
  test('fetchDocument sends X-Y-Provider-Key header', async () => {
    const axiosGetSpy = vi.spyOn(axios, 'get').mockResolvedValue({
      status: 200,
      data: {
        id: 'test-doc-id',
        abilities: { retrieve: true, update: true },
      },
    });

    const { fetchDocument } = await import('@/api/collaborationBackend');
    const documentId = 'test-document-123';

    await fetchDocument(
      { name: documentId, withoutContent: true },
      { cookie: 'test-cookie' },
    );

    expect(axiosGetSpy).toHaveBeenCalledWith(
      `http://app-dev:8000/api/v1.0/documents/${documentId}/?without_content=true`,
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Y-Provider-Key': 'test-yprovider-key',
          cookie: 'test-cookie',
        }),
      }),
    );

    axiosGetSpy.mockRestore();
  });

  test('fetchCurrentUser sends X-Y-Provider-Key header', async () => {
    const axiosGetSpy = vi.spyOn(axios, 'get').mockResolvedValue({
      status: 200,
      data: {
        id: 'test-user-id',
        email: 'test@example.com',
      },
    });

    const { fetchCurrentUser } = await import('@/api/collaborationBackend');

    await fetchCurrentUser({
      cookie: 'test-cookie',
      origin: 'http://localhost:3000',
    });

    expect(axiosGetSpy).toHaveBeenCalledWith(
      'http://app-dev:8000/api/v1.0/users/me/',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Y-Provider-Key': 'test-yprovider-key',
          cookie: 'test-cookie',
          origin: 'http://localhost:3000',
        }),
      }),
    );

    axiosGetSpy.mockRestore();
  });
});
