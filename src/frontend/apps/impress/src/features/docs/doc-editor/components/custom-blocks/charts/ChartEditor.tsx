import React, { useState } from 'react';

import { ChartOptionsForm } from './ChartOptionsForm';
import { ChartTypeSelector } from './ChartTypeSelector';
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

export const ChartEditor: React.FC = () => {
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [chartData, setChartData] = useState<ChartData>(initialData);
  const [chartOptions, setChartOptions] =
    useState<ChartOptions>(initialOptions);

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
    <div className="max-w-7xl mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Chart Editor</h1>
        <p className="text-gray-600">
          Create and customize your charts with live preview
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Panel - Controls */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <ChartTypeSelector value={chartType} onChange={setChartType} />
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <ChartOptionsForm
              options={chartOptions}
              onChange={setChartOptions}
            />
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <DataInputForm data={chartData} onChange={setChartData} />
          </div>

          <div className="flex gap-4">
            <button
              onClick={exportConfig}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
            >
              Export Config
            </button>
          </div>
        </div>

        {/* Right Panel - Preview */}
        <div className="lg:sticky lg:top-6">
          <LiveChartPreview config={config} />
        </div>
      </div>
    </div>
  );
};
