import { COLORS_DEFAULT } from '@blocknote/core';
import { Paragraph } from 'docx';
import { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  createBlockMappingImageDocx,
  createBlockMappingImageODT,
} from '../blocks-mapping';
import { DocsExporterDocx, DocsExporterODT } from '../types';
import { getBlockMappingFunction } from '../utils';

const block = {
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
  },
  children: [],
  content: undefined,
};

const failingExporter = {
  resolveFile: vi.fn().mockRejectedValue(new Error('401 Unauthorized')),
  options: { colors: COLORS_DEFAULT },
};

describe('image that cannot be exported', () => {
  it('is replaced by a message in a Docx export instead of failing it', async () => {
    const result = await getBlockMappingFunction(
      createBlockMappingImageDocx('Image unavailable'),
    )(block, failingExporter as unknown as DocsExporterDocx, 0);

    expect(result).toBeInstanceOf(Paragraph);
    expect(JSON.stringify(result)).toContain('⚠️ Image unavailable');
  });

  it('is replaced by a message in an ODT export', async () => {
    const result = (await getBlockMappingFunction(
      createBlockMappingImageODT('Image unavailable'),
    )(
      block,
      failingExporter as unknown as DocsExporterODT,
      0,
    )) as ReactElement<{ children: string }>;

    expect(result.type).toBe('text:p');
    expect(result.props.children).toBe('⚠️ Image unavailable');
  });

  it('names the missing image by its caption in the message', async () => {
    const result = (await getBlockMappingFunction(
      createBlockMappingImageODT('Image unavailable'),
    )(
      { ...block, props: { ...block.props, caption: 'Sunset' } },
      failingExporter as unknown as DocsExporterODT,
      0,
    )) as ReactElement<{ children: string }>;

    expect(result.props.children).toBe('⚠️ Image unavailable (Sunset)');
  });
});
