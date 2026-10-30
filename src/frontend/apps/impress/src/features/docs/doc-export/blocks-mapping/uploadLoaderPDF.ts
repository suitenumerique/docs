import { strLit } from '@blocknote/xl-pdf-exporter';

import { type DocsBlockMappingPDF } from '../types';

export const blockMappingUploadLoaderPDF: DocsBlockMappingPDF<
  'uploadLoader'
> = (block) => {
  const icon = block.props.type === 'loading' ? '⏳' : '⚠️';

  return `#${strLit(`${icon} ${block.props.information}`)}`;
};
