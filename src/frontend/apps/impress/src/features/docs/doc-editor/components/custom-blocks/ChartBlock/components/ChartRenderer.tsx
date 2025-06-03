import React, { useEffect, useRef, useState } from 'react';

import { Box } from '@/components';

import {ComputeEngine} from '@cortex-js/compute-engine';
const ce = new ComputeEngine()

import {Scatter} from 'react-chartjs-2';
import { Chart as ChartJS, LineElement, PointElement, LinearScale, Title, CategoryScale} from 'chart.js';
ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Title);

import { CodeEditor } from '../../../CodeEditor';
import type { ChartRendererProps } from '../types';
import { count } from 'console';

const computeChartConfig = (xValue : number[], yValue : number[]) => {
  return {
    labels : makeArr(xValue[0], xValue[xValue.length - 1], 5).map(val => Math.round(val * 100) / 100),
    datasets : [{
      type: 'line',
      label: '',
      data: yValue.map((val, i) => {return {x : xValue[i], y : val}}),
      fill: false,
      borderColor: 'rgb(0, 0, 145)',
      tension: 0.1
    }]
  }
};

const makeArr = (startValue : number, stopValue : number, cardinality : number ) => {
  let arr = [];
  let step = (stopValue - startValue) / cardinality;
  for (let i = 0; i < cardinality; i++)
    arr.push(startValue + (step * i));
  return arr;
}

export const ChartRenderer = ({
  formula,
  onFormulaChange,
}: ChartRendererProps) => {
  const blockRef = useRef<HTMLDivElement>(null);
  const [isLocalEditing, setIsLocalEditing] = useState(false);
  const [xValue, setxValue] = useState([] as number[]);
  const [yValue, setyValue] = useState([] as number[]);

  useEffect(() => {
      const preParsed = formula.split('\n');
      console.log(ce.parse(preParsed[0]).json);
      const fn = ce.parse(preParsed[0]).compile();
      let min = -5.0;
      let max = 5.0;
      let num = 50;

      if(preParsed.length > 1) {
        const secondParse = preParsed[1].split(',');
        console.log(secondParse);
        min = Number(secondParse[0])
        max = Number(secondParse[1])
        num = (secondParse.length > 2) && (Number(secondParse[2]) <= 200) ? Number(secondParse[2]) : num;
        console.log(num)
      }

      const arr = makeArr(min, max, num); 
      setxValue(arr);
      setyValue(arr.map(val => Number(fn({x : val}))));    
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
      <Scatter 
        data = {computeChartConfig(xValue, yValue)}
        options= {{
          elements : {
            point : {
              pointStyle : false
            },
            line : {
              borderWidth : 4
            }
          },
          scales: {
            x: {
              type: 'linear',
              position: 'bottom'
            }
          }
        }}
      />
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
