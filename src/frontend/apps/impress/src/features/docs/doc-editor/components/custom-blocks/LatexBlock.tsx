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
}: {
  formula: string;
  onFormulaChange?: (formula: string) => void;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const blockRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { colorsTokens } = useCunninghamTheme();
  const [inputValue, setInputValue] = useState(formula);
  const [isLocalEditing, setIsLocalEditing] = useState(false);

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

  useEffect(() => {
    if (isLocalEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isLocalEditing]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        blockRef.current &&
        !blockRef.current.contains(event.target as Node)
      ) {
        setIsLocalEditing(false);
      }
    };

    if (isLocalEditing) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isLocalEditing]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onFormulaChange?.(newValue);
  };

  const handleClick = () => {
    setIsLocalEditing(true);
  };

  return (
    <Box
      ref={blockRef}
      $padding="1rem"
      // $background={colorsTokens['greyscale-100']}
      style={{
        width: '100%',

        overflowX: 'auto',
        cursor: 'pointer',
      }}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleClick();
        }
      }}
      role="button"
      tabIndex={0}
    >
      {isLocalEditing && (
        <Box $gap="1rem">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            placeholder="Enter LaTeX formula..."
            fullWidth
          />
        </Box>
      )}
      <div ref={containerRef} />
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
