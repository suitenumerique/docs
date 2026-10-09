import { DocsExporterPDF } from '../types';

/**
 * The search of a mention is transient, there is nothing to export.
 */
export const inlineContentMappingMentionSearchPDF: DocsExporterPDF['mappings']['inlineContentMapping']['mentionSearchInline'] =
  () => <></>;
