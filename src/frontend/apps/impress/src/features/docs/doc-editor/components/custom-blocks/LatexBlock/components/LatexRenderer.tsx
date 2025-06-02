import katex from 'katex';
import 'katex/dist/katex.min.css';
import React, { useEffect, useRef, useState } from 'react';

import { Box, Icon } from '@/components';

import { CodeEditor } from '../../../CodeEditor/index';
import { blockStyles } from '../../shared/styles';
import type { LatexRendererProps } from '../types';

export const LatexRenderer = ({
  formula,
  onFormulaChange,
}: LatexRendererProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const blockRef = useRef<HTMLDivElement>(null);
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

  return (
    <Box
      ref={blockRef}
      $padding="1rem"
      style={blockStyles.container}
      onClick={() => setIsLocalEditing(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          setIsLocalEditing(true);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div
        ref={containerRef}
        style={{
          display: formula.trim() ? 'block' : 'none',
        }}
      />
      {!formula.trim() && (
        <div style={blockStyles.placeholder}>
          <Icon iconName="functions" $size="18px" />
          Click here to edit the LaTeX formula.
        </div>
      )}
      {isLocalEditing && (
        <CodeEditor
          value={formula}
          onChange={onFormulaChange}
          language="latex"
          onClickOutside={() => setIsLocalEditing(false)}
          parentRef={blockRef}
        />
      )}
    </Box>
  );
};
