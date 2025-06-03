import React from 'react';
import styled from 'styled-components';

import { ChartOptions } from './types';
import { CollapsibleCard } from './CollapsibleCard';

interface ChartOptionsFormProps {
  options: ChartOptions;
  onChange: (options: ChartOptions) => void;
}

const FormContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const Label = styled.label`
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.5rem;
`;

const Input = styled.input`
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

const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
`;

const Checkbox = styled.input`
  margin-right: 0.5rem;
  height: 1rem;
  width: 1rem;
  color: #2563eb;
  border: 1px solid #d1d5db;
  border-radius: 0.25rem;
`;

const CheckboxText = styled.span`
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
`;

export const ChartOptionsForm: React.FC<ChartOptionsFormProps> = ({
  options,
  onChange,
}) => {
  const updateOption = (key: keyof ChartOptions, value: string | boolean) => {
    onChange({ ...options, [key]: value });
  };

  return (
    <CollapsibleCard title="Chart Options" defaultOpen={true}>
      <FormContainer>
        {/* <SectionTitle>Chart Options</SectionTitle> */}
        <div>
          <Label>Chart Title</Label>
          <Input
            type="text"
            value={options.title}
            onChange={(e) => updateOption('title', e.target.value)}
            placeholder="Enter chart title"
          />
        </div>
        <div>
          <CheckboxLabel>
            <Checkbox
              type="checkbox"
              checked={options.showLegend}
              onChange={(e) => updateOption('showLegend', e.target.checked)}
            />
            <CheckboxText>Show Legend</CheckboxText>
          </CheckboxLabel>
        </div>
        <div>
          <Label>X-Axis Label</Label>
          <Input
            type="text"
            value={options.xAxisLabel}
            onChange={(e) => updateOption('xAxisLabel', e.target.value)}
            placeholder="Enter X-axis label"
          />
        </div>
        <div>
          <Label>Y-Axis Label</Label>
          <Input
            type="text"
            value={options.yAxisLabel}
            onChange={(e) => updateOption('yAxisLabel', e.target.value)}
            placeholder="Enter Y-axis label"
          />
        </div>
      </FormContainer>
    </CollapsibleCard>
  );
};
