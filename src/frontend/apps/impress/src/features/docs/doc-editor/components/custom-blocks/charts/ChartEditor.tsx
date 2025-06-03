import React, { useState } from 'react';
import styled from 'styled-components';

import { ChartOptionsForm } from './ChartOptionsForm';
import { ChartTypeSelector } from './ChartTypeSelector';
import { CollapsibleCard } from './CollapsibleCard';
import { DataInputForm } from './DataInputForm';
import { LiveChartPreview } from './LiveChartPreview';
import { ChartConfig, ChartData, ChartOptions, ChartType } from './types';

const initialData: ChartData = {
  labels: ['January', 'February', 'March', 'April', 'May'],
  datasets: [
    {
      id: 'dataset-1',
      label: 'Sales',
      data: [65, 59, 80, 81, 56],
      backgroundColor: 'rgba(53, 162, 235, 0.5)',
      borderColor: 'rgba(53, 162, 235, 1)',
    },
  ],
};

const initialOptions: ChartOptions = {
  title: 'My Chart',
  showLegend: true,
  xAxisLabel: 'Months',
  yAxisLabel: 'Values',
};

const ChartEditorContainer = styled.div`
  max-width: 80rem;
  margin: 0 auto;
  padding: 1.5rem;
  background-color: #f9fafb;
  min-height: 100vh;
`;

const ChartEditorHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
`;

const ChartEditorTitle = styled.h1`
  font-size: 1.875rem;
  font-weight: bold;
  color: #111827;
  margin-bottom: 0.5rem;
`;

const ChartEditorSubtitle = styled.p`
  color: #4b5563;
`;

const ChartEditorGrid = styled.div.withConfig({
  shouldForwardProp: (prop) => prop !== 'showEditor',
})<{ showEditor: boolean }>`
  display: grid;
  grid-template-columns: ${({ showEditor }: { showEditor: boolean }) =>
    showEditor ? '2fr 1fr' : '1fr'};
  gap: 2rem;
  transition: grid-template-columns 0.3s ease-in-out;

  @media (max-width: 1023px) {
    grid-template-columns: 1fr;
  }
`;

const PreviewContainer = styled.div`
  width: 100%;
  height: 100%;
`;

const ControlPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

// const CollapsibleCard = styled.div`
//   background: #fff;
//   border-radius: 0.5rem;
//   box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
//   border: 1px solid #e5e7eb;
//   padding: 1.5rem;
// `;

const ChartEditorButtonRow = styled.div`
  display: flex;
  gap: 1rem;
`;

const ExportButton = styled.button`
  padding: 0.5rem 1rem;
  background: #4f46e5;
  color: #fff;
  border-radius: 0.375rem;
  transition: background 0.2s;
  &:hover {
    background: #4338ca;
  }
`;

const ToggleButton = styled.button`
  font-size: 1.5rem;
  background: none;
  border: none;
  color: #6b7280;
  cursor: pointer;
  &:hover {
    color: #111827;
  }
`;

export const ChartEditor: React.FC = () => {
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [chartData, setChartData] = useState<ChartData>(initialData);
  const [chartOptions, setChartOptions] =
    useState<ChartOptions>(initialOptions);
  const [showEditor, setShowEditor] = useState(true);

  const config: ChartConfig = {
    type: chartType,
    data: chartData,
    options: chartOptions,
  };

  const exportConfig = () => {
    const configJson = JSON.stringify(config, null, 2);
    const blob = new Blob([configJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chart-config.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <ChartEditorContainer>
      <ChartEditorHeader>
        <div>
          <ChartEditorTitle>Chart Editor</ChartEditorTitle>
          <ChartEditorSubtitle>
            Create and customize your charts with live preview
          </ChartEditorSubtitle>
        </div>
        <ToggleButton onClick={() => setShowEditor((prev) => !prev)}>
          &#x2026;
        </ToggleButton>
      </ChartEditorHeader>

      <ChartEditorGrid showEditor={showEditor}>
        <PreviewContainer>
          <LiveChartPreview config={config} />
        </PreviewContainer>

        {showEditor && (
          <ControlPanel>
            <ChartTypeSelector value={chartType} onChange={setChartType} />
            <ChartOptionsForm
              options={chartOptions}
              onChange={setChartOptions}
            />
            {/* <CollapsibleCard>
              <DataInputForm data={chartData} onChange={setChartData} />
            </CollapsibleCard>
            <ChartEditorButtonRow>
              <ExportButton onClick={exportConfig}>Export Config</ExportButton>
            </ChartEditorButtonRow> */}
          </ControlPanel>
        )}
      </ChartEditorGrid>
    </ChartEditorContainer>
  );
};
