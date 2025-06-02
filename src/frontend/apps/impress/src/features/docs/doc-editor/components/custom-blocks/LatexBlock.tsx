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
  isEditing,
  onFormulaChange,
}: {
  formula: string;
  isEditing?: boolean;
  onFormulaChange?: (formula: string) => void;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { colorsTokens } = useCunninghamTheme();
  const [inputValue, setInputValue] = useState(formula);

  useEffect(() => {
    if (containerRef.current) {
      try {
        katex.render(formula, containerRef.current, {
          displayMode: true,
          throwOnError: false,
        });
      } catch {
        containerRef.current.innerHTML = '/!\\ Invalid LaTeX formula';
      }
    }
  }, [formula]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onFormulaChange?.(newValue);
  };

  return (
    <Box
      $padding="1rem"
      $background={colorsTokens['greyscale-100']}
      style={{
        borderRadius: '4px',
        border: `1px solid ${colorsTokens['greyscale-300']}`,
        overflowX: 'auto',
      }}
    >
      {isEditing ? (
        <Box $gap="1rem">
          <Input
            value={inputValue}
            onChange={handleInputChange}
            placeholder="Enter LaTeX formula..."
            fullWidth
          />
          <div ref={containerRef} />
        </Box>
      ) : (
        <div ref={containerRef} />
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
      const isEditing =
        editor.isEditable && block.props.backgroundColor === 'default';

      const handleFormulaChange = (newFormula: string) => {
        editor.updateBlock(block, {
          props: { formula: newFormula },
        });
      };

      return (
        <LatexRenderer
          formula={block.props.formula}
          isEditing={isEditing}
          onFormulaChange={handleFormulaChange}
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
