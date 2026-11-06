import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { useClipboard } from '@/hooks';

import { useCopyDocLink } from '../useCopyDocLink';

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
}));

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

describe('useCopyDocLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderCopyLink = () => renderHook(() => useCopyDocLink('123'));

  test('resolves true when the link was copied', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    const { result } = renderCopyLink();

    await expect(result.current()).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/docs/123/`,
    );
  });

  test('resolves false when the write rejects', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });

    const { result } = renderCopyLink();

    await expect(result.current()).resolves.toBe(false);
  });

  test('resolves false when the Clipboard API is unavailable', async () => {
    Object.assign(navigator, { clipboard: undefined });

    const { result } = renderCopyLink();

    await expect(result.current()).resolves.toBe(false);
  });
});

describe('useClipboard', () => {
  test('resolves false when writeText throws synchronously', async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: () => {
          throw new Error('not allowed');
        },
      },
    });

    const { result } = renderHook(() => useClipboard());

    await expect(result.current('text')).resolves.toBe(false);
    expect(mocks.toast).toHaveBeenCalled();
  });
});
