export type MetricDefinition = {
  id: string;
  label: string;
  unit: string;
  category: string;
  description: string;
};

export type StateMetricRecord = {
  state: string;
  region: string;
  stateCode?: string;
  cveEnt?: string;
  year?: number;
  metrics: Record<string, number>;
};

export type DashboardDataset = {
  updatedAt: string;
  metricCatalog: MetricDefinition[];
  records: StateMetricRecord[];
};
