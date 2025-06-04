import { docxDefaultSchemaMappings } from '@blocknote/xl-docx-exporter';

import {
  blockMappingCalloutDocx,
  blockMappingDividerDocx,
  blockMappingImageDocx,
  blockMappingQuoteDocx,
} from './blocks-mapping';
import { blockMappingChartBlockDocx } from './blocks-mapping/chartBlockDocx';
import { blockMappingLatexBlockDocx } from './blocks-mapping/latexBlockDocx';
import { blockMappingMermaidBlockDocx } from './blocks-mapping/mermaidBlockDocx';
import { blockMappingInlineLatexDocx } from './inline-mapping/inlineLatexDocx';
import { DocsExporterDocx } from './types';

export const docxDocsSchemaMappings: DocsExporterDocx['mappings'] = {
  ...docxDefaultSchemaMappings,
  blockMapping: {
    ...docxDefaultSchemaMappings.blockMapping,
    callout: blockMappingCalloutDocx,
    divider: blockMappingDividerDocx,
    quote: blockMappingQuoteDocx,
    image: blockMappingImageDocx,
    latex: blockMappingLatexBlockDocx,
    // mermaid: blockMappingMermaidBlockDocx,
    // chart: blockMappingChartBlockDocx,
  },
  // inlineContentMapping: {
  //   ...docxDefaultSchemaMappings.inlineContentMapping,
  //   inlineLatex: blockMappingInlineLatexDocx,
  // },
};
