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

  // Register Mermaid language
  monaco.languages.register({ id: 'mermaid' });
  monaco.languages.setMonarchTokensProvider('mermaid', {
    tokenizer: {
      root: [
        // Graph types
        [
          /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|gantt|pie|erDiagram|journey)\s/,
          'keyword',
        ],
        // Direction
        [/^(TD|BT|RL|LR)\s/, 'keyword'],
        // Node definitions
        [/[A-Za-z0-9_]+\[.*?\]/, 'string'],
        [/[A-Za-z0-9_]+\(.*?\)/, 'string'],
        [/[A-Za-z0-9_]+{.*?}/, 'string'],
        [/[A-Za-z0-9_]+>.*?</, 'string'],
        [/[A-Za-z0-9_]+\[.*?\]>.*?</, 'string'],
        // Arrows
        [/-->|==>|-.->|==>|--o|--x|--|==|===|----|====/, 'operator'],
        // Comments
        [/%%/, 'comment'],
        [/%%[^%]*/, 'comment'],
        // Numbers
        [/\d+/, 'number'],
        // Brackets
        [/[{}[\]]/, 'delimiter.bracket'],
        // Strings
        [/"[^"]*"/, 'string'],
        // Keywords
        [
          /^(subgraph|end|class|state|note|participant|actor|as|title|dateFormat|axisFormat|section|task|milestone|entity|relationship|journey|section|task|milestone)\b/,
          'keyword',
        ],
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
    horizontal: 'hidden'
  },
  fontSize: 14,
  fontFamily: 'monospace',
  wordWrap: 'on',
  wrappingStrategy: 'advanced',
  wrappingIndent: 'same',
  language,
  renderLineHighlight: "none",
  overviewRulerLanes: 0,
});
