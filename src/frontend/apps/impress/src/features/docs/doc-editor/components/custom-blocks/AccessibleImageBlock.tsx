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
import { t } from 'i18next';

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

  const withCaption =
    block.props.caption && dom.querySelector('.bn-file-caption');

  const accessibleImageWithCaption = () => {
    imgSelector?.setAttribute('alt', block.props.caption);
    imgSelector?.removeAttribute('aria-hidden');
    imgSelector?.setAttribute('tabindex', '0');

    // Fix RGAA 1.9.1: Convert to figure/figcaption structure if caption exists
    const captionElement = dom.querySelector('.bn-file-caption');

    if (captionElement) {
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
    }
  };

  const accessibleImage = () => {
    imgSelector?.setAttribute('alt', '');
    imgSelector?.setAttribute('role', 'presentation');
    imgSelector?.setAttribute('aria-hidden', 'true');
    imgSelector?.setAttribute('tabindex', '-1');
  };

  // Set accessibility attributes for the image
  const result = withCaption ? accessibleImageWithCaption() : accessibleImage();

  // Return the result if accessibleImageWithCaption created a figure, otherwise return original
  if (result) {
    return result;
  }

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
