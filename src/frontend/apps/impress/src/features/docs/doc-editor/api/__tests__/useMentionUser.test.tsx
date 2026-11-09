import { renderHook, waitFor } from '@testing-library/react';
import fetchMock from 'fetch-mock';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { mentionUser, useMentionUser } from '../useMentionUser';

const docId = 'doc-id';
const url = `http://test.jest/api/v1.0/documents/${docId}/mention/`;
const params = {
  docId,
  anchorId: 'a3a5bd0d-4b2f-4a7c-9c1e-5a5e8e1d2f10',
  mentionedUserId: '9e1b2f6c-6c58-4f43-8b2e-2b4f0c1f7d33',
};

describe('mentionUser', () => {
  beforeEach(() => {
    fetchMock.hardReset();
    fetchMock.mockGlobal();
  });

  it('posts the anchor and the mentioned user in the format of the backend', async () => {
    fetchMock.post(url, { status: 201, body: { id: 'mention-id' } });

    await expect(mentionUser(params)).resolves.toEqual({ id: 'mention-id' });

    const lastCall = fetchMock.callHistory.lastCall(url);
    expect(lastCall?.options.method).toBe('post');
    expect(JSON.parse(lastCall?.options.body as string)).toEqual({
      anchor_id: params.anchorId,
      mentioned_user_id: params.mentionedUserId,
    });
  });

  it('throws an APIError when the backend refuses the mention', async () => {
    fetchMock.post(url, {
      status: 400,
      body: { mentioned_user_id: ['This user does not have access.'] },
    });

    await expect(mentionUser(params)).rejects.toMatchObject({
      message: 'Failed to mention the user',
      status: 400,
    });
  });
});

describe('useMentionUser', () => {
  beforeEach(() => {
    fetchMock.hardReset();
    fetchMock.mockGlobal();
  });

  it('exposes the mutation to mention a user', async () => {
    fetchMock.post(url, { status: 201, body: { id: 'mention-id' } });

    const { result } = renderHook(() => useMentionUser(), {
      wrapper: AppWrapper,
    });

    result.current.mutate(params);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock.callHistory.calls(url)).toHaveLength(1);
  });

  it('calls the given error callback when the mention fails', async () => {
    fetchMock.post(url, { status: 403, body: {} });
    const onError = vi.fn();

    const { result } = renderHook(() => useMentionUser({ onError }), {
      wrapper: AppWrapper,
    });

    result.current.mutate(params);

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
  });
});
