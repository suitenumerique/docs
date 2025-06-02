import React, { useEffect, useRef, useState } from 'react';

import { Box } from '@/components';

import { CodeEditor } from '../../../CodeEditor/index';
import type { MermaidRendererProps } from '../types';

interface MermaidModule {
  initialize: (config: {
    startOnLoad: boolean;
    theme: string;
    securityLevel: string;
  }) => void;
  render: (id: string, text: string) => Promise<{ svg: string }>;
}

interface MermaidImport {
  default: MermaidModule;
}

export const MermaidRenderer = ({
  diagram,
  onDiagramChange,
}: MermaidRendererProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const blockRef = useRef<HTMLDivElement>(null);
  const [isLocalEditing, setIsLocalEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mermaidModule, setMermaidModule] = useState<MermaidModule | null>(
    null,
  );

  useEffect(() => {
    const loadMermaid = async () => {
      try {
        const mermaid = (await import('mermaid')) as MermaidImport;
        mermaid.default.initialize({
          startOnLoad: true,
          theme: 'default',
          securityLevel: 'loose',
        });
        setMermaidModule(mermaid.default);
      } catch (error) {
        console.error('Failed to load Mermaid:', error);
        setError('Failed to load Mermaid');
      }
    };

    void loadMermaid();
  }, []);

  useEffect(() => {
    if (containerRef.current && mermaidModule) {
      const renderDiagram = async () => {
        try {
          const { svg } = await mermaidModule.render(
            'mermaid-diagram',
            diagram,
          );
          if (containerRef.current) {
            containerRef.current.innerHTML = svg;
          }
          setError(null);
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
      {error && (
        <Box
          $margin="0.5rem 0 0 0"
          $padding="0.5rem"
          $background="#fff3f3"
          style={{
            borderRadius: '4px',
            color: '#d32f2f',
          }}
        >
          {error}
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
