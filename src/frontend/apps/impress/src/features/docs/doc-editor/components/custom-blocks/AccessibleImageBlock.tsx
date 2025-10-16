/**
 * AccessibleImageBlock.tsx
 *
 * This file defines a custom BlockNote block specification for an accessible image block.
 * It extends the default image block to ensure compliance with accessibility standards,
 * specifically RGAA 1.9.1, by using <figure> and <figcaption> elements when a caption is provided.
 *
 * The accessible image block ensures that:
 * - Images with captions are wrapped in <figure> and <figcaption> elements.
 * - The <img> element has an appropriate alt attribute based on the caption.
 * - Accessibility attributes such as role and aria-label are added for better screen reader support.
 * - Images without captions have alt="" and are marked as decorative with aria-hidden="true".
 *
 * This implementation leverages BlockNote's existing image block functionality while enhancing it for accessibility.
 * https://github.com/TypeCellOS/BlockNote/blob/main/packages/core/src/blocks/Image/block.ts
 */

import {
  BlockFromConfig,
  BlockNoteEditor,
  ImageOptions,
  InlineContentSchema,
  InlineContentSchemaFromSpecs,
  StyleSchema,
  createBlockSpec,
  createImageBlockConfig,
  defaultInlineContentSpecs,
  imageParse,
  imageRender,
  imageToExternalHTML,
} from '@blocknote/core';
import { t } from 'i18next';

type CreateImageBlockConfig = ReturnType<typeof createImageBlockConfig>;

export const accessibleImageRender =
  (config: ImageOptions) =>
  (
    block: BlockFromConfig<
      CreateImageBlockConfig,
      InlineContentSchema,
      StyleSchema
    >,
    editor: BlockNoteEditor<
      Record<'image', CreateImageBlockConfig>,
      InlineContentSchemaFromSpecs<typeof defaultInlineContentSpecs>,
      StyleSchema
    >,
  ) => {
    const imageRenderComputed = imageRender(config);
    const dom = imageRenderComputed(block, editor).dom;
    const imgSelector = dom.querySelector('img');

    // Fix RGAA 1.9.1: Convert to figure/figcaption structure if caption exists
    const accessibleImageWithCaption = () => {
      imgSelector?.setAttribute('alt', block.props.caption);
      imgSelector?.removeAttribute('aria-hidden');
      imgSelector?.setAttribute('tabindex', '0');

      const figureElement = document.createElement('figure');

      // Copy all attributes from the original div
      figureElement.className = dom.className;
      const styleAttr = dom.getAttribute('style');
      if (styleAttr) {
        figureElement.setAttribute('style', styleAttr);
      }
      figureElement.style.setProperty('margin', '0');

      Array.from(dom.children).forEach((child) => {
        figureElement.appendChild(child.cloneNode(true));
      });

      // Replace the <p> caption with <figcaption>
      const figcaptionElement = document.createElement('figcaption');
      const originalCaption = figureElement.querySelector('.bn-file-caption');
      if (originalCaption) {
        figcaptionElement.className = originalCaption.className;
        figcaptionElement.textContent = originalCaption.textContent;
        originalCaption.parentNode?.replaceChild(
          figcaptionElement,
          originalCaption,
        );

        // Add explicit role and aria-label for better screen reader support
        figureElement.setAttribute('role', 'img');
        figureElement.setAttribute(
          'aria-label',
          t(`Image: {{title}}`, { title: figcaptionElement.textContent }),
        );
      }

      // Return the figure element as the new dom
      return {
        ...imageRenderComputed,
        dom: figureElement,
      };
    };

    const accessibleImage = () => {
      imgSelector?.setAttribute('alt', '');
      imgSelector?.setAttribute('role', 'presentation');
      imgSelector?.setAttribute('aria-hidden', 'true');
      imgSelector?.setAttribute('tabindex', '-1');

      return {
        ...imageRenderComputed,
        dom,
      };
    };

    const withCaption =
      block.props.caption && dom.querySelector('.bn-file-caption');

    // Set accessibility attributes for the image
    return withCaption ? accessibleImageWithCaption() : accessibleImage();
  };

export const AccessibleImageBlock = createBlockSpec(
  createImageBlockConfig,
  (config) => ({
    meta: {
      fileBlockAccept: ['image/*'],
    },
    render: accessibleImageRender(config),
    parse: imageParse(config),
    toExternalHTML: imageToExternalHTML(config),
    runsBefore: ['file'],
  }),
);
