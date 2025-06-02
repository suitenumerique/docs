import React from 'react';

import { ChartOptions } from './types';

interface ChartOptionsFormProps {
  options: ChartOptions;
  onChange: (options: ChartOptions) => void;
}

export const ChartOptionsForm: React.FC<ChartOptionsFormProps> = ({
  options,
  onChange,
}) => {
  const updateOption = (key: keyof ChartOptions, value: string | boolean) => {
    onChange({ ...options, [key]: value });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-800 mb-4">Chart Options</h3>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Chart Title
        </label>
        <input
          type="text"
          value={options.title}
          onChange={(e) => updateOption('title', e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter chart title"
        />
      </div>

      <div>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={options.showLegend}
            onChange={(e) => updateOption('showLegend', e.target.checked)}
            className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <span className="text-sm font-medium text-gray-700">Show Legend</span>
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          X-Axis Label
        </label>
        <input
          type="text"
          value={options.xAxisLabel}
          onChange={(e) => updateOption('xAxisLabel', e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter X-axis label"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Y-Axis Label
        </label>
        <input
          type="text"
          value={options.yAxisLabel}
          onChange={(e) => updateOption('yAxisLabel', e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter Y-axis label"
        />
      </div>
    </div>
  );
};
