import type { MunicipioAnalyticsRecord, StateAnalyticsPayload } from "./analytics";

export type { MunicipioAnalyticsRecord, StateAnalyticsPayload } from "./analytics";

export type MetricDefinition = {
  id: string;
  label: string;
  unit: string;
  category: string;
  description: string;
  year?: number;
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
  /** Analítica territorial (pipeline municipal); puede ser null si falla la carga. */
  stateAnalytics: StateAnalyticsPayload | null;
  municipios: MunicipioAnalyticsRecord[];
};
