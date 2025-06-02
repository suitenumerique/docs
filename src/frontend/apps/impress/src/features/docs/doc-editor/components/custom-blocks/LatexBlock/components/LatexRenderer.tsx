import React, { useEffect, useRef, useState } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

import { Box } from '@/components';

import { CodeEditor } from '../../CodeEditor';
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
      style={{
        width: '100%',
        overflowX: 'auto',
        cursor: 'pointer',
      }}
      onClick={() => setIsLocalEditing(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          setIsLocalEditing(true);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div ref={containerRef} />
      {isLocalEditing && (
        <CodeEditor
          value={formula}
          onChange={onFormulaChange}
          onClickOutside={() => setIsLocalEditing(false)}
          parentRef={blockRef}
        />
      )}
    </Box>
  );
};
