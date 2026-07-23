import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Canvg uses canvas internally, which jsdom doesn't support. Mock it so we
// can verify the arguments it receives without actually rendering.
vi.mock('canvg', () => ({
  Canvg: {
    fromString: vi.fn(),
  },
}));

import { Canvg } from 'canvg';
import { convertBlobToPng, convertSvgToPng } from '../utils';

const CANVAS_PNG_URL = 'data:image/png;base64,Y2FudmFz';

// jsdom doesn't implement createImageBitmap or a working canvas. These stubs
// let the functions under test run to completion with predictable results.
function stubCanvas(bitmapWidth = 400, bitmapHeight = 200) {
  const bmp = { width: bitmapWidth, height: bitmapHeight, close: vi.fn() };
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bmp));

  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn().mockReturnValue({ drawImage: vi.fn() }),
    toDataURL: vi.fn().mockReturnValue(CANVAS_PNG_URL),
  };
  const original = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(
    (tagName: string, options?: ElementCreationOptions | undefined) =>
      tagName === 'canvas'
        ? // @ts-ignore
          (canvas as ReturnType<typeof original>)
        : original(tagName, options),
  );

  return { bmp, canvas };
}

describe('convertBlobToPng', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('transcodes a blob to a PNG data URL and returns it with its dimensions', async () => {
    stubCanvas(400, 200);

    const result = await convertBlobToPng(
      new Blob(['fake'], { type: 'image/png' }),
    );

    expect(result).toEqual({ png: CANVAS_PNG_URL, width: 400, height: 200 });
  });

  it('resizes the canvas to the requested width, preserving aspect ratio', async () => {
    // bitmap 400×200 (ratio 0.5), requested width=200 → height=100
    const { canvas } = stubCanvas(400, 200);

    const result = await convertBlobToPng(
      new Blob(['fake'], { type: 'image/png' }),
      200,
    );

    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(100);
    expect(result).toEqual({ png: CANVAS_PNG_URL, width: 200, height: 100 });
  });

  it('draws the image scaled to the canvas dimensions', async () => {
    const { canvas } = stubCanvas(400, 200);

    await convertBlobToPng(new Blob(['fake'], { type: 'image/png' }), 200);

    const ctx = canvas.getContext.mock.results[0].value;
    expect(ctx.drawImage).toHaveBeenCalledWith(
      expect.anything(),
      0,
      0,
      200,
      100,
    );
  });

  it('closes the ImageBitmap after drawing', async () => {
    const { bmp } = stubCanvas(400, 200);

    await convertBlobToPng(new Blob(['fake'], { type: 'image/png' }));

    expect(bmp.close).toHaveBeenCalled();
  });
});

describe('convertSvgToPng', () => {
  // Returns the Canvg instance created by the most recent convertSvgToPng call.
  function svgInstance() {
    return vi.mocked(Canvg.fromString).mock.results[0].value as {
      resize: ReturnType<typeof vi.fn>;
      render: ReturnType<typeof vi.fn>;
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    stubCanvas();
    vi.mocked(Canvg.fromString).mockReturnValue({
      resize: vi.fn(),
      render: vi.fn().mockResolvedValue(undefined),
    } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns a PNG data URL with the SVG natural dimensions from width/height attributes', async () => {
    const result = await convertSvgToPng(
      '<svg width="300" height="150"></svg>',
    );

    expect(result).toEqual({ png: CANVAS_PNG_URL, width: 300, height: 150 });
  });

  it('reads dimensions from the viewBox attribute when width/height are absent', async () => {
    const result = await convertSvgToPng('<svg viewBox="0 0 200 100"></svg>');

    expect(result).toEqual({ png: CANVAS_PNG_URL, width: 200, height: 100 });
  });

  it('resizes to the given width, preserving the SVG aspect ratio', async () => {
    // SVG is 300×150 (ratio 0.5), requested width=600 → height=300
    await convertSvgToPng('<svg width="300" height="150"></svg>', 600);

    expect(svgInstance().resize).toHaveBeenCalledWith(600, 300, true);
  });

  it('uses FALLBACK_WIDTH (536) when the SVG has no dimensions and no width is given', async () => {
    const result = await convertSvgToPng('<svg></svg>');

    expect(svgInstance().resize).toHaveBeenCalledWith(536, undefined, true);
    expect(result.width).toBe(536);
  });

  it('calls svg.render() to draw to canvas', async () => {
    await convertSvgToPng('<svg width="100" height="50"></svg>');

    expect(svgInstance().render).toHaveBeenCalled();
  });
});
