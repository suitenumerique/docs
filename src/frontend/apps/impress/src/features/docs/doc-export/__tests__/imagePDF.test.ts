import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../utils')>()),
  convertBlobToPng: vi.fn(),
  convertSvgToPng: vi.fn(),
}));

import { createBlockMappingImagePDF } from '../blocks-mapping/imagePDF';
import { DocsExporterPDF } from '../types';
import { convertBlobToPng, convertSvgToPng } from '../utils';

// "canvas" and "svg" base64 encoded
const CANVAS_PNG_URL = 'data:image/png;base64,Y2FudmFz';
const SVG_CONVERTED_URL = 'data:image/png;base64,c3Zn';

function makeBlock(
  props: Partial<{
    url: string;
    name: string;
    previewWidth: number;
    caption: string;
    textAlignment: 'left' | 'center' | 'right' | 'justify';
  }> = {},
) {
  return {
    id: 'test-block',
    type: 'image' as const,
    props: {
      url: 'https://example.com/image.png',
      name: '',
      showPreview: true,
      previewWidth: 0,
      caption: '',
      backgroundColor: 'default' as const,
      textColor: 'default' as const,
      textAlignment: 'left' as const,
      ...props,
    },
    children: [],
    content: undefined,
  };
}

function makeExporter(blob: Blob | Error) {
  const resolveFile =
    blob instanceof Error
      ? vi.fn().mockRejectedValue(blob)
      : vi.fn().mockResolvedValue(blob);
  const registerImageBytes = vi.fn().mockReturnValue('/assets/asset-0');

  return {
    exporter: { resolveFile, registerImageBytes } as unknown as DocsExporterPDF,
    resolveFile,
    registerImageBytes,
  };
}

// Compares the bytes as text: jsdom and node do not share the same Uint8Array
const decode = (bytes: Uint8Array) => String.fromCharCode(...bytes);

const pngBlob = () => new Blob(['fake-png'], { type: 'image/png' });

const blockMappingImagePDF = createBlockMappingImagePDF('Image unavailable');
const UNAVAILABLE =
  '#text(fill: luma(110), style: "italic")[#"⚠️ Image unavailable"]';

describe('blockMappingImagePDF', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when the image has no url', async () => {
    const { exporter, resolveFile } = makeExporter(pngBlob());
    const result = await blockMappingImagePDF(
      makeBlock({ url: '' }),
      exporter,
      0,
    );

    expect(result).toBe('');
    expect(resolveFile).not.toHaveBeenCalled();
  });

  it('renders a message when the blob is not an image', async () => {
    const { exporter, registerImageBytes } = makeExporter(
      new Blob(['data'], { type: 'video/mp4' }),
    );
    const result = await blockMappingImagePDF(makeBlock(), exporter, 0);

    expect(result).toBe(UNAVAILABLE);
    expect(registerImageBytes).not.toHaveBeenCalled();
  });

  it('renders a message instead of failing the export when the file cannot be resolved', async () => {
    const result = await blockMappingImagePDF(
      makeBlock(),
      makeExporter(new Error('network error')).exporter,
      0,
    );

    expect(result).toBe(UNAVAILABLE);
  });

  it('names the missing image by its caption, else its name, in the message', async () => {
    const { exporter } = makeExporter(new Error('network error'));

    expect(
      await blockMappingImagePDF(
        makeBlock({ caption: 'Sunset', name: 'photo.png' }),
        exporter,
        0,
      ),
    ).toBe(
      '#text(fill: luma(110), style: "italic")[#"⚠️ Image unavailable (Sunset)"]',
    );
    expect(
      await blockMappingImagePDF(makeBlock({ name: 'photo.png' }), exporter, 0),
    ).toBe(
      '#text(fill: luma(110), style: "italic")[#"⚠️ Image unavailable (photo.png)"]',
    );
  });

  it('registers the canvas-derived PNG bytes and references them in a figure', async () => {
    vi.mocked(convertBlobToPng).mockResolvedValue({
      png: CANVAS_PNG_URL,
      width: 300,
      height: 150,
    });

    const { exporter, registerImageBytes } = makeExporter(pngBlob());
    const result = await blockMappingImagePDF(
      makeBlock({ name: 'photo.png' }),
      exporter,
      0,
    );

    const [key, bytes] = registerImageBytes.mock.calls[0];
    expect(key).toBe('https://example.com/image.png|300');
    expect(decode(bytes)).toBe('canvas');
    // Natural width 300px -> 225pt
    expect(result).toBe(
      '#[#show figure: set align(left); #figure(image("/assets/asset-0", width: 225.0pt), alt: "photo.png")]',
    );
  });

  it('converts SVG images to PNG', async () => {
    vi.mocked(convertSvgToPng).mockResolvedValue({
      png: SVG_CONVERTED_URL,
      width: 300,
      height: 150,
    });

    const { exporter, registerImageBytes } = makeExporter(
      new Blob(['<svg/>'], { type: 'image/svg+xml' }),
    );
    await blockMappingImagePDF(makeBlock(), exporter, 0);

    expect(convertSvgToPng).toHaveBeenCalledWith('<svg/>', undefined);
    const [, bytes] = registerImageBytes.mock.calls[0];
    expect(decode(bytes)).toBe('svg');
  });

  it('clamps previewWidth to MAX_WIDTH (600) before conversion and rendering', async () => {
    vi.mocked(convertBlobToPng).mockResolvedValue({
      png: CANVAS_PNG_URL,
      width: 600,
      height: 300,
    });

    const blob = pngBlob();
    const result = await blockMappingImagePDF(
      makeBlock({ previewWidth: 800 }),
      makeExporter(blob).exporter,
      0,
    );

    expect(convertBlobToPng).toHaveBeenCalledWith(blob, 600);
    // 600px -> 450pt
    expect(result).toContain('width: 450.0pt');
  });

  it('uses previewWidth for the rendered width when it is within MAX_WIDTH', async () => {
    vi.mocked(convertBlobToPng).mockResolvedValue({
      png: CANVAS_PNG_URL,
      width: 300,
      height: 150,
    });

    const result = await blockMappingImagePDF(
      makeBlock({ previewWidth: 400 }),
      makeExporter(pngBlob()).exporter,
      0,
    );

    // 400px -> 300pt
    expect(result).toContain('width: 300.0pt');
  });

  it('renders a message when convertBlobToPng returns undefined', async () => {
    vi.mocked(convertBlobToPng).mockResolvedValue(undefined);

    const result = await blockMappingImagePDF(
      makeBlock(),
      makeExporter(pngBlob()).exporter,
      0,
    );

    expect(result).toBe(UNAVAILABLE);
  });

  it('renders a message when the conversion throws', async () => {
    vi.mocked(convertSvgToPng).mockRejectedValue(new Error('canvas error'));

    const result = await blockMappingImagePDF(
      makeBlock(),
      makeExporter(new Blob(['<svg/>'], { type: 'image/svg+xml' })).exporter,
      0,
    );

    expect(result).toBe(UNAVAILABLE);
  });

  it('marks an image without a name nor a caption as decorative', async () => {
    vi.mocked(convertBlobToPng).mockResolvedValue({
      png: CANVAS_PNG_URL,
      width: 300,
      height: 150,
    });

    const result = await blockMappingImagePDF(
      makeBlock({ textAlignment: 'right' }),
      makeExporter(pngBlob()).exporter,
      0,
    );

    expect(result).toBe(
      '#align(right, pdf.artifact(image("/assets/asset-0", width: 225.0pt)))',
    );
  });

  it('prefers the name to the caption as alternative text', async () => {
    vi.mocked(convertBlobToPng).mockResolvedValue({
      png: CANVAS_PNG_URL,
      width: 300,
      height: 150,
    });

    const result = await blockMappingImagePDF(
      makeBlock({ caption: 'Sunset', name: 'photo.png' }),
      makeExporter(pngBlob()).exporter,
      0,
    );

    expect(result).toBe(
      '#[#show figure: set align(left); #figure(image("/assets/asset-0", width: 225.0pt), caption: [#"Sunset"], alt: "photo.png")]',
    );
  });

  it('uses the caption as caption and alternative text, escaped', async () => {
    vi.mocked(convertBlobToPng).mockResolvedValue({
      png: CANVAS_PNG_URL,
      width: 300,
      height: 150,
    });

    const result = await blockMappingImagePDF(
      makeBlock({ caption: 'A "test" caption', textAlignment: 'center' }),
      makeExporter(pngBlob()).exporter,
      0,
    );

    expect(result).toBe(
      '#[#show figure: set align(center); #figure(image("/assets/asset-0", width: 225.0pt), caption: [#"A \\"test\\" caption"], alt: "A \\"test\\" caption")]',
    );
  });
});
