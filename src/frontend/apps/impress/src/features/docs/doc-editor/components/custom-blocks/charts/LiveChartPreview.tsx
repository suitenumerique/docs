import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';
import React from 'react';
import { Bar, Line, Pie } from 'react-chartjs-2';

import { ChartConfig } from './types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
);

interface LiveChartPreviewProps {
  config: ChartConfig;
}

export const LiveChartPreview: React.FC<LiveChartPreviewProps> = ({
  config,
}) => {
  const { type, data, options } = config;

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        display: options.showLegend,
        position: 'top' as const,
      },
      title: {
        display: !!options.title,
        text: options.title,
      },
    },
    scales:
      type !== 'pie'
        ? {
            x: {
              display: true,
              title: {
                display: !!options.xAxisLabel,
                text: options.xAxisLabel,
              },
            },
            y: {
              display: true,
              title: {
                display: !!options.yAxisLabel,
                text: options.yAxisLabel,
              },
            },
          }
        : undefined,
  };

  const renderChart = () => {
    switch (type) {
      case 'bar':
        return <Bar data={data} options={chartOptions} />;
      case 'line':
        return <Line data={data} options={chartOptions} />;
      case 'pie':
        return <Pie data={data} options={chartOptions} />;
      default:
        return <div>Invalid chart type</div>;
    }
  };

  return (
    <div className="bg-white p-4 border border-gray-200 rounded-lg">
      <h3 className="text-lg font-medium text-gray-800 mb-4">Live Preview</h3>
      <div className="h-96">{renderChart()}</div>
    </div>
  );
};
