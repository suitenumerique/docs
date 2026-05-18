import { createBlockSpec } from '@blocknote/core';

const uploadLoaderPropSchema = {
  information: { default: '' as string },
  type: {
    default: 'loading' as const,
    values: ['loading', 'warning'] as const,
  },
  blockUploadName: { default: '' as string },
  blockUploadShowPreview: { default: true as boolean },
  blockUploadType: { default: '' as string },
  blockUploadUrl: { default: '' as string },
} as const;

const uploadLoaderConfig = {
  type: 'uploadLoader' as const,
  propSchema: uploadLoaderPropSchema,
  content: 'none' as const,
};

// Transient block representing an in-progress upload. We render it as an empty
// element in HTML export so it disappears from finished documents but the
// prosemirror node round-trips correctly.
export const UploadLoaderBlock = createBlockSpec(uploadLoaderConfig, {
  render: () => {
    const dom = document.createElement('div');
    dom.setAttribute('data-content-type', 'uploadLoader');
    return { dom };
  },
  toExternalHTML: () => {
    const dom = document.createElement('div');
    dom.setAttribute('data-content-type', 'uploadLoader');
    return { dom };
  },
});
