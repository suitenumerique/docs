import {
  BlockFromConfig,
  BlockNoteEditor,
  BlockSchemaWithBlock,
  InlineContentSchema,
  StyleSchema,
  createBlockSpec,
  imageBlockConfig,
  imageParse,
  imageRender,
  imageToExternalHTML,
} from '@blocknote/core';

type ImageBlockConfig = typeof imageBlockConfig;

export const accessibleImageRender = (
  block: BlockFromConfig<ImageBlockConfig, InlineContentSchema, StyleSchema>,
  editor: BlockNoteEditor<
    BlockSchemaWithBlock<ImageBlockConfig['type'], ImageBlockConfig>,
    InlineContentSchema,
    StyleSchema
  >,
) => {
  const imageRenderComputed = imageRender(block, editor);
  const dom = imageRenderComputed.dom;
  const imgSelector = dom.querySelector('img');

  imgSelector?.setAttribute('alt', '');
  imgSelector?.setAttribute('role', 'presentation');
  imgSelector?.setAttribute('aria-hidden', 'true');
  imgSelector?.setAttribute('tabindex', '-1');

  return {
    ...imageRenderComputed,
    dom,
  };
};

export const AccessibleImageBlock = createBlockSpec(imageBlockConfig, {
  render: accessibleImageRender,
  parse: imageParse,
  toExternalHTML: imageToExternalHTML,
});
