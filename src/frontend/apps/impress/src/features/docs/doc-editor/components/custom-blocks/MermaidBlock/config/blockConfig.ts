import { defaultProps } from '@blocknote/core';

export const defaultDiagram = `graph TD
    A[Start] --> B{Is it?}
    B -- Yes --> C[OK]
    B -- No --> D[End]`;

export const blockSpec = {
  type: 'mermaid',
  propSchema: {
    diagram: {
      default: defaultDiagram,
    },
    textAlignment: defaultProps.textAlignment,
    backgroundColor: defaultProps.backgroundColor,
  },
  content: 'none',
} as const;
