// ─────────────────────────────────────────────────────────────────────────────
// Categorías y tipos base
// ─────────────────────────────────────────────────────────────────────────────

export type CategoryId =
  | "infraestructura_digital"
  | "cobertura_red"
  | "industria"
  | "contexto_territorial"
  | "bienestar_social"
  | "economia"
  | "demografia";

export type TipoValor = "number" | "integer" | "percentage" | "currency";

export type AgregacionDefault = "avg" | "sum" | "latest";

/** "higher_better": más alto = mejor (ej. cobertura internet).
 *  "lower_better": más bajo = mejor (ej. pobreza, carencia). */
export type MetricDirection = "higher_better" | "lower_better";

// ─────────────────────────────────────────────────────────────────────────────
// Catálogo de variables
// ─────────────────────────────────────────────────────────────────────────────

export type VariableCatalogEntry = {
  variable_id: string;
  categoria_id: CategoryId;
  nombre: string;
  descripcion: string;
  unidad_base: string;
  tipo_valor: TipoValor;
  agregacion_default: AgregacionDefault;
  direction: MetricDirection;
  fuente_sugerida: string;
  sinonimos: string[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Maestro de estados
// ─────────────────────────────────────────────────────────────────────────────

export type StateMasterEntry = {
  state_code: string;
  cve_ent: string;
  estado: string;
  aliases: string[];
  region: string;
  capital: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Observaciones estatales
// ─────────────────────────────────────────────────────────────────────────────

/** Formato largo: un registro por variable por estado por año. */
export type TerritorialObservation = {
  state_code: string;
  cve_ent?: string;
  estado: string;
  categoria: CategoryId;
  variable: string;
  valor: number;
  anio: number;
  fuente: string;
  unidad: string;
};

/** Formato ancho: un registro por estado con todas las métricas como objeto. */
export type TerritorialWideRecord = {
  state_code: string;
  cve_ent?: string;
  estado: string;
  region?: string;
  anio: number;
  metrics: Record<string, number>;
};

// ─────────────────────────────────────────────────────────────────────────────
// Observaciones municipales
// ─────────────────────────────────────────────────────────────────────────────

/** Formato largo municipal: granularidad municipio × variable × año. */
export type MunicipalObservation = {
  cve_ent: string;
  id_cvegeo: string;
  nom_mun: string;
  state_code: string;
  estado: string;
  categoria: CategoryId;
  variable: string;
  valor: number;
  anio: number;
  fuente: string;
  unidad: string;
};

/** Formato ancho municipal: un registro por municipio con todas las métricas. */
export type MunicipalWideRecord = {
  cve_ent: string;
  id_cvegeo: string;
  nom_mun: string;
  state_code: string;
  estado: string;
  anio: number;
  metrics: Record<string, number>;
};

// ─────────────────────────────────────────────────────────────────────────────
// Series temporales
// ─────────────────────────────────────────────────────────────────────────────

/** Un punto en una serie temporal estatal: estado + año + métricas. */
export type TemporalStatePoint = {
  state_code: string;
  estado: string;
  anio: number;
  metrics: Record<string, number>;
};

/** Serie temporal completa de un estado para un conjunto de variables. */
export type TemporalStateSeries = {
  state_code: string;
  estado: string;
  variable: string;
  points: Array<{ anio: number; valor: number }>;
};

// ─────────────────────────────────────────────────────────────────────────────
// Outputs de modelos analíticos (Fase 2)
// ─────────────────────────────────────────────────────────────────────────────

/** Resultado del PCA por estado: coordenadas en el espacio de componentes. */
export type PcaStateResult = {
  state_code: string;
  estado: string;
  components: Record<string, number>; // "pc1", "pc2", etc.
};

/** Metadata de un componente principal. */
export type PcaComponent = {
  component_id: string; // "pc1", "pc2", etc.
  explained_variance_ratio: number;
  loadings: Record<string, number>; // variable_id → loading
};

/** Asignación de cluster por estado. */
export type ClusterAssignment = {
  state_code: string;
  estado: string;
  cluster_id: number;
  cluster_label: string;
  distance_to_centroid: number;
};

/** Descripción de un cluster identificado. */
export type ClusterProfile = {
  cluster_id: number;
  cluster_label: string;
  state_codes: string[];
  centroid: Record<string, number>; // variable_id → valor promedio del cluster
  strategic_implication?: string;
};

/** Output completo de un modelo de clustering. */
export type ClusteringOutput = {
  model: "kmeans" | "dbscan" | "hierarchical";
  n_clusters: number;
  computed_at: string;
  features_used: string[];
  assignments: ClusterAssignment[];
  profiles: ClusterProfile[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Outputs analíticos de Layer 1 (pre-computados)
// ─────────────────────────────────────────────────────────────────────────────

export type HistogramData = {
  bins: number[];
  counts: number[];
};

export type NormalityTest = {
  statistic: number | null;
  p_value: number | null;
  is_normal: boolean | null;
  test: string;
};

export type DistributionEntry = {
  histogram: HistogramData;
  normality: NormalityTest;
};

export type OutlierEntry = {
  outlier_states: string[];
  values: number[];
  bounds: { lower: number; upper: number };
  method: string;
};

export type RankingEntry = {
  rank: number;
  state: string;
  estado: string;
  value: number;
  pct_vs_mean: number;
};

export type StateCard = {
  estado: string;
  region: string;
  metrics: Record<string, number>;
  overall_score: number;
  color_code: "green" | "yellow" | "red";
};

/** Shape de dashboard_data/correlations.json */
export type CorrelationsPayload = {
  pearson: {
    matrix: number[][];
    variables: string[];
    note: string;
  };
  spearman: {
    matrix: number[][];
    variables: string[];
    note: string;
  };
};
