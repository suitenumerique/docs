import request from 'supertest';
import { describe, expect, test, vi } from 'vitest';

vi.mock('../src/env', async (importOriginal) => {
  return {
    ...(await importOriginal()),
    PORT: 5555,
    COLLABORATION_SERVER_ORIGIN: 'http://localhost:3000',
    COLLABORATION_SERVER_SECRET: 'test-secret-api-key',
  };
});

console.error = vi.fn();

import { COLLABORATION_SERVER_ORIGIN as origin } from '@/env';
import { hocuspocusServer, initApp } from '@/servers';

describe('Server Tests', () => {
  test('POST /collaboration/api/reset-connections?room=[ROOM_ID] with incorrect API key should return 403', async () => {
    const app = initApp();

    const response = await request(app)
      .post('/collaboration/api/reset-connections/?room=test-room')
      .set('Origin', origin)
      .set('Authorization', 'wrong-api-key');

    expect(response.status).toBe(401);
    expect(response.body).toStrictEqual({
      error: 'Unauthorized: Invalid API Key',
    });
  });

  test('POST /collaboration/api/reset-connections?room=[ROOM_ID] failed if room not indicated', async () => {
    const app = initApp();

    const response = await request(app)
      .post('/collaboration/api/reset-connections/')
      .set('Origin', origin)
      .set('Authorization', 'test-secret-api-key')
      .send({ document_id: 'test-document' });

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: 'Room name not provided' });
  });

  test('POST /collaboration/api/reset-connections?room=[ROOM_ID] with correct API key should reset connections', async () => {
    const closeConnectionsMock = vi
      .spyOn(hocuspocusServer, 'closeConnections')
      .mockResolvedValue();

    const app = initApp();

    const response = await request(app)
      .post('/collaboration/api/reset-connections?room=test-room')
      .set('Origin', origin)
      .set('Authorization', 'test-secret-api-key');

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({ message: 'Connections reset' });

    // eslint-disable-next-line jest/unbound-method
    expect(closeConnectionsMock).toHaveBeenCalledOnce();
  });
});
