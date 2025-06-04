import Editor from '@monaco-editor/react';
import { Button } from '@openfun/cunningham-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components';

import { getEditorOptions, initializeMonaco } from './config/editorConfig';
import { useClickOutside } from './hooks/useClickOutside';
import { useEditorDimensions } from './hooks/useEditorDimensions';
import { containerStyles, editorContainerStyles, functionEditorsStyle, inputStyle, rightButtonsContainer, leftButtonsContainer, functionEditorsContainer, divContainer } from './styles/editorStyles';
import type { FunctionEditorProps } from './types';
import { winterCGFetchIntegration } from '@sentry/nextjs';
import { Icon } from '@/components';
import katex from 'katex';
import 'katex/dist/katex.min.css';

const defaultNewFunction = '\\cos(3*x)';

const formatNum = (nV : number) => {
  let res = Math.round(nV);
  return res < 2 ? 2 : res;
}

export const FunctionEditor = ({
  functions,
  min,
  max,
  num,
  onChange,
  onClickOutside,
  parentRef
}: FunctionEditorProps) => {
  const { t } = useTranslation();
  const { height: parentHeight, width: parentWidth } = useEditorDimensions(parentRef);
  const editorRef = useClickOutside(onClickOutside);
  const [localFunctions, setLocalFunctions] = useState(functions);
  const [localMin, setLocalMin] = useState(min);
  const [localMax, setLocalMax] = useState(max);
  const [localNum, setLocalNum] = useState(num);

  useEffect(() => {
    setLocalFunctions(functions);
    setLocalMin(min);
    setLocalMax(max);
    setLocalNum(num);
  }, [min, max, num, functions]);

  useEffect(() => {
    void initializeMonaco();
  }, []);

  const containerWidth = `${parentWidth}px`;
  const containerMargin = `${parentHeight}px 0 0 -16px`;

  let functionEditors = localFunctions.map((fun,i) =>
    <Box style={editorContainerStyles}>
      <div style={functionEditorsStyle}>
        <p style={{display : 'inline-block', width : '15%', verticalAlign : 'top', textAlign : 'center'}}><div dangerouslySetInnerHTML={{__html: katex.renderToString(`f_{${i+1}}(x)=`)}}></div></p>
        <div style={{width : '85%', display : 'inline-block', verticalAlign : 'top', marginBottom : '5px'}}>
        <Editor
          language={'latex'}
          height="1.5em"
          value={fun}
          onChange={(val) => setLocalFunctions(localFunctions.map((x,j)=>i==j ? (val || '') : x))}
          options={getEditorOptions()}
          theme="vs-light"
    
        />
        </div>
      </div>
    </Box>
  )

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
      <div style={divContainer}>
        <div style={leftButtonsContainer}>
          
          <Button style={{background : 'none'}} onClick={() => { setLocalFunctions(prev => [...prev, defaultNewFunction]); }}><Icon iconName="add" $size="30px" $color="black" /></Button>
          <br></br>
          <Button style={{background : 'none'}} onClick={() => { setLocalFunctions(prev => (prev.length > 1) ? prev.slice(0, -1) : prev); }}><Icon iconName="remove" $size="30px" $color="black" /></Button>
        </div>
        <div style={functionEditorsContainer}>
          {functionEditors}
          <br />
          <p style={{width : '32%', display : 'inline-block', marginLeft : '0%'}}><div dangerouslySetInnerHTML={{__html: katex.renderToString(`x_{\\text{min}}`)}}></div></p>
          <p style={{width : '32%', display : 'inline-block', marginLeft : '2%'}}><div dangerouslySetInnerHTML={{__html: katex.renderToString(`x_{\\text{max}}`)}}></div></p>
          <p style={{width : '32%', display : 'inline-block', marginLeft : '2%'}}><div dangerouslySetInnerHTML={{__html: katex.renderToString(`n_{\\text{points}}`)}}></div></p>
          <input type='number' style={{padding : '5px', width : '32%', borderRadius: '5px', border : "1px solid grey"}} value={localMin} onChange={(e) => setLocalMin(Number(e.target.value)) }/>
          <input type='number' style={{width : '32%', marginLeft : '2%', padding : '5px', borderRadius: '5px', border : "1px solid grey"}} value={localMax} onChange={(e) => setLocalMax(Number(e.target.value)) }/>
          <input type='number' style={{width : '32%', marginLeft : '2%', padding : '5px', borderRadius: '5px', border : "1px solid grey"}} value={localNum} onChange={(e) => setLocalNum(formatNum(Number(e.target.value))) }/>
        </div>
        
        <div style={rightButtonsContainer}>
          <Button style={{display : 'inline-block', verticalAlign : 'top'}} onClick={() => onChange(localFunctions, localMin, localMax, localNum)}>{t('Validate')}</Button>
        </div>
      </div>
      
    </Box>
  );
};
