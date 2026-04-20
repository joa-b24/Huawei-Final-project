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
    personas_usuarias_internet_pct: getMetricRange(records, "personas_usuarias_internet_pct"),
    personas_con_smartphone_pct: getMetricRange(records, "personas_con_smartphone_pct"),
    personas_usuarias_computadora_pct: getMetricRange(
      records,
      "personas_usuarias_computadora_pct"
    ),
    personas_usan_redes_sociales_pct: getMetricRange(
      records,
      "personas_usan_redes_sociales_pct"
    ),
    personas_compras_internet_pct: getMetricRange(records, "personas_compras_internet_pct"),
    personas_pagos_internet_pct: getMetricRange(records, "personas_pagos_internet_pct"),
    personas_usan_banca_movil_pct: getMetricRange(records, "personas_usan_banca_movil_pct")
  };

  return records.map((record) => {
    const marketAttractiveness =
      normalizeValue(
        record.metrics.personas_usuarias_internet_pct ?? 0,
        ranges.personas_usuarias_internet_pct
      ) * 0.35 +
      normalizeValue(
        record.metrics.personas_con_smartphone_pct ?? 0,
        ranges.personas_con_smartphone_pct
      ) * 0.25 +
      normalizeValue(
        record.metrics.personas_usan_redes_sociales_pct ?? 0,
        ranges.personas_usan_redes_sociales_pct
      ) * 0.2 +
      normalizeValue(
        record.metrics.personas_usuarias_computadora_pct ?? 0,
        ranges.personas_usuarias_computadora_pct
      ) * 0.2;

    const whitespaceScore =
      (1 -
        normalizeValue(
          record.metrics.personas_compras_internet_pct ?? 0,
          ranges.personas_compras_internet_pct
        )) *
        0.4 +
      (1 -
        normalizeValue(
          record.metrics.personas_pagos_internet_pct ?? 0,
          ranges.personas_pagos_internet_pct
        )) *
        0.35 +
      (1 -
        normalizeValue(
          record.metrics.personas_usan_banca_movil_pct ?? 0,
          ranges.personas_usan_banca_movil_pct
        )) *
        0.25;

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

  const digitalLeader = getTopRecordByMetric(records, "personas_usuarias_internet_pct");
  const mobileLeader = getTopRecordByMetric(records, "personas_conexion_datos_celular_pct");
  const opportunityLeader = [...opportunityRecords].sort(
    (left, right) => right.opportunityScore - left.opportunityScore
  )[0];

  return [
    `${digitalLeader.state} lidera la muestra en uso de internet, funcionando como referencia de adopcion digital.`,
    `${mobileLeader.state} destaca en conexion por datos celulares, una senal util para estrategias moviles y de servicios conectados.`,
    `${opportunityLeader.state} aparece como prioridad estrategica inicial al combinar una base digital fuerte con espacio para profundizar transacciones y servicios.`,
    `La lectura ejecutiva ya distingue entre adopcion digital consolidada y whitespace comercial dentro del ecosistema TIC.`
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
