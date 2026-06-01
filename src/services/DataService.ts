import type {
  CorrelationsPayload,
  DistributionEntry,
  MetricPolaridad,
  OutlierEntry,
  RankingEntry,
  VariableCatalogEntry,
} from "../types/dataStandard";
import type { DashboardDataset, MetricDefinition, StateMetricRecord } from "../types/dataset";
import type { MunicipioAnalyticsRecord, StateAnalyticsPayload } from "../types/analytics";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos de los payloads cargados
// ─────────────────────────────────────────────────────────────────────────────

export type MunicipalManifestEntry = {
  variables: string[];
  analytics_available: boolean;
};

export type MunicipalManifest = {
  updated_at: string;
  states: Record<string, MunicipalManifestEntry>;
};

export type MunicipalVariableAnalytics = {
  year: number | null;
  stats: {
    count: number;
    mean: number;
    median: number;
    std: number;
    min: number;
    max: number;
    q1: number;
    q3: number;
  };
  rankings: { rank: number; cve_mun: string; value: number }[];
  outliers: { cve_mun: string; value: number }[];
};

export type MunicipalAnalytics = {
  state_code: string;
  updated_at: string;
  variables: Record<string, MunicipalVariableAnalytics>;
};

export type UnivariateStat = {
  count: number;
  mean: number;
  std: number;
  min: number;
  q25: number;
  q50: number;
  q75: number;
  max: number;
  skewness: number;
  kurtosis: number;
};

export type PcaRecord = {
  state: string;
  index: number;
  ranking: number;
  cluster: number;
  cluster_label: string;
  pc1: number;
  pc2: number;
  is_outlier: boolean;
};

export type PcaClusterStat = {
  label: string;
  states: string[];
  mean_index: number;
};

export type PcaResults = {
  updated_at: string;
  kmo: number;
  bartlett_p: number;
  n_clusters: number;
  variance_explained: [number, number];
  loadings: { variables: string[]; pc1: number[]; pc2: number[] };
  records: PcaRecord[];
  cluster_stats: Record<string, PcaClusterStat>;
};

export type TemporalVarMeta = {
  label: string;
  unit: string;
  source: string;
};

export type AppData = {
  dataset: DashboardDataset;
  correlations: CorrelationsPayload;
  distributions: Record<string, DistributionEntry>;
  univariateStats: Record<string, UnivariateStat>;
  rankings: Record<string, RankingEntry[]>;
  outliers: Record<string, OutlierEntry>;
  variablesCatalog: VariableCatalogEntry[];
  municipalManifest: MunicipalManifest | null;
  pcaResults: PcaResults | null;
  /** Variable IDs that have temporal JSON files available */
  temporalVariables: string[];
  /** Label/unit/source metadata for temporal-only variables */
  temporalMeta: Record<string, TemporalVarMeta>;
};

// ─────────────────────────────────────────────────────────────────────────────
// Dirección de cada métrica: determina si delta positivo es bueno o malo.
// Derived from variables.catalog.json — ampliar aquí cuando entren variables nuevas.
// ─────────────────────────────────────────────────────────────────────────────

const METRIC_DIRECTION: Record<string, MetricPolaridad> = {
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

export function getMetricPolaridad(
  metricId: string,
  catalog?: VariableCatalogEntry[]
): MetricPolaridad {
  if (catalog) {
    const entry = catalog.find((v) => v.variable_id === metricId);
    if (entry?.direction) return entry.direction;
  }
  return METRIC_DIRECTION[metricId] ?? "higher_better";
}

// ─────────────────────────────────────────────────────────────────────────────
// Carga de datos
// ─────────────────────────────────────────────────────────────────────────────

async function fetchJsonOptional<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(path);
    if (!res.ok) return fallback;
    return await res.json() as T;
  } catch {
    return fallback;
  }
}

function buildDataset(
  combinedPayload: any,
  stateAnalytics: StateAnalyticsPayload | null,
): DashboardDataset {
  const metricMap = new Map<string, MetricDefinition>();

  for (const m of combinedPayload.metric_catalog) {
    const label = m.label ?? m.nombre ?? m.variable_id;
    metricMap.set(m.variable_id, {
      id: m.variable_id,
      label,
      unit: m.unidad ?? m.unidad_base ?? "",
      category: m.categoria_id,
      description: label,
      year: m.anio ?? undefined,
    });
  }

  const records: StateMetricRecord[] = combinedPayload.records.map((r: any) => ({
    state: r.estado,
    region: r.region,
    stateCode: r.state_code,
    cveEnt: r.cve_ent,
    year: r.anio,
    metrics: r.metrics ?? {},
  }));

  return {
    updatedAt: combinedPayload.updated_at,
    metricCatalog: Array.from(metricMap.values()),
    records,
    stateAnalytics,
  };
}

/** Carga los datos municipales analíticos para un estado. Lazy: sólo cuando abre la tab territorial. */
export async function loadStateMunicipalAnalytics(stateCode: string): Promise<MunicipioAnalyticsRecord[]> {
  try {
    const res = await fetch(`/data/outputs/municipal/${stateCode}.json`);
    if (!res.ok) return [];
    const payload = await res.json() as { municipalities?: MunicipioAnalyticsRecord[] };
    return payload.municipalities ?? [];
  } catch {
    return [];
  }
}

export async function loadAppData(): Promise<AppData> {
  const EMPTY_COMBINED = { metric_catalog: [], records: [], sources: [], updated_at: "" };
  const EMPTY_CORRELATIONS: CorrelationsPayload = { pearson: { variables: [], matrix: [], note: "" }, spearman: { variables: [], matrix: [], note: "" } };

  const [combined, correlations, distributions, univariateStats, rankings, outliers, catalogPayload, stateAnalytics, municipalManifest, pcaResults, temporalManifest] =
    await Promise.all([
      fetchJsonOptional<any>("/data/state_dashboard.combined.json", EMPTY_COMBINED),
      fetchJsonOptional<CorrelationsPayload>("/data/outputs/state/correlations.json", EMPTY_CORRELATIONS),
      fetchJsonOptional<Record<string, DistributionEntry>>("/data/outputs/state/distributions.json", {}),
      fetchJsonOptional<Record<string, UnivariateStat>>("/data/outputs/state/univariate_stats.json", {}),
      fetchJsonOptional<Record<string, RankingEntry[]>>("/data/outputs/state/rankings.json", {}),
      fetchJsonOptional<Record<string, OutlierEntry>>("/data/outputs/state/outliers_iqr.json", {}),
      fetchJsonOptional<{ variables: VariableCatalogEntry[] }>("/data/variables.catalog.json", { variables: [] }),
      fetchJsonOptional<StateAnalyticsPayload | null>("/data/state_analytics_dashboard.json", null),
      fetchJsonOptional<MunicipalManifest | null>("/data/municipal_manifest.json", null),
      fetchJsonOptional<PcaResults | null>("/data/outputs/pca/pca_results.json", null),
      fetchJsonOptional<{ variables: string[] } | null>("/data/outputs/temporal/manifest.json", null),
    ]);

  return {
    dataset: buildDataset(combined, stateAnalytics),
    correlations,
    distributions,
    univariateStats,
    rankings,
    outliers,
    variablesCatalog: catalogPayload.variables,
    municipalManifest,
    pcaResults,
    temporalVariables: temporalManifest?.variables ?? [],
    temporalMeta: (temporalManifest as any)?.metadata ?? {},
  };
}
