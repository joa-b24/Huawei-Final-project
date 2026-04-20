import type { MetricDefinition, StateMetricRecord } from "../types/dataset";

export function buildInsights(records: StateMetricRecord[], metric: MetricDefinition): string[] {
  if (records.length === 0) {
    return [];
  }

  const sorted = [...records].sort(
    (left, right) => right.metrics[metric.id] - left.metrics[metric.id]
  );

  const leader = sorted[0];
  const laggard = sorted[sorted.length - 1];
  const average =
    sorted.reduce((total, record) => total + record.metrics[metric.id], 0) / sorted.length;

  return [
    `${leader.state} lidera en ${metric.label.toLowerCase()} con ${leader.metrics[metric.id].toFixed(1)} ${metric.unit}.`,
    `${laggard.state} presenta el menor valor en ${metric.label.toLowerCase()}, lo que sugiere una oportunidad de expansion o priorizacion comercial.`,
    `El promedio simple de la muestra es ${average.toFixed(1)} ${metric.unit}, util como referencia para benchmark territorial.`,
    `La distribucion territorial de ${metric.label.toLowerCase()} ayuda a detectar brechas de adopcion y focos de oportunidad.`
  ];
}
