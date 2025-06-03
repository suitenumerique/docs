import React, { useEffect, useRef, useState } from 'react';

import { Box, Icon } from '@/components';

import { CodeEditor } from '../../../CodeEditor/index';
import { blockStyles } from '../../shared/styles';
import { useMermaid } from '../hooks/useMermaid';
import type { MermaidRendererProps } from '../types';

export const MermaidRenderer = ({
  diagram,
  onDiagramChange,
}: MermaidRendererProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const blockRef = useRef<HTMLDivElement>(null);
  const [isLocalEditing, setIsLocalEditing] = useState(false);
  const { mermaidModule, error: mermaidError } = useMermaid();
  const [error, setError] = useState<string | null>(null);
  const diagramId = useRef(
    `mermaid-diagram-${Math.random().toString(36).substr(2, 9)}`,
  );

  useEffect(() => {
    if (containerRef.current && mermaidModule) {
      const renderDiagram = async () => {
        try {
          const { svg } = await mermaidModule.render(
            diagramId.current,
            diagram,
          );
          if (containerRef.current) {
            containerRef.current.innerHTML = svg;
          }
          setError('');
        } catch (error) {
          console.error('Mermaid rendering error:', error);
          setError('Invalid Mermaid diagram');
          if (containerRef.current) {
            containerRef.current.innerHTML = '/!\\ Invalid Mermaid diagram';
          }
        }
      };
      void renderDiagram();
    }
  }, [diagram, mermaidModule]);

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
          display: diagram.trim() && !error && !mermaidError ? 'block' : 'none',
        }}
      />
      {!diagram.trim() && (
        <div style={blockStyles.placeholder}>
          <Icon iconName="account_tree" $size="18px" />
          Click here to edit the Mermaid diagram.
        </div>
      )}
      {diagram.trim() && (error || mermaidError) && (
        <Box
          $margin="0.5rem 0 0 0"
          $padding="0.5rem"
          $background="#fff3f3"
          style={blockStyles.error}
        >
          {error || mermaidError}
        </Box>
      )}
      {isLocalEditing && (
        <CodeEditor
          value={diagram}
          onChange={onDiagramChange}
          onClickOutside={() => setIsLocalEditing(false)}
          parentRef={blockRef}
          language="mermaid"
          height="300px"
        />
      )}
    </Box>
  );
};
 