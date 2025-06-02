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
  },
  content: 'none',
} as const;
