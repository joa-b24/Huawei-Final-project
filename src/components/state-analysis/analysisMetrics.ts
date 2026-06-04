// Fixed 5-metric set used in the Spearman heatmap (analytical view, not user-driven).
export const ANALYSIS_METRICS = [
  { key: "pob_pct_4g_garantizada", label: "Cobertura 4G (población)", unit: "%" },
  { key: "graproes", label: "Grado promedio de escolaridad", unit: "años equiv." },
  { key: "pct_pob_0_14", label: "% población 0–14 años", unit: "%" },
  { key: "pct_pob_65_mas", label: "% población 65 años y más", unit: "%" },
  { key: "pct_mujeres", label: "% mujeres", unit: "%" }
] as const;

export type AnalysisMetricKey = (typeof ANALYSIS_METRICS)[number]["key"];

/** Bandas etarias en el censo (suman ~100%); no conviene cruzar dos a la vez en dispersión. */
export const AGE_METRIC_KEYS: AnalysisMetricKey[] = ["pct_pob_0_14", "pct_pob_65_mas"];

export const COVERAGE_METRIC_KEY: AnalysisMetricKey = "pob_pct_4g_garantizada";

// Extended metric set for the scatter explorer — all fields available in MunicipioAnalyticsRecord.
export const SCATTER_METRICS = [
  { key: "pob_pct_4g_garantizada", label: "Cobertura 4G pob. (%)", unit: "%" },
  { key: "loc_pct_4g_garantizada", label: "Cobertura 4G loc. (%)", unit: "%" },
  { key: "pob_pct_movil", label: "Cobertura movil pob. (%)", unit: "%" },
  { key: "loc_pct_movil", label: "Cobertura movil loc. (%)", unit: "%" },
  { key: "pob_pct_5g_garantizada", label: "Cobertura 5G pob. (%)", unit: "%" },
  { key: "loc_pct_5g_garantizada", label: "Cobertura 5G loc. (%)", unit: "%" },
  { key: "graproes", label: "Escolaridad promedio", unit: "años" },
  { key: "pct_pob_0_14", label: "Pob. 0–14 años", unit: "%" },
  { key: "pct_pob_15_64", label: "Pob. 15–64 años", unit: "%" },
  { key: "pct_pob_65_mas", label: "Pob. 65+ años", unit: "%" },
  { key: "pct_mujeres", label: "% mujeres", unit: "%" },
  { key: "irs_indice", label: "Rezago social (IRS)", unit: "" },
  { key: "brecha_4g_pp", label: "Brecha 4G (pp)", unit: "pp" },
  { key: "ookla_int_avg_speed", label: "Velocidad Ookla (Mbps)", unit: "Mbps" },
  { key: "ookla_pct_4g", label: "Muestras 4G Ookla (%)", unit: "%" },
  { key: "localidades_n", label: "Total localidades", unit: "" },
] as const;

export type ScatterMetricKey = (typeof SCATTER_METRICS)[number]["key"];

/** Variables disponibles para análisis de desigualdad intraestatal. */
export const TERRITORIAL_VARIABLES = [
  { key: "pob_pct_4g_garantizada" as const, label: "Cobertura 4G (pob.)", unit: "%",   weight: "pobtot_iter"  as const },
  { key: "loc_pct_4g_garantizada" as const, label: "Cobertura 4G (loc.)", unit: "%",   weight: "localidades_n" as const },
  { key: "pob_pct_movil"          as const, label: "Cobertura móvil (pob.)", unit: "%", weight: "pobtot_iter" as const },
  { key: "loc_pct_movil"          as const, label: "Cobertura móvil (loc.)", unit: "%", weight: "localidades_n" as const },
  { key: "pob_pct_5g_garantizada" as const, label: "Cobertura 5G (pob.)", unit: "%",   weight: "pobtot_iter" as const },
  { key: "brecha_4g_pp"           as const, label: "Brecha 4G",            unit: "pp",  weight: "pobtot_iter" as const },
  { key: "irs_indice"             as const, label: "Rezago social (IRS)",  unit: "",    weight: "pobtot_iter" as const },
  { key: "ookla_int_avg_speed"    as const, label: "Velocidad internet",   unit: "Mbps", weight: "pobtot_iter" as const },
] as const;

export type TerritorialVarKey = (typeof TERRITORIAL_VARIABLES)[number]["key"];

/** Variables contextuales fijas para el vector Spearman. */
export const CONTEXTUAL_METRICS = [
  { key: "graproes"      as const, label: "Escolaridad promedio" },
  { key: "pct_pob_0_14"  as const, label: "% pob. 0–14 años"   },
  { key: "pct_pob_65_mas" as const, label: "% pob. 65+ años"   },
  { key: "pct_mujeres"   as const, label: "% mujeres"           },
  { key: "irs_indice"    as const, label: "Rezago social (IRS)" },
] as const;

/** Maps state-level variable_id → ScatterMetricKey in MunicipioAnalyticsRecord. */
export const VAR_ID_TO_SCATTER_KEY: Record<string, ScatterMetricKey> = {
  "poblacion_en_localidades_con_4g_garantizada_pct": "pob_pct_4g_garantizada",
  "localidades_con_4g_garantizada_pct": "loc_pct_4g_garantizada",
  "poblacion_en_localidades_con_cobertura_movil_pct": "pob_pct_movil",
  "localidades_con_cobertura_movil_pct": "loc_pct_movil",
  "poblacion_en_localidades_con_5g_garantizada_pct": "pob_pct_5g_garantizada",
  "localidades_con_5g_garantizada_pct": "loc_pct_5g_garantizada",
  "escolaridad_promedio_anios": "graproes",
  "pob_0_14_pct": "pct_pob_0_14",
  "pob_15_64_pct": "pct_pob_15_64",
  "pob_65_mas_pct": "pct_pob_65_mas",
  "irs_indice": "irs_indice",
  "brecha_4g_pp": "brecha_4g_pp",
  "ookla_velocidad_avg_mbps": "ookla_int_avg_speed",
  "ookla_cobertura_4g_pct": "ookla_pct_4g",
  "localidades_total": "localidades_n",
};
