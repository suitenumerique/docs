import { create } from 'zustand';

import { DocsBlockNoteEditor } from '../types';

export interface UseEditorstore {
  editor?: DocsBlockNoteEditor;
  setEditor: (editor: DocsBlockNoteEditor | undefined) => void;
}

export const useEditorStore = create<UseEditorstore>((set) => ({
  editor: undefined,
  setEditor: (editor) => {
    set({ editor });
  },
}));
