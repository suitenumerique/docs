import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/docs/doc-export/hooks/useExportAGPL', () => ({
  useExportAGPL: vi.fn(),
}));

const originalEnv = process.env.NEXT_PUBLIC_PUBLISH_AS_MIT;

describe('useModuleExport', () => {
  afterAll(() => {
    process.env.NEXT_PUBLIC_PUBLISH_AS_MIT = originalEnv;
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('should return undefined when NEXT_PUBLIC_PUBLISH_AS_MIT is true', async () => {
    process.env.NEXT_PUBLIC_PUBLISH_AS_MIT = 'true';
    const Export = await import('@/docs/doc-export/hooks');

    expect(Export.default).toBeUndefined();
  });

  it('should load modules when NEXT_PUBLIC_PUBLISH_AS_MIT is false', async () => {
    process.env.NEXT_PUBLIC_PUBLISH_AS_MIT = 'false';
    const Export = await import('@/docs/doc-export/hooks');

    expect(Export.default).toHaveProperty('useExportAGPL');
  });
});
