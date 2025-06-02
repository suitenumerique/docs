import React from 'react';
import styled from 'styled-components';

import { ChartType } from './types';

interface ChartTypeSelectorProps {
  value: ChartType;
  onChange: (type: ChartType) => void;
}

const SelectorContainer = styled.div`
  margin-bottom: 1rem;
`;
const Label = styled.label`
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.5rem;
`;
const Select = styled.select`
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 1rem;
  &:focus {
    outline: none;
    border-color: transparent;
    box-shadow: 0 0 0 2px #3b82f6;
  }
`;

export const ChartTypeSelector: React.FC<ChartTypeSelectorProps> = ({
  value,
  onChange,
}) => {
  const chartTypes: { value: ChartType; label: string }[] = [
    { value: 'bar', label: 'Bar Chart' },
    { value: 'line', label: 'Line Chart' },
    { value: 'pie', label: 'Pie Chart' },
  ];

  return (
    <SelectorContainer>
      <Label>Chart Type</Label>
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value as ChartType)}
      >
        {chartTypes.map((type) => (
          <option key={type.value} value={type.value}>
            {type.label}
          </option>
        ))}
      </Select>
    </SelectorContainer>
  );
};
