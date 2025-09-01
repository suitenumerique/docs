import { afterEach, describe, expect, it, vi } from 'vitest';
/**
 * @jest-environment node
 */

import { SyncManager } from '../SyncManager';

const mockedSleep = vi.fn();
vi.mock('@/utils/system', () => ({
  sleep: vi.fn().mockImplementation((ms) => mockedSleep(ms)),
}));

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('SyncManager', () => {
  afterEach(() => vi.clearAllMocks());

  it('checks SyncManager no sync to do', async () => {
    const toSync = vi.fn();
    const hasSyncToDo = vi.fn().mockResolvedValue(false);
    new SyncManager(toSync, hasSyncToDo);

    await delay(100);

    expect(hasSyncToDo).toHaveBeenCalled();
    expect(toSync).not.toHaveBeenCalled();
  });

  it('checks SyncManager sync to do', async () => {
    const toSync = vi.fn();
    const hasSyncToDo = vi.fn().mockResolvedValue(true);
    new SyncManager(toSync, hasSyncToDo);

    await delay(100);

    expect(hasSyncToDo).toHaveBeenCalled();
    expect(toSync).toHaveBeenCalled();
  });

  it('checks SyncManager sync to do trigger error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const toSync = vi.fn().mockRejectedValue(new Error('error'));
    const hasSyncToDo = vi.fn().mockResolvedValue(true);
    new SyncManager(toSync, hasSyncToDo);

    await delay(100);

    expect(hasSyncToDo).toHaveBeenCalled();
    expect(toSync).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      'SW-DEV: SyncManager.sync failed:',
      new Error('error'),
    );
  });

  it('checks SyncManager multiple sync to do', async () => {
    const toSync = vi.fn().mockReturnValue(delay(200));
    const hasSyncToDo = vi.fn().mockResolvedValue(true);
    const syncManager = new SyncManager(toSync, hasSyncToDo);

    await syncManager.sync();

    expect(hasSyncToDo).toHaveBeenCalled();
    expect(mockedSleep).toHaveBeenCalledWith(300);
    expect(mockedSleep).toHaveBeenCalledTimes(15);
    expect(toSync).toHaveBeenCalledTimes(1);
  });
});
