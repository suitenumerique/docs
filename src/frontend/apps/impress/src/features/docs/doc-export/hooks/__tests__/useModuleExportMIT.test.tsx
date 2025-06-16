import { renderHook } from '@testing-library/react';

import { AppWrapper } from '@/tests/utils';
import { sleep } from '@/utils';

const originalEnv = process.env.NEXT_PUBLIC_PUBLISH_AS_MIT;

describe('useModuleExport', () => {
  afterAll(() => {
    process.env.NEXT_PUBLIC_PUBLISH_AS_MIT = originalEnv;
  });

  it('should return null when NEXT_PUBLIC_PUBLISH_AS_MIT is true', async () => {
    const { useModuleExport } = await import('../useModuleExport');

    const { result } = renderHook(() => useModuleExport(), {
      wrapper: AppWrapper,
    });

    expect(result.current).toBeUndefined();

    await sleep(1000);

    expect(result.current).toBeUndefined();
  });
});
