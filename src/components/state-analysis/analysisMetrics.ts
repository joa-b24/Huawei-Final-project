export const ANALYSIS_METRICS = [
  { key: "pob_pct_4g_garantizada", label: "Cobertura 4G (población)", unit: "%" },
  { key: "graproes", label: "Grado promedio de escolaridad", unit: "años equiv." },
  { key: "pct_pob_0_14", label: "% población 0–14 años", unit: "%" },
  { key: "pct_pob_15_64", label: "% población 15–64 años", unit: "%" },
  { key: "pct_pob_65_mas", label: "% población 65 años y más", unit: "%" },
  { key: "pct_mujeres", label: "% mujeres", unit: "%" }
] as const;

export type AnalysisMetricKey = (typeof ANALYSIS_METRICS)[number]["key"];
