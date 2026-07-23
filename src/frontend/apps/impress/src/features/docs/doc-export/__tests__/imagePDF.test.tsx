import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Use string identifiers so vi.mock's factory doesn't reference any
// outer-scope variables (which would be undefined after hoisting).
// React accepts arbitrary strings as element types, so JSX like
// <Image src={x}> compiles to React.createElement(Image, { src: x }).
// Because Image is the string 'pdfImage', that call is equivalent to
// React.createElement('pdfImage', { src: x }), and the resulting
// element's .type is 'pdfImage' — which is what findInTree checks.
vi.mock('@react-pdf/renderer', () => ({
  Image: 'pdfImage',
  Text: 'pdfText',
  View: 'pdfView',
}));

vi.mock('../utils', () => ({
  convertBlobToPng: vi.fn(),
  convertSvgToPng: vi.fn(),
}));

import { convertBlobToPng, convertSvgToPng } from '../utils';
import { blockMappingImagePDF } from '../blocks-mapping/imagePDF';

const CANVAS_PNG_URL = 'data:image/png;base64,Y2FudmFz';
const SVG_CONVERTED_URL = 'data:image/png;base64,c3Zn';

function makeBlock(
  props: Partial<{ previewWidth: number; caption: string }> = {},
) {
  return {
    id: 'test-block',
    type: 'image' as const,
    props: {
      url: 'https://example.com/image.png',
      previewWidth: undefined as number | undefined,
      caption: '',
      backgroundColor: 'default' as const,
      textColor: 'default' as const,
      textAlignment: 'left' as const,
      ...props,
    },
    children: [],
    content: [],
  };
}

function makeExporter(blob: Blob) {
  return { resolveFile: vi.fn().mockResolvedValue(blob) };
}

type PDFElementProps = {
  children?: React.ReactNode;
  src?: string;
  style?: { width?: number; height?: number };
};

// Walk the React element tree to find the first node of a given type.
function findInTree(
  node: React.ReactNode,
  type: string,
): React.ReactElement<PDFElementProps> | undefined {
  if (!React.isValidElement(node)) return undefined;
  const el = node as React.ReactElement<PDFElementProps>;
  if (el.type === type) return el;
  const { children } = el.props;
  if (!children) return undefined;
  const arr = Array.isArray(children) ? children : [children];
  for (const child of arr) {
    const found = findInTree(child, type);
    if (found) return found;
  }
  return undefined;
}

describe('blockMappingImagePDF', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an empty View when the blob is not an image', async () => {
    const blob = new Blob(['data'], { type: 'video/mp4' });
    const result = await blockMappingImagePDF(makeBlock(), makeExporter(blob));

    expect(React.isValidElement(result)).toBe(true);
    const element = result as React.ReactElement;
    expect(element.type).toBe('pdfView');
    // Empty View has no Image child
    expect(findInTree(element, 'pdfImage')).toBeUndefined();
  });

  it('converts PNG to a canvas-derived PNG data URL (not a raw Blob) as Image src', async () => {
    vi.mocked(convertBlobToPng).mockResolvedValue({
      png: CANVAS_PNG_URL,
      width: 300,
      height: 150,
    });

    const pngBlob = new Blob(['fake-png'], { type: 'image/png' });
    const result = await blockMappingImagePDF(
      makeBlock(),
      makeExporter(pngBlob),
    );

    const imageEl = findInTree(result as React.ReactNode, 'pdfImage');
    expect(imageEl).toBeDefined();
    expect(imageEl!.props.src).toBe(CANVAS_PNG_URL);
  });

  it('converts SVG images to PNG and passes the converted data URL as src', async () => {
    vi.mocked(convertSvgToPng).mockResolvedValue({
      png: SVG_CONVERTED_URL,
      width: 300,
      height: 150,
    });

    const svgBlob = new Blob(['<svg/>'], { type: 'image/svg+xml' });
    const result = await blockMappingImagePDF(
      makeBlock(),
      makeExporter(svgBlob),
    );

    const imageEl = findInTree(result as React.ReactNode, 'pdfImage');
    expect(imageEl).toBeDefined();
    expect(imageEl!.props.src).toBe(SVG_CONVERTED_URL);
  });

  it('clamps previewWidth to MAX_WIDTH (600) before conversion and rendering', async () => {
    // previewWidth=800 is clamped to 600 before being passed to convertBlobToPng.
    // The converter returns 600×300 (already at the clamped size).
    // Rendered: width = 600*PIXELS_PER_POINT(0.75) = 450, height = 300*PIXELS_PER_POINT(0.75) = 225.
    vi.mocked(convertBlobToPng).mockResolvedValue({
      png: CANVAS_PNG_URL,
      width: 600,
      height: 300,
    });

    const result = await blockMappingImagePDF(
      makeBlock({ previewWidth: 800 }),
      makeExporter(new Blob(['fake-png'], { type: 'image/png' })),
    );

    expect(convertBlobToPng).toHaveBeenCalledWith(expect.anything(), 600);
    const imageEl = findInTree(result as React.ReactNode, 'pdfImage');
    expect(imageEl).toBeDefined();
    expect(imageEl?.props.style?.width).toBe(450);
    expect(imageEl?.props.style?.height).toBe(225);
  });

  it('passes previewWidth to convertBlobToPng so it can resize during transcoding', async () => {
    vi.mocked(convertBlobToPng).mockResolvedValue({
      png: CANVAS_PNG_URL,
      width: 400,
      height: 200,
    });

    const pngBlob = new Blob(['fake-png'], { type: 'image/png' });
    await blockMappingImagePDF(
      makeBlock({ previewWidth: 400 }),
      makeExporter(pngBlob),
    );

    expect(convertBlobToPng).toHaveBeenCalledWith(pngBlob, 400);
  });

  it('passes previewWidth to convertSvgToPng so it can resize during transcoding', async () => {
    vi.mocked(convertSvgToPng).mockResolvedValue({
      png: SVG_CONVERTED_URL,
      width: 400,
      height: 200,
    });

    const svgBlob = new Blob(['<svg/>'], { type: 'image/svg+xml' });
    await blockMappingImagePDF(
      makeBlock({ previewWidth: 400 }),
      makeExporter(svgBlob),
    );

    expect(convertSvgToPng).toHaveBeenCalledWith(expect.any(String), 400);
  });

  it('uses natural image dimensions for the rendered style when no previewWidth is set', async () => {
    // naturalWidth=300, naturalHeight=150 → finalWidth=300, finalHeight=150.
    // Rendered: width = 300*PIXELS_PER_POINT(0.75) = 225, height = 150*PIXELS_PER_POINT(0.75) = 112.5.
    vi.mocked(convertBlobToPng).mockResolvedValue({
      png: CANVAS_PNG_URL,
      width: 300,
      height: 150,
    });

    const result = await blockMappingImagePDF(
      makeBlock(),
      makeExporter(new Blob(['fake-png'], { type: 'image/png' })),
    );

    const imageEl = findInTree(result as React.ReactNode, 'pdfImage');
    expect(imageEl).toBeDefined();
    expect(imageEl!.props.style.width).toBe(225);
    expect(imageEl!.props.style.height).toBe(112.5);
  });

  it('scales rendered style to previewWidth when it is within MAX_WIDTH', async () => {
    // previewWidth=400 (< MAX_WIDTH=600), natural size 300×150.
    // finalWidth=400, finalHeight=(400/300)*150≈200.
    // Rendered: width = 400*PIXELS_PER_POINT(0.75) = 300, height ≈ 200*PIXELS_PER_POINT(0.75) = 150.
    vi.mocked(convertBlobToPng).mockResolvedValue({
      png: CANVAS_PNG_URL,
      width: 300,
      height: 150,
    });

    const result = await blockMappingImagePDF(
      makeBlock({ previewWidth: 400 }),
      makeExporter(new Blob(['fake-png'], { type: 'image/png' })),
    );

    const imageEl = findInTree(result as React.ReactNode, 'pdfImage');
    expect(imageEl).toBeDefined();
    expect(imageEl!.props.style.width).toBe(300);
    expect(imageEl!.props.style.height).toBe(150);
  });

  it('returns an empty View when convertBlobToPng returns undefined', async () => {
    vi.mocked(convertBlobToPng).mockResolvedValue(undefined);

    const result = await blockMappingImagePDF(
      makeBlock(),
      makeExporter(new Blob(['fake-png'], { type: 'image/png' })),
    );

    const element = result as React.ReactElement;
    expect(element.type).toBe('pdfView');
    expect(findInTree(element, 'pdfImage')).toBeUndefined();
  });

  it('returns an empty View when convertBlobToPng throws', async () => {
    vi.mocked(convertBlobToPng).mockRejectedValue(new Error('canvas error'));

    const result = await blockMappingImagePDF(
      makeBlock(),
      makeExporter(new Blob(['fake-png'], { type: 'image/png' })),
    );

    const element = result as React.ReactElement;
    expect(element.type).toBe('pdfView');
    expect(findInTree(element, 'pdfImage')).toBeUndefined();
  });

  it('returns an empty View when convertSvgToPng throws', async () => {
    vi.mocked(convertSvgToPng).mockRejectedValue(new Error('canvas error'));

    const result = await blockMappingImagePDF(
      makeBlock(),
      makeExporter(new Blob(['<svg/>'], { type: 'image/svg+xml' })),
    );

    const element = result as React.ReactElement;
    expect(element.type).toBe('pdfView');
    expect(findInTree(element, 'pdfImage')).toBeUndefined();
  });

  it('renders a caption when caption prop is set', async () => {
    vi.mocked(convertBlobToPng).mockResolvedValue({
      png: CANVAS_PNG_URL,
      width: 300,
      height: 150,
    });

    const pngBlob = new Blob(['fake-png'], { type: 'image/png' });
    const result = await blockMappingImagePDF(
      makeBlock({ caption: 'A test caption' }),
      makeExporter(pngBlob),
    );

    const textEl = findInTree(result as React.ReactNode, 'pdfText');
    expect(textEl).toBeDefined();
    expect(textEl!.props.children).toBe('A test caption');
  });
});
