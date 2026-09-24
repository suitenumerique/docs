import { render, waitFor } from '@testing-library/react';
import { ComponentType } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { UploadLoaderBlock } from '../UploadLoaderBlock';

const { loopCheckDocMediaStatus, capturedRender } = vi.hoisted(() => ({
  loopCheckDocMediaStatus: vi.fn(),
  capturedRender: {
    current: undefined as ComponentType<Record<string, unknown>> | undefined,
  },
}));

vi.mock('../../../api', () => ({
  loopCheckDocMediaStatus,
}));

vi.mock('@blocknote/react', async () => {
  const actual =
    await vi.importActual<typeof import('@blocknote/react')>(
      '@blocknote/react',
    );

  return {
    ...actual,
    createReactBlockSpec: (config: unknown, implementation: object) => {
      if (
        'render' in implementation &&
        typeof implementation.render === 'function'
      ) {
        capturedRender.current = implementation.render as ComponentType<
          Record<string, unknown>
        >;
      }

      return (
        actual.createReactBlockSpec as (
          blockConfig: unknown,
          blockImplementation: object,
        ) => ReturnType<typeof actual.createReactBlockSpec>
      )(config, implementation);
    },
  };
});

void UploadLoaderBlock;

const analyzeUrl = 'https://docs.example/media-check/abc';

describe('UploadLoaderBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    loopCheckDocMediaStatus.mockResolvedValue({
      status: 'ready',
      file: '/media/doc/photo.png',
    });
  });

  it('restores the caption and alignment once the analysis is done', async () => {
    const replaceBlocks = vi.fn();
    const Render = capturedRender.current!;

    render(
      <Render
        block={{
          id: 'loader',
          type: 'uploadLoader',
          props: {
            information: 'Analyzing file...',
            type: 'loading',
            blockUploadName: 'photo.png',
            blockUploadShowPreview: true,
            blockUploadType: 'image',
            blockUploadUrl: analyzeUrl,
            blockUploadCaption: 'Pont Neuf',
            blockUploadTextAlignment: 'center',
          },
          content: undefined,
          children: [],
        }}
        editor={{
          isEditable: true,
          replaceBlocks,
        }}
      />,
      { wrapper: AppWrapper },
    );

    await waitFor(() => {
      expect(replaceBlocks).toHaveBeenCalledWith(
        ['loader'],
        [
          expect.objectContaining({
            type: 'image',
            props: expect.objectContaining({
              caption: 'Pont Neuf',
              textAlignment: 'center',
            }),
          }),
        ],
      );
    });
  });
});
