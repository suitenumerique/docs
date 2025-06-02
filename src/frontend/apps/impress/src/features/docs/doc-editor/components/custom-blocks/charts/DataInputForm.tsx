import React from 'react';
import styled from 'styled-components';

import { ChartData, Dataset } from './types';

interface DataInputFormProps {
  data: ChartData;
  onChange: (data: ChartData) => void;
}

const FormContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;
const SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
`;
const SectionTitle = styled.h3`
  font-size: 1.125rem;
  font-weight: 500;
  color: #1f2937;
`;
const AddButton = styled.button`
  padding: 0.25rem 0.75rem;
  background: #3b82f6;
  color: #fff;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  &:hover {
    background: #2563eb;
  }
`;
const RemoveButton = styled.button`
  padding: 0.5rem 0.75rem;
  background: #ef4444;
  color: #fff;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  &:hover {
    background: #b91c1c;
  }
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
const DatasetCard = styled.div`
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 1rem;
`;
const DatasetHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
`;
const ColorInput = styled.input`
  width: 3rem;
  height: 2rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
`;
const DataGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
  @media (min-width: 640px) {
    grid-template-columns: repeat(3, 1fr);
  }
  @media (min-width: 768px) {
    grid-template-columns: repeat(4, 1fr);
  }
`;
const DataInput = styled.input`
  width: 100%;
  padding: 0.25rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  &:focus {
    outline: none;
    border-color: transparent;
    box-shadow: 0 0 0 1px #3b82f6;
  }
`;
const Label = styled.label`
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.5rem;
`;
const LabelSmall = styled.label`
  font-size: 0.75rem;
  color: #6b7280;
  margin-bottom: 0.25rem;
`;

export const DataInputForm: React.FC<DataInputFormProps> = ({
  data,
  onChange,
}) => {
  const updateLabels = (labels: string[]) => {
    onChange({
      ...data,
      labels,
      datasets: data.datasets.map((dataset) => ({
        ...dataset,
        data: dataset.data
          .slice(0, labels.length)
          .concat(
            Array(Math.max(0, labels.length - dataset.data.length)).fill(0),
          ),
      })),
    });
  };

  const updateDataset = (index: number, updates: Partial<Dataset>) => {
    const newDatasets = [...data.datasets];
    newDatasets[index] = { ...newDatasets[index], ...updates };
    onChange({ ...data, datasets: newDatasets });
  };

  const addDataset = () => {
    const newDataset: Dataset = {
      id: `dataset-${Date.now()}`,
      label: `Dataset ${data.datasets.length + 1}`,
      data: Array(data.labels.length).fill(0) as number[],
      backgroundColor: `hsl(${Math.random() * 360}, 70%, 60%)`,
      borderColor: `hsl(${Math.random() * 360}, 70%, 50%)`,
    };
    onChange({ ...data, datasets: [...data.datasets, newDataset] });
  };

  const removeDataset = (index: number) => {
    const newDatasets = data.datasets.filter((_, i) => i !== index);
    onChange({ ...data, datasets: newDatasets });
  };

  const addLabel = () => {
    const newLabels = [...data.labels, `Label ${data.labels.length + 1}`];
    updateLabels(newLabels);
  };

  const removeLabel = (index: number) => {
    const newLabels = data.labels.filter((_, i) => i !== index);
    updateLabels(newLabels);
  };

  const updateLabel = (index: number, value: string) => {
    const newLabels = [...data.labels];
    newLabels[index] = value;
    updateLabels(newLabels);
  };

  return (
    <FormContainer>
      {/* Labels Section */}
      <div>
        <SectionHeader>
          <SectionTitle>Labels</SectionTitle>
          <AddButton onClick={addLabel}>Add Label</AddButton>
        </SectionHeader>
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
        >
          {data.labels.map((label, index) => (
            <div key={index} style={{ display: 'flex', gap: '0.5rem' }}>
              <Input
                type="text"
                value={label}
                onChange={(e) => updateLabel(index, e.target.value)}
                placeholder={`Label ${index + 1}`}
              />
              <RemoveButton onClick={() => removeLabel(index)}>
                Remove
              </RemoveButton>
            </div>
          ))}
        </div>
      </div>
      {/* Datasets Section */}
      <div>
        <SectionHeader>
          <SectionTitle>Datasets</SectionTitle>
          <AddButton onClick={addDataset}>Add Dataset</AddButton>
        </SectionHeader>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {data.datasets.map((dataset, datasetIndex) => (
            <DatasetCard key={dataset.id}>
              <DatasetHeader>
                <Input
                  type="text"
                  value={dataset.label}
                  onChange={(e) =>
                    updateDataset(datasetIndex, { label: e.target.value })
                  }
                  placeholder="Dataset Label"
                  style={{ fontWeight: 500, borderBottom: '1px solid #d1d5db' }}
                />
                <RemoveButton onClick={() => removeDataset(datasetIndex)}>
                  Remove Dataset
                </RemoveButton>
              </DatasetHeader>
              {/* Color inputs */}
              <div
                style={{
                  display: 'flex',
                  gap: '1rem',
                  marginBottom: '0.75rem',
                }}
              >
                <div>
                  <Label>Background Color</Label>
                  <ColorInput
                    type="color"
                    value={dataset.backgroundColor || '#3B82F6'}
                    onChange={(e) =>
                      updateDataset(datasetIndex, {
                        backgroundColor: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Border Color</Label>
                  <ColorInput
                    type="color"
                    value={dataset.borderColor || '#1D4ED8'}
                    onChange={(e) =>
                      updateDataset(datasetIndex, {
                        borderColor: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              {/* Data values */}
              <DataGrid>
                {dataset.data.map((value, valueIndex) => (
                  <div key={valueIndex}>
                    <LabelSmall>
                      {data.labels[valueIndex] || `Value ${valueIndex + 1}`}
                    </LabelSmall>
                    <DataInput
                      type="number"
                      value={value}
                      onChange={(e) => {
                        const newData = [...dataset.data];
                        newData[valueIndex] = parseFloat(e.target.value) || 0;
                        updateDataset(datasetIndex, { data: newData });
                      }}
                      placeholder="0"
                    />
                  </div>
                ))}
              </DataGrid>
            </DatasetCard>
          ))}
        </div>
      </div>
    </FormContainer>
  );
};
