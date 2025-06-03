import '@blocknote/mantine/style.css';
import { useBlockNoteEditor, useComponentsContext } from '@blocknote/react';

export function InlineLatexButton() {
  const editor = useBlockNoteEditor();
  const Components = useComponentsContext();

  const handleClick = () => {
    const selectedText = editor.getSelectedText();
    if (selectedText) {
      editor.insertInlineContent([
        {
          type: 'inlineLatex' as const,
          props: {
            formula: selectedText,
          },
        },
      ]);
    }
  };

  if (!Components || !editor.getSelectedText()) {
    return null;
  }

  return (
    <Components.FormattingToolbar.Button
      mainTooltip="Convert to Inline LaTeX"
      onClick={handleClick}
      isSelected={false}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span>∑</span>
      </div>
    </Components.FormattingToolbar.Button>
  );
}
