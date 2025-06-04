import React, { useEffect, useRef, useState } from 'react';

import { Box } from '@/components';

import {ComputeEngine} from '@cortex-js/compute-engine';
const ce = new ComputeEngine()

import {Scatter} from 'react-chartjs-2';
import { Chart as ChartJS, LineElement, PointElement, LinearScale, Title, CategoryScale} from 'chart.js';
ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Title);

import { FunctionEditor } from '../../../FunctionEditor';
import type { ChartRendererProps } from '../types';
import { count } from 'console';

const computeChartConfig = (xValue : number[], yValue : number[][]) => {
  let _datasets = [] as any[];
  yValue.forEach((y, i) => {
      const color = Math.round(i*(255/yValue.length));
      _datasets.push({
        type: 'line',
        label: '',
        data: y.map((val, i) => {return {x : xValue[i], y : val}}),
        fill: false,
        borderColor: 'rgb(0, 0,'+ color.toString()+')',
        tension: 0.1
      })
    }
  );

  console.log(xValue);

  return {
    labels : makeArr(xValue[0], xValue[xValue.length - 1], 5).map(val => Math.round(val * 100) / 100),
    datasets : _datasets
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
  functions,
  min,
  max,
  num,
  onFormulaChange,
}: ChartRendererProps) => {
  const blockRef = useRef<HTMLDivElement>(null);
  const [isLocalEditing, setIsLocalEditing] = useState(false);
  const [xValue, setxValue] = useState([] as number[]);
  const [yValue, setyValue] = useState([] as number[][]);

  useEffect(() => {
    console.log("Changed occured !!")
    try {
      console.log(num);
      const arr = makeArr(min, max, num); 
      let prepareY = [] as number[][];
      functions.forEach(fun => {
        try {
          const fn = ce.parse(fun).compile()
          prepareY.push(arr.map(val => Number(fn({x : val}))))
        } catch {
          console.log("ouille ouille");
          prepareY.push(Array.from({length: num+1}, () => NaN));
        }
      });

      setxValue(arr);
      setyValue(prepareY);
    } catch {
      console.log("aie aie");
      setxValue([-5, 5]);
      setyValue([[NaN, NaN]]);
    } 
  }, [functions, min, max, num]);

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
        <FunctionEditor
          functions={functions}
          min={min}
          max={max}
          num={num}
          onChange={onFormulaChange}
          onClickOutside={() => setIsLocalEditing(false)}
          parentRef={blockRef}
        />
      )}
    </Box>
  );
};
