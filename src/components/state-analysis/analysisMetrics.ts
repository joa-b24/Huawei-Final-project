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
