import type {
  CorrelationsPayload,
  DistributionEntry,
  MetricDirection,
  OutlierEntry,
  RankingEntry,
  StateCard,
  VariableCatalogEntry,
} from "../types/dataStandard";
import type { DashboardDataset, MetricDefinition, StateMetricRecord } from "../types/dataset";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos de los payloads cargados
// ─────────────────────────────────────────────────────────────────────────────

export type AppData = {
  dataset: DashboardDataset;
  stateCards: Record<string, StateCard>;
  correlations: CorrelationsPayload;
  distributions: Record<string, DistributionEntry>;
  rankings: Record<string, RankingEntry[]>;
  outliers: Record<string, OutlierEntry>;
  variablesCatalog: VariableCatalogEntry[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Dirección de cada métrica: determina si delta positivo es bueno o malo.
// Derived from variables.catalog.json — ampliar aquí cuando entren variables nuevas.
// ─────────────────────────────────────────────────────────────────────────────

const METRIC_DIRECTION: Record<string, MetricDirection> = {
  // higher = better
  personas_usuarias_internet_pct: "higher_better",
  personas_usuarias_computadora_pct: "higher_better",
  personas_con_smartphone_pct: "higher_better",
  personas_con_celular_pct: "higher_better",
  personas_usuarias_celular_pct: "higher_better",
  personas_conexion_datos_celular_pct: "higher_better",
  personas_conexion_internet_movil_pct: "higher_better",
  personas_usan_redes_sociales_pct: "higher_better",
  personas_usan_apps_redes_sociales_pct: "higher_better",
  personas_compras_internet_pct: "higher_better",
  personas_pagos_internet_pct: "higher_better",
  personas_banca_electronica_pct: "higher_better",
  personas_usan_banca_movil_pct: "higher_better",
  localidades_con_cobertura_movil_pct: "higher_better",
  localidades_con_4g_garantizada_pct: "higher_better",
  localidades_con_5g_garantizada_pct: "higher_better",
  poblacion_en_localidades_con_cobertura_movil_pct: "higher_better",
  poblacion_en_localidades_con_4g_garantizada_pct: "higher_better",
  poblacion_en_localidades_con_5g_garantizada_pct: "higher_better",
  poblacion_en_localidades_con_internet_pct: "higher_better",
  hogares_en_localidades_con_internet_pct: "higher_better",
  teledensidad_internet_movil: "higher_better",
  no_pobre_no_vulnerable_pct: "higher_better",
  pib_total: "higher_better",
  pib_per_capita: "higher_better",
  poblacion_total: "higher_better",
  poblacion_edad_laboral_pct: "higher_better",
  poblacion_economicamente_activa_pct: "higher_better",
  poblacion_afiliada_imss_pct: "higher_better",
  int_avg_speed: "higher_better",
  int_pct_4g_coverage: "higher_better",
  int_pct_5g_coverage: "higher_better",
  // lower = better
  pobreza_pct: "lower_better",
  pobreza_extrema_pct: "lower_better",
  vulnerable_carencias_pct: "lower_better",
  rezago_educativo_pct: "lower_better",
  carencia_salud_pct: "lower_better",
  carencia_servicios_basicos_pct: "lower_better",
  ingreso_inferior_lp_pct: "lower_better",
  int_pct_3g_coverage: "lower_better",
};

export function getMetricDirection(
  metricId: string,
  catalog?: VariableCatalogEntry[]
): MetricDirection {
  if (catalog) {
    const entry = catalog.find((v) => v.variable_id === metricId);
    if (entry?.direction) return entry.direction;
  }
  return METRIC_DIRECTION[metricId] ?? "higher_better";
}

// ─────────────────────────────────────────────────────────────────────────────
// Carga de datos
// ─────────────────────────────────────────────────────────────────────────────

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`No se pudo cargar ${path} (${res.status})`);
  return res.json() as Promise<T>;
}

async function fetchJsonOptional<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(path);
    if (!res.ok) return fallback;
    return await res.json() as T;
  } catch {
    return fallback;
  }
}

function buildDataset(endutihPayload: any, contextPayload: any): DashboardDataset {
  const metricMap = new Map<string, MetricDefinition>();

  for (const m of endutihPayload.metric_catalog) {
    const label = m.label ?? m.nombre ?? m.variable_id;
    metricMap.set(m.variable_id, {
      id: m.variable_id,
      label,
      unit: m.unidad ?? m.unidad_base ?? "",
      category: m.categoria_id,
      description: `${label} — fuente: ${endutihPayload.source}`,
    });
  }

  for (const m of contextPayload.metric_catalog) {
    if (!metricMap.has(m.variable_id)) {
      const label = m.label ?? m.nombre ?? m.variable_id;
      metricMap.set(m.variable_id, {
        id: m.variable_id,
        label,
        unit: m.unidad ?? m.unidad_base ?? "",
        category: m.categoria_id,
        description: `${label} — fuente: ${contextPayload.source}`,
      });
    }
  }

  // Fusionar records: ENDUTIH como base, context_variables como capa adicional
  const contextByState = new Map<string, Record<string, number>>();
  for (const r of contextPayload.records) {
    contextByState.set(r.cve_ent ?? r.state_code, r.metrics ?? {});
  }

  const records: StateMetricRecord[] = endutihPayload.records.map((r: any) => ({
    state: r.estado,
    region: r.region,
    stateCode: r.state_code,
    cveEnt: r.cve_ent,
    year: r.anio,
    metrics: {
      ...r.metrics,
      ...(contextByState.get(r.cve_ent) ?? {}),
    },
  }));

  return {
    updatedAt: endutihPayload.updated_at,
    metricCatalog: Array.from(metricMap.values()),
    records,
  };
}

export async function loadAppData(): Promise<AppData> {
  const EMPTY_CONTEXT = { metric_catalog: [], records: [], source: "", updated_at: "" };
  const EMPTY_CORRELATIONS: CorrelationsPayload = { pearson: { variables: [], matrix: [], note: "" }, spearman: { variables: [], matrix: [], note: "" } };

  const [endutih, context, stateCards, correlations, distributions, rankings, outliers, catalogPayload] =
    await Promise.all([
      fetchJson<any>("/data/endutih_2024_state_dashboard.wide.json"),
      fetchJsonOptional<any>("/data/context_variables_state_dashboard.wide.json", EMPTY_CONTEXT),
      fetchJsonOptional<Record<string, StateCard>>("/data/state_cards.json", {}),
      fetchJsonOptional<CorrelationsPayload>("/data/correlations.json", EMPTY_CORRELATIONS),
      fetchJsonOptional<Record<string, DistributionEntry>>("/data/distributions.json", {}),
      fetchJsonOptional<Record<string, RankingEntry[]>>("/data/rankings.json", {}),
      fetchJsonOptional<Record<string, OutlierEntry>>("/data/outliers_iqr.json", {}),
      fetchJsonOptional<{ variables: VariableCatalogEntry[] }>("/data/variables.catalog.json", { variables: [] }),
    ]);

  return {
    dataset: buildDataset(endutih, context),
    stateCards,
    correlations,
    distributions,
    rankings,
    outliers,
    variablesCatalog: catalogPayload.variables,
  };
}
