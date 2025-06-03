import { pdfDefaultSchemaMappings } from '@blocknote/xl-pdf-exporter';

import {
  blockMappingCalloutPDF,
  blockMappingChartBlockPDF,
  blockMappingDividerPDF,
  blockMappingHeadingPDF,
  blockMappingImagePDF,
  blockMappingLatexBlockPDF,
  blockMappingMermaidBlockPDF,
  blockMappingParagraphPDF,
  blockMappingQuotePDF,
  blockMappingTablePDF,
} from './blocks-mapping';
import { blockMappingInlineLatexPDF } from './inline-mapping';
import { DocsExporterPDF } from './types';

export const pdfDocsSchemaMappings: DocsExporterPDF['mappings'] = {
  ...pdfDefaultSchemaMappings,
  blockMapping: {
    ...pdfDefaultSchemaMappings.blockMapping,
    callout: blockMappingCalloutPDF,
    heading: blockMappingHeadingPDF,
    image: blockMappingImagePDF,
    paragraph: blockMappingParagraphPDF,
    divider: blockMappingDividerPDF,
    quote: blockMappingQuotePDF,
    table: blockMappingTablePDF,
    latex: blockMappingLatexBlockPDF,
    mermaid: blockMappingMermaidBlockPDF,
    chart: blockMappingChartBlockPDF,
  },
  inlineContentMapping: {
    ...pdfDefaultSchemaMappings.inlineContentMapping,
    inlineLatex: blockMappingInlineLatexPDF,
  },
};
