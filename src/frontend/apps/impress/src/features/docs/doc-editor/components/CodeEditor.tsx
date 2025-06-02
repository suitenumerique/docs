import { Button } from '@openfun/cunningham-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as shiki from 'shiki';

import { Box } from '@/components';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  onClickOutside: () => void;
  parentRef: React.RefObject<HTMLDivElement>;
}

export const CodeEditor = ({
  value,
  onChange,
  onClickOutside,
  parentRef,
}: CodeEditorProps) => {
  const { t } = useTranslation();
  const editorRef = useRef<HTMLDivElement>(null);
  const [parentHeight, setParentHeight] = useState(0);
  const [parentWidth, setParentWidth] = useState(0);
  const [localValue, setLocalValue] = useState(value);
  const [highlightedCode, setHighlightedCode] = useState('');

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    const updateDimensions = () => {
      if (parentRef.current) {
        const rect = parentRef.current.getBoundingClientRect();
        setParentHeight(rect.height);
        setParentWidth(rect.width);
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => {
      window.removeEventListener('resize', updateDimensions);
    };
  }, [parentRef]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        editorRef.current &&
        !editorRef.current.contains(event.target as Node)
      ) {
        onClickOutside();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClickOutside]);

  useEffect(() => {
    const highlightCode = async () => {
      try {
        const highlighter = await shiki.createHighlighter({
          themes: ['github-light'],
          langs: ['latex'],
        });
        const highlighted = highlighter.codeToHtml(localValue, {
          lang: 'latex',
          themes: {
            light: 'github-light',
          },
        });
        setHighlightedCode(highlighted);
      } catch (error) {
        console.error('Error highlighting code:', error);
        setHighlightedCode(localValue);
      }
    };

    void highlightCode();
  }, [localValue]);

  return (
    <Box
      ref={editorRef}
      $position="absolute"
      $zIndex={1000}
      $margin={`${parentHeight}px 0 0 -16px`}
      $padding="1rem"
      $background="white"
      style={{
        border: '1px solid #e0e0e0',
        borderRadius: '4px',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        width: `${((parentWidth - 32) * 4) / 5}px`,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-start',
        boxSizing: 'border-box',
      }}
    >
      <Box
        style={{
          width: '100%',
        }}
      >
        <textarea
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          style={{
            width: '100%',
            padding: '0.5rem',
            border: 'none',
            outline: 'none',
            fontFamily: 'monospace',
            fontSize: '14px',
            lineHeight: '1.5',
            resize: 'none',
            overflow: 'hidden',
            height: 'auto',
            boxSizing: 'border-box',
            maxHeight: '400px',
          }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = `${target.scrollHeight}px`;
          }}
          placeholder={t('Enter LaTeX formula...')}
        />
        <div
          style={{
            marginTop: '0.5rem',
            padding: '0.5rem',
            backgroundColor: '#f6f8fa',
            borderRadius: '4px',
            overflowX: 'auto',
          }}
          dangerouslySetInnerHTML={{ __html: highlightedCode }}
        />
      </Box>
      <Button onClick={() => onChange(localValue)}>{t('Validate')}</Button>
    </Box>
  );
};
