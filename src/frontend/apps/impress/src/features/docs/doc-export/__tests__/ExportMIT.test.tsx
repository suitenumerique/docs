import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
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
    const Export = await import('@/features/docs/doc-export/');

    expect(Export.default).toBeUndefined();
  }, 15000);

  it('should load modules when NEXT_PUBLIC_PUBLISH_AS_MIT is false', async () => {
    process.env.NEXT_PUBLIC_PUBLISH_AS_MIT = 'false';
    const Export = await import('@/features/docs/doc-export/');

    expect(Export.default).toHaveProperty('ModalExport');
  }, 15000);
});
