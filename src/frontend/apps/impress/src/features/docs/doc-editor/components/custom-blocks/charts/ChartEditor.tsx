import React, { useEffect, useState } from 'react';
import styled from 'styled-components';

import { useGristTableData } from '@/features/grist';

import { ChartOptionsForm } from './ChartOptionsForm';
import { ChartTypeSelector } from './ChartTypeSelector';
import { LiveChartPreview } from './LiveChartPreview';
import {
  ChartConfig,
  ChartData,
  ChartOptions,
  ChartType,
  Dataset,
} from './types';

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

export interface ChartEditorProps {
  documentId: string;
  tableId: string;
  chartType: ChartType; // Ajout de chartType
  chartOptions: ChartOptions; // Ajout de chartOptions
  onChartConfigChange: (config: {
    chartType: ChartType;
    chartOptions: ChartOptions;
  }) => void;
}

export const ChartEditor: React.FC<ChartEditorProps> = ({
  documentId,
  tableId,
  chartType: initialChartType, // Utilisation des valeurs initiales
  chartOptions: initialChartOptions,
  onChartConfigChange,
}) => {
  const [chartType, setChartType] = useState<ChartType>(initialChartType);
  const [chartData, setChartData] = useState<ChartData>({
    labels: [],
    datasets: [],
  });
  const [chartOptions, setChartOptions] =
    useState<ChartOptions>(initialChartOptions);
  const [showEditor, setShowEditor] = useState(true);

  // Récupération des données Grist
  const { tableData } = useGristTableData({
    documentId,
    tableId,
  });

  // Transformation des données Grist en données pour le graphique
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transformTableDataToChartData = (tableData: Record<string, any>) => {
      const filteredEntries = Object.entries(tableData).filter(
        ([key]) => key !== 'id' && key !== 'manualSort',
      );

      if (filteredEntries.length === 0) {
        return { labels: [], datasets: [] };
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const labels = filteredEntries[0][1].map((value: unknown) =>
        String(value),
      ) as string[];
      const datasets = filteredEntries.slice(1).map(([key, values], idx) => ({
        id: `dataset-${idx}`,
        label: key,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        data: values.map((v: unknown) => convertUnknownToNumber(v)),
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
        borderColor: 'rgba(53, 162, 235, 1)',
      })) as Dataset[];

      return { labels, datasets };
    };

    setChartData(transformTableDataToChartData(tableData));
  }, [tableData]);

  const convertUnknownToNumber = (v: unknown) => {
    if (typeof v === 'number') {
      return v;
    } else if (typeof v === 'string' && !isNaN(Number(v))) {
      return Number(v);
    }
    return 0;
  };

  // Communication des modifications de configuration au parent
  useEffect(() => {
    onChartConfigChange({ chartType, chartOptions });
  }, [chartType, chartOptions, onChartConfigChange]);

  const config: ChartConfig = {
    type: chartType,
    data: chartData,
    options: chartOptions,
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
          </ControlPanel>
        )}
      </ChartEditorGrid>
    </ChartEditorContainer>
  );
};
