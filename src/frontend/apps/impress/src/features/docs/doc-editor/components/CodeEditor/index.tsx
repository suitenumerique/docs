import Editor from '@monaco-editor/react';
import { Button } from '@openfun/cunningham-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components';

import { getEditorOptions, initializeMonaco } from './config/editorConfig';
import { useClickOutside } from './hooks/useClickOutside';
import { useEditorDimensions } from './hooks/useEditorDimensions';
import { containerStyles, editorContainerStyles } from './styles/editorStyles';
import type { CodeEditorProps } from './types';

export const CodeEditor = ({
  value,
  onChange,
  onClickOutside,
  parentRef,
  language = 'latex',
  height = '200px',
  width,
}: CodeEditorProps) => {
  const { t } = useTranslation();
  const { height: parentHeight, width: parentWidth } =
    useEditorDimensions(parentRef);
  const editorRef = useClickOutside(onClickOutside);
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    void initializeMonaco();
  }, []);

  const containerWidth = width || `${((parentWidth - 32) * 4) / 5}px`;
  const containerMargin = `${parentHeight}px 0 0 -16px`;

  return (
    <Box
      ref={editorRef}
      $position="absolute"
      $zIndex={1000}
      $margin={containerMargin}
      $padding="1rem"
      $background="white"
      style={{
        ...containerStyles,
        width: containerWidth,
      }}
    >
      <Box style={editorContainerStyles}>
        <Editor
          language={language}
          height={height}
          value={localValue}
          onChange={(value) => setLocalValue(value || '')}
          options={getEditorOptions(language)}
          theme="vs-light"
        />
      </Box>
      <Button onClick={() => onChange(localValue)}>{t('Validate')}</Button>
    </Box>
  );
};
