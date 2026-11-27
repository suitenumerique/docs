import { getDocument } from '@blocknote/server-util/dom';

// ServerBlockNoteEditor requires all editors to share one rendering document.
export const serverDocument = getDocument();
