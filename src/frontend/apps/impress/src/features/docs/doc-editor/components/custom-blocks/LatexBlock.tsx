import { defaultProps, insertOrUpdateBlock } from '@blocknote/core';
import { createReactBlockSpec } from '@blocknote/react';
import { Input } from '@openfun/cunningham-react';
import { TFunction } from 'i18next';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import React, { useEffect, useRef, useState } from 'react';

import { Box, Icon } from '@/components';
import { useCunninghamTheme } from '@/cunningham';

import { DocsBlockNoteEditor } from '../../types';

const LatexRenderer = ({
  formula,
  onFormulaChange,
  editor,
  block,
}: {
  formula: string;
  onFormulaChange?: (formula: string) => void;
  editor: DocsBlockNoteEditor;
  block: any;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const { colorsTokens } = useCunninghamTheme();
  const [inputValue, setInputValue] = useState(formula);
  const [isEditing, setIsEditing] = useState(false);

  // Live preview
  useEffect(() => {
    if (containerRef.current) {
      try {
        katex.render(isEditing ? inputValue : formula, containerRef.current, {
          displayMode: true,
          throwOnError: false,
        });
      } catch {
        containerRef.current.innerHTML = 'Invalid LaTeX formula';
      }
    }
  }, [formula, inputValue, isEditing]);

  // Click outside detection
  useEffect(() => {
    if (!isEditing) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        boxRef.current &&
        !boxRef.current.contains(event.target as Node)
      ) {
        setIsEditing(false);
        // Optionally, update the formula when leaving edit mode
        if (inputValue !== formula) {
          onFormulaChange?.(inputValue);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isEditing, inputValue, formula, onFormulaChange]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleBoxClick = () => {
    if (editor.isEditable) setIsEditing(true);
  };

  return (
    <Box
      ref={boxRef}
      $padding="1rem"
      $background={colorsTokens['greyscale-100']}
      style={{
        borderRadius: '4px',
        border: `1px solid ${colorsTokens['greyscale-300']}`,
        overflowX: 'auto',
        cursor: editor.isEditable ? 'pointer' : 'default',
      }}
      onClick={handleBoxClick}
    >
      {isEditing ? (
        <Box $gap="1rem">
          <Input
            value={inputValue}
            onChange={handleInputChange}
            placeholder="Enter LaTeX formula..."
            fullWidth
            autoFocus
          />
          <div ref={containerRef} />
        </Box>
      ) : (
        <Box $gap="0.5rem">
          <div ref={containerRef} />
        </Box>
      )}
    </Box>
  );
};

export const LatexBlock = createReactBlockSpec(
  {
    type: 'latex',
    propSchema: {
      formula: {
        default: '\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}',
      },
      textAlignment: defaultProps.textAlignment,
      backgroundColor: defaultProps.backgroundColor,
    },
    content: 'none',
  },
  {
    render: ({ block, editor }) => {
      const handleFormulaChange = (newFormula: string) => {
        editor.updateBlock(block, {
          props: { formula: newFormula },
        });
      };

      return (
        <LatexRenderer
          formula={block.props.formula}
          onFormulaChange={handleFormulaChange}
          editor={editor}
          block={block}
        />
      );
    },
  },
);

export const getLatexReactSlashMenuItems = (
  editor: DocsBlockNoteEditor,
  t: TFunction<'translation', undefined>,
  group: string,
) => [
  {
    title: t('LaTeX Formula'),
    onItemClick: () => {
      insertOrUpdateBlock(editor, {
        type: 'latex',
        props: {
          formula: '\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}',
        },
      });
    },
    aliases: ['latex', 'math', 'formula', 'equation', 'katex'],
    group,
    icon: <Icon iconName="functions" $size="18px" />,
    subtext: t('Add a LaTeX formula block'),
  },
];
