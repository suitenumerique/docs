import { createBlockSpec } from '@blocknote/core';

const pdfPropSchema = {
  backgroundColor: { default: 'default' as const },
  caption: { default: '' as string },
  name: { default: '' as string },
  previewWidth: { default: undefined, type: 'number' as const },
  showPreview: { default: true as boolean },
  textAlignment: { default: 'left' as const },
  url: { default: '' as string },
} as const;

const pdfConfig = {
  type: 'pdf' as const,
  propSchema: pdfPropSchema,
  content: 'none' as const,
};

// Reject schemes like `javascript:` that would execute on click/load. Allow
// http(s) (the upload backend) and protocol-relative/relative paths.
const isSafePdfUrl = (url: string) => {
  try {
    const parsed = new URL(url, 'http://_');
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const buildPdfDom = (block: {
  props: {
    url: string;
    name: string;
    caption: string;
    previewWidth: number | undefined;
    showPreview: boolean;
  };
}) => {
  const wrapper = document.createElement('div');
  wrapper.setAttribute('data-content-type', 'pdf');

  const safeUrl = block.props.url && isSafePdfUrl(block.props.url);

  if (safeUrl && block.props.showPreview !== false) {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('src', block.props.url);
    iframe.setAttribute('title', block.props.name || 'PDF preview');
    if (block.props.previewWidth) {
      iframe.setAttribute('width', String(block.props.previewWidth));
    }
    wrapper.appendChild(iframe);
  } else if (safeUrl) {
    const link = document.createElement('a');
    link.setAttribute('href', block.props.url);
    link.textContent = block.props.name || block.props.url;
    wrapper.appendChild(link);
  } else if (block.props.url) {
    const fallback = document.createElement('span');
    fallback.textContent = block.props.name || block.props.url;
    wrapper.appendChild(fallback);
  }

  if (block.props.caption) {
    const caption = document.createElement('p');
    caption.className = 'bn-file-caption';
    caption.textContent = block.props.caption;
    wrapper.appendChild(caption);
  }

  return wrapper;
};

export const PdfBlock = createBlockSpec(pdfConfig, {
  render: (block) => ({ dom: buildPdfDom(block) }),
  toExternalHTML: (block) => ({ dom: buildPdfDom(block) }),
});
