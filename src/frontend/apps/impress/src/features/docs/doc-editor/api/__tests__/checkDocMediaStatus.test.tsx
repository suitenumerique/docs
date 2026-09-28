import fetchMock from 'fetch-mock';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  checkDocMediaStatus,
  loopCheckDocMediaStatus,
} from '../checkDocMediaStatus';

const VALID_URL = 'http://test.jest/media-check/some-file-id';

describe('checkDocMediaStatus', () => {
  beforeEach(() => {
    fetchMock.hardReset();
    fetchMock.mockGlobal();
  });

  afterEach(() => {
    fetchMock.hardReset();
  });

  it('returns the response when the status is ready', async () => {
    fetchMock.get(VALID_URL, {
      body: { status: 'ready', file: '/media/some-file.pdf' },
    });

    const result = await checkDocMediaStatus({ urlMedia: VALID_URL });

    expect(result).toEqual({ status: 'ready', file: '/media/some-file.pdf' });
    expect(fetchMock.callHistory.lastCall(VALID_URL)?.options).toMatchObject({
      credentials: 'include',
    });
  });

  it('returns the response when the status is processing', async () => {
    fetchMock.get(VALID_URL, {
      body: { status: 'processing' },
    });

    const result = await checkDocMediaStatus({ urlMedia: VALID_URL });

    expect(result).toEqual({ status: 'processing' });
  });

  it('throws an APIError when the URL is not safe', async () => {
    await expect(
      checkDocMediaStatus({ urlMedia: 'javascript:alert(1)' }),
    ).rejects.toMatchObject({ status: 400 });

    expect(fetchMock.callHistory.calls().length).toBe(0);
  });

  it('throws an APIError when the URL does not contain the analyze path', async () => {
    await expect(
      checkDocMediaStatus({ urlMedia: 'http://test.jest/other/path' }),
    ).rejects.toMatchObject({ status: 400 });

    expect(fetchMock.callHistory.calls().length).toBe(0);
  });

  it('throws an APIError when the fetch response is not ok', async () => {
    fetchMock.get(VALID_URL, {
      status: 500,
      body: JSON.stringify({ detail: 'Internal server error' }),
    });

    await expect(
      checkDocMediaStatus({ urlMedia: VALID_URL }),
    ).rejects.toMatchObject({ status: 500 });
  });

  it('forwards the AbortSignal to fetch', async () => {
    const controller = new AbortController();
    controller.abort();

    fetchMock.get(VALID_URL, { body: { status: 'ready' } });

    await expect(
      checkDocMediaStatus({ urlMedia: VALID_URL, signal: controller.signal }),
    ).rejects.toThrow();
  });
});

describe('loopCheckDocMediaStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.hardReset();
    fetchMock.mockGlobal();
  });

  afterEach(() => {
    vi.useRealTimers();
    fetchMock.hardReset();
  });

  it('resolves immediately when the status is already ready', async () => {
    fetchMock.get(VALID_URL, {
      body: { status: 'ready', file: '/media/file.pdf' },
    });

    const result = await loopCheckDocMediaStatus(
      VALID_URL,
      new AbortController().signal,
    );

    expect(result).toEqual({ status: 'ready', file: '/media/file.pdf' });
    expect(fetchMock.callHistory.calls().length).toBe(1);
  });

  it('retries until the status becomes ready', async () => {
    let callCount = 0;
    fetchMock.route(VALID_URL, () => {
      callCount++;
      return {
        status: 200,
        body: JSON.stringify(
          callCount >= 3
            ? { status: 'ready', file: '/media/file.pdf' }
            : { status: 'processing' },
        ),
      };
    });

    const promise = loopCheckDocMediaStatus(
      VALID_URL,
      new AbortController().signal,
    );

    // Advance timers for each sleep between retries
    await vi.runAllTimersAsync();

    const result = await promise;

    expect(result).toEqual({ status: 'ready', file: '/media/file.pdf' });
    expect(fetchMock.callHistory.calls().length).toBe(3);
  });

  it('throws an AbortError immediately when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    fetchMock.get(VALID_URL, { body: { status: 'processing' } });

    await expect(
      loopCheckDocMediaStatus(VALID_URL, controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' });

    expect(fetchMock.callHistory.calls().length).toBe(0);
  });

  it('stops the loop when the signal is aborted during a sleep', async () => {
    fetchMock.get(VALID_URL, { body: { status: 'processing' } });

    const controller = new AbortController();

    const rejectExpectation = expect(
      loopCheckDocMediaStatus(VALID_URL, controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' });

    controller.abort();

    await rejectExpectation;
    // Only the first request should have been made
    expect(fetchMock.callHistory.calls().length).toBe(1);
  });

  it('rejects when a fetch error occurs', async () => {
    fetchMock.get(VALID_URL, {
      status: 500,
      body: JSON.stringify({ detail: 'Internal server error' }),
    });

    // Error happens on the first fetch — no timer advancement needed.
    await expect(
      loopCheckDocMediaStatus(VALID_URL, new AbortController().signal),
    ).rejects.toMatchObject({ status: 500 });

    expect(fetchMock.callHistory.calls().length).toBe(1);
  });
});
