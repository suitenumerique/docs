import { DocsExporterODT } from '../types';

/**
 * The search of a mention is transient, there is nothing to export.
 */
export const inlineContentMappingMentionSearchODT: DocsExporterODT['mappings']['inlineContentMapping']['mentionSearchInline'] =
  () => null;
