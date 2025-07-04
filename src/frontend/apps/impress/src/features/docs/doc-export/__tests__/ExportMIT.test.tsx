const originalEnv = process.env.NEXT_PUBLIC_PUBLISH_AS_MIT;

jest.mock('@/features/docs/doc-export/utils', () => ({
  anything: true,
}));
jest.mock('@/features/docs/doc-export/components/ModalExport', () => ({
  ModalExport: () => <span>ModalExport</span>,
}));

describe('useModuleExport', () => {
  afterAll(() => {
    process.env.NEXT_PUBLIC_PUBLISH_AS_MIT = originalEnv;
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('should return undefined when NEXT_PUBLIC_PUBLISH_AS_MIT is true', async () => {
    process.env.NEXT_PUBLIC_PUBLISH_AS_MIT = 'true';
    const Export = await import('@/features/docs/doc-export/');

    expect(Export.default).toBeUndefined();
  });

  it('should load modules when NEXT_PUBLIC_PUBLISH_AS_MIT is false', async () => {
    process.env.NEXT_PUBLIC_PUBLISH_AS_MIT = 'false';
    const Export = await import('@/features/docs/doc-export/');

    expect(Export.default).toHaveProperty('ModalExport');
  });
});
