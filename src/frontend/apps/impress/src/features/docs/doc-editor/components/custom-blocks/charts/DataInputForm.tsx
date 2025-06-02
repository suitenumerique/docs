import React from 'react';

import { ChartData, Dataset } from './types';

interface DataInputFormProps {
  data: ChartData;
  onChange: (data: ChartData) => void;
}

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
      data: Array(data.labels.length).fill(0),
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
    <div className="space-y-6">
      {/* Labels Section */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-medium text-gray-800">Labels</h3>
          <button
            onClick={addLabel}
            className="px-3 py-1 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600"
          >
            Add Label
          </button>
        </div>
        <div className="space-y-2">
          {data.labels.map((label, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                value={label}
                onChange={(e) => updateLabel(index, e.target.value)}
                className="flex-1 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={`Label ${index + 1}`}
              />
              <button
                onClick={() => removeLabel(index)}
                className="px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Datasets Section */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-medium text-gray-800">Datasets</h3>
          <button
            onClick={addDataset}
            className="px-3 py-1 bg-green-500 text-white rounded-md text-sm hover:bg-green-600"
          >
            Add Dataset
          </button>
        </div>
        <div className="space-y-4">
          {data.datasets.map((dataset, datasetIndex) => (
            <div
              key={dataset.id}
              className="border border-gray-200 rounded-lg p-4"
            >
              <div className="flex justify-between items-center mb-3">
                <input
                  type="text"
                  value={dataset.label}
                  onChange={(e) =>
                    updateDataset(datasetIndex, { label: e.target.value })
                  }
                  className="font-medium p-1 border-b border-gray-300 focus:border-blue-500 focus:outline-none"
                  placeholder="Dataset Label"
                />
                <button
                  onClick={() => removeDataset(datasetIndex)}
                  className="px-2 py-1 bg-red-500 text-white rounded-md text-sm hover:bg-red-600"
                >
                  Remove Dataset
                </button>
              </div>

              {/* Color inputs */}
              <div className="flex gap-4 mb-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Background Color
                  </label>
                  <input
                    type="color"
                    value={dataset.backgroundColor || '#3B82F6'}
                    onChange={(e) =>
                      updateDataset(datasetIndex, {
                        backgroundColor: e.target.value,
                      })
                    }
                    className="w-12 h-8 border border-gray-300 rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Border Color
                  </label>
                  <input
                    type="color"
                    value={dataset.borderColor || '#1D4ED8'}
                    onChange={(e) =>
                      updateDataset(datasetIndex, {
                        borderColor: e.target.value,
                      })
                    }
                    className="w-12 h-8 border border-gray-300 rounded"
                  />
                </div>
              </div>

              {/* Data values */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {dataset.data.map((value, valueIndex) => (
                  <div key={valueIndex}>
                    <label className="block text-xs text-gray-500 mb-1">
                      {data.labels[valueIndex] || `Value ${valueIndex + 1}`}
                    </label>
                    <input
                      type="number"
                      value={value}
                      onChange={(e) => {
                        const newData = [...dataset.data];
                        newData[valueIndex] = parseFloat(e.target.value) || 0;
                        updateDataset(datasetIndex, { data: newData });
                      }}
                      className="w-full p-1 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
