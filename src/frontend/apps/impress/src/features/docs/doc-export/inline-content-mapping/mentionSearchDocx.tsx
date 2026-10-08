import { TextRun } from 'docx';

import { DocsExporterDocx } from '../types';

/**
 * The search of a mention is transient, there is nothing to export.
 */
export const inlineContentMappingMentionSearchDocx: DocsExporterDocx['mappings']['inlineContentMapping']['mentionSearchInline'] =
  () => new TextRun('');
