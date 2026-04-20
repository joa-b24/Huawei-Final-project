import type { DashboardDataset } from "../types/dataset";

export async function loadDataset(): Promise<DashboardDataset> {
  const response = await fetch("/data/endutih_2024_state_dashboard.wide.json");

  if (!response.ok) {
    throw new Error("No se pudo cargar el dataset procesado.");
  }

  const payload = await response.json();

  return {
    updatedAt: payload.updated_at,
    metricCatalog: payload.metric_catalog.map((metric: any) => ({
      id: metric.variable_id,
      label: metric.label,
      unit: metric.unidad,
      category: categoryIdToLabel(metric.categoria_id),
      description: `${metric.label} derivada de ${payload.source}.`
    })),
    records: payload.records.map((record: any) => ({
      state: record.estado,
      region: record.region,
      stateCode: record.state_code,
      cveEnt: record.cve_ent,
      year: record.anio,
      metrics: record.metrics
    }))
  };
}

function categoryIdToLabel(categoryId: string) {
  const labels: Record<string, string> = {
    infraestructura_digital: "Infraestructura digital",
    cobertura_red: "Cobertura de red",
    industria: "Industria",
    contexto_territorial: "Contexto territorial"
  };

  return labels[categoryId] ?? categoryId;
}
