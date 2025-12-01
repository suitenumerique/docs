import React from 'react';

import { DocsExporterODT } from '../types';

export const blockMappingUploadLoaderODT: DocsExporterODT['mappings']['blockMapping']['uploadLoader'] =
  (block) => {
    // Map uploadLoader to paragraph with information text
    const information = block.props.information || '';
    const type = block.props.type || 'loading';
    const prefix = type === 'warning' ? '⚠️ ' : '⏳ ';

    return React.createElement(
      'text:p',
      { 'text:style-name': 'Text_20_body' },
      `${prefix}${information}`,
    );
  };
