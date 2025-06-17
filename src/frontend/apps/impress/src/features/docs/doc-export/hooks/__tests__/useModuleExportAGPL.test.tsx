import { renderHook, waitFor } from '@testing-library/react';

import { AppWrapper } from '@/tests/utils';

// Mock the environment variable
const originalEnv = process.env.NEXT_PUBLIC_PUBLISH_AS_MIT;

// Mock the libAGPL module
jest.mock(
  '../../libAGPL',
  () => ({
    exportToPdf: jest.fn(),
    exportToDocx: jest.fn(),
  }),
  { virtual: true },
);

describe('useModuleExport', () => {
  afterAll(() => {
    process.env.NEXT_PUBLIC_PUBLISH_AS_MIT = originalEnv;
  });

  it('should load modules when NEXT_PUBLIC_PUBLISH_AS_MIT is false', async () => {
    process.env.NEXT_PUBLIC_PUBLISH_AS_MIT = 'false';
    const { useModuleExport } = await import('../useModuleExport');

    const { result } = renderHook(() => useModuleExport(), {
      wrapper: AppWrapper,
    });

    // Initial state should be undefined
    expect(result.current).toBeUndefined();

    // After effects run, it should contain the modules from libAGPL
    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    expect(result.current).toHaveProperty('exportToPdf');
    expect(result.current).toHaveProperty('exportToDocx');
  });
});
