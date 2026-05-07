import type { DashboardDataset } from "../types/dataset";
import type { MunicipioAnalyticsRecord, StateAnalyticsPayload } from "../types/analytics";

export async function loadDataset(): Promise<DashboardDataset> {
  const endutihRes = await fetch("/data/endutih_2024_state_dashboard.wide.json");
  if (!endutihRes.ok) {
    throw new Error("No se pudo cargar el dataset ENDUTIH procesado.");
  }
  const payload = await endutihRes.json();

  let stateAnalytics: StateAnalyticsPayload | null = null;
  let municipios: MunicipioAnalyticsRecord[] = [];

  try {
    const [dashRes, munRes] = await Promise.all([
      fetch("/data/state_analytics_dashboard.json"),
      fetch("/data/municipios_master_analytics.json")
    ]);
    if (dashRes.ok) {
      stateAnalytics = (await dashRes.json()) as StateAnalyticsPayload;
    }
    if (munRes.ok) {
      municipios = (await munRes.json()) as MunicipioAnalyticsRecord[];
    }
  } catch {
    /* dashboard territorial opcional */
  }

  return {
    updatedAt: payload.updated_at,
    metricCatalog: payload.metric_catalog.map((metric: { variable_id: string; label: string; unidad: string; categoria_id: string }) => ({
      id: metric.variable_id,
      label: metric.label,
      unit: metric.unidad,
      category: categoryIdToLabel(metric.categoria_id),
      description: `${metric.label} derivada de ${payload.source}.`
    })),
    records: payload.records.map(
      (record: { estado: string; region: string; state_code: string; cve_ent: string; anio: number; metrics: Record<string, number> }) => ({
        state: record.estado,
        region: record.region,
        stateCode: record.state_code,
        cveEnt: record.cve_ent,
        year: record.anio,
        metrics: record.metrics
      })
    ),
    stateAnalytics,
    municipios
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
