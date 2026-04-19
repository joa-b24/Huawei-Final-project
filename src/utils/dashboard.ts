import type { MetricDefinition, StateMetricRecord } from "../types/dataset";

type OpportunityRecord = StateMetricRecord & {
  opportunityScore: number;
  marketAttractiveness: number;
  whitespaceScore: number;
};

export const categoryLabels: Record<string, string> = {
  "Infraestructura digital": "infraestructura digital",
  "Cobertura de red": "cobertura de red",
  Industria: "industria",
  "Contexto territorial": "contexto territorial"
};

export function getCategoryMetrics(metricCatalog: MetricDefinition[], category: string) {
  return metricCatalog
    .filter((metric) => metric.category === category)
    .map((metric) => ({
      id: metric.id,
      label: metric.label,
      category: metric.category
    }));
}

export function getMetricAverage(records: StateMetricRecord[], metricId: string) {
  if (records.length === 0) {
    return 0;
  }

  return records.reduce((total, record) => total + (record.metrics[metricId] ?? 0), 0) / records.length;
}

export function getTopRecordByMetric(records: StateMetricRecord[], metricId: string) {
  return [...records].sort((left, right) => (right.metrics[metricId] ?? 0) - (left.metrics[metricId] ?? 0))[0];
}

export function buildOpportunityRecords(records: StateMetricRecord[]): OpportunityRecord[] {
  if (records.length === 0) {
    return [];
  }

  const ranges = {
    digital_connectivity: getMetricRange(records, "digital_connectivity"),
    mobile_coverage_5g: getMetricRange(records, "mobile_coverage_5g"),
    industrial_activity: getMetricRange(records, "industrial_activity"),
    population_millions: getMetricRange(records, "population_millions"),
    urbanization_rate: getMetricRange(records, "urbanization_rate")
  };

  return records.map((record) => {
    const marketAttractiveness =
      normalizeValue(record.metrics.industrial_activity, ranges.industrial_activity) * 0.45 +
      normalizeValue(record.metrics.population_millions, ranges.population_millions) * 0.35 +
      normalizeValue(record.metrics.urbanization_rate, ranges.urbanization_rate) * 0.2;

    const whitespaceScore =
      (1 - normalizeValue(record.metrics.mobile_coverage_5g, ranges.mobile_coverage_5g)) * 0.6 +
      (1 - normalizeValue(record.metrics.digital_connectivity, ranges.digital_connectivity)) * 0.4;

    const opportunityScore = (marketAttractiveness * 0.65 + whitespaceScore * 0.35) * 100;

    return {
      ...record,
      opportunityScore,
      marketAttractiveness: marketAttractiveness * 100,
      whitespaceScore: whitespaceScore * 100,
      metrics: {
        ...record.metrics,
        opportunityScore
      }
    };
  });
}

export function buildExecutiveInsights(
  records: StateMetricRecord[],
  opportunityRecords: OpportunityRecord[]
) {
  if (records.length === 0 || opportunityRecords.length === 0) {
    return [];
  }

  const digitalLeader = getTopRecordByMetric(records, "digital_connectivity");
  const populationLeader = getTopRecordByMetric(records, "population_millions");
  const opportunityLeader = [...opportunityRecords].sort(
    (left, right) => right.opportunityScore - left.opportunityScore
  )[0];

  return [
    `${digitalLeader.state} marca la referencia digital de la muestra, liderando en conectividad y sirviendo como benchmark de madurez territorial.`,
    `${populationLeader.state} concentra la mayor escala poblacional, lo que eleva su peso relativo para decisiones comerciales y de cobertura.`,
    `${opportunityLeader.state} aparece como la prioridad estrategica inicial al combinar atractivo industrial con espacio para mejorar cobertura digital.`,
    `La plataforma ya permite contrastar liderazgo actual frente a whitespace potencial, una logica util para priorizacion comercial de Huawei.`
  ];
}

function getMetricRange(records: StateMetricRecord[], metricId: string) {
  const values = records.map((record) => record.metrics[metricId] ?? 0);

  return {
    min: Math.min(...values),
    max: Math.max(...values)
  };
}

function normalizeValue(value: number, range: { min: number; max: number }) {
  if (range.max === range.min) {
    return 0.5;
  }

  return (value - range.min) / (range.max - range.min);
}
