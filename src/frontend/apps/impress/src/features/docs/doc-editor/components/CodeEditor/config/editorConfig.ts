import { loader } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

export const initializeMonaco = async () => {
  const monaco = await loader.init();

  // Register LaTeX language
  monaco.languages.register({ id: 'latex' });
  monaco.languages.setMonarchTokensProvider('latex', {
    tokenizer: {
      root: [
        // Commands
        [/\\[a-zA-Z]+/, 'keyword'],
        // Math delimiters
        [/\$.*?\$/, 'string'],
        [/\\\(.*?\\\)/, 'string'],
        [/\\\[.*?\\\]/, 'string'],
        // Comments
        [/%.*$/, 'comment'],
        // Brackets
        [/[{}[\]]/, 'delimiter.bracket'],
        // Numbers
        [/\d+/, 'number'],
      ],
    },
  });
};

export const getEditorOptions = (
  language: string = 'latex',
): editor.IStandaloneEditorConstructionOptions => ({
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  lineNumbers: 'off' as const,
  folding: false,
  lineDecorationsWidth: 0,
  lineNumbersMinChars: 0,
  glyphMargin: false,
  contextmenu: false,
  scrollbar: {
    vertical: 'hidden',
    horizontal: 'hidden',
  },
  fontSize: 14,
  fontFamily: 'monospace',
  wordWrap: 'on',
  wrappingStrategy: 'advanced',
  wrappingIndent: 'same',
  language,
});
