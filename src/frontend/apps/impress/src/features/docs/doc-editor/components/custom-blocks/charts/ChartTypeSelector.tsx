import React from 'react';
import styled from 'styled-components';

import { CollapsibleCard } from './CollapsibleCard';
import { ChartType } from './types';

interface ChartTypeSelectorProps {
  value: ChartType;
  onChange: (type: ChartType) => void;
}

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
    <CollapsibleCard title="Chart Type" defaultOpen={true}>
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
    </CollapsibleCard>
  );
};
