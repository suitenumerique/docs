export type ChartType = 'bar' | 'line' | 'pie';

export interface Dataset {
  id: string;
  label: string;
  data: number[];
  backgroundColor?: string;
  borderColor?: string;
}

export interface ChartData {
  labels: string[];
  datasets: Dataset[];
}

export interface ChartOptions {
  title: string;
  showLegend: boolean;
  xAxisLabel: string;
  yAxisLabel: string;
}

export interface ChartConfig {
  type: ChartType;
  data: ChartData;
  options: ChartOptions;
}
