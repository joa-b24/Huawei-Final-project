export type RfFeatureImportance = {
  key: string;
  label: string;
  importance: number;
};

export type StateAnalyticsNational = {
  gini_pob_pct_4g: number;
  gini_pob_pct_3g?: number;
  theil_L_pob_pct_4g: number;
  spearman_graproes_vs_pob_4g: number;
  spearman_pct_mujeres_vs_pob_4g?: number;
  spearman_pct_pob_65_mas_vs_pob_4g?: number;
  spearman_pct_pob_0_14_vs_pob_4g?: number;
  kmeans_k: number;
  kmeans_silhouette: number;
  n_municipios_modelados: number;
  n_municipios_en_clustering: number;
  connectivity_year: string;
  cluster_labels: Record<string, string>;
  rf_feature_importances?: RfFeatureImportance[];
};

export type StateAnalyticsRow = {
  cve_ent: string;
  state_code: string;
  estado: string;
  region: string;
  n_municipios: number;
  gini_pob_pct_4g: number;
  theil_L_pob_pct_4g: number;
  p90_pob_pct_4g: number;
  p10_pob_pct_4g: number;
  mean_graproes: number;
  mean_pob_pct_4g: number;
  mean_pct_mujeres?: number;
  spearman_graproes_vs_pob_4g: number;
  spearman_pct_mujeres_vs_pob_4g?: number;
  spearman_pct_pob_65_mas_vs_pob_4g?: number;
  spearman_pct_pob_0_14_vs_pob_4g?: number;
  ookla_municipios_cubiertos: number;
  rf_feature_importances?: RfFeatureImportance[];
};

export type StateAnalyticsPayload = {
  updated_at: string;
  schema_version: string;
  dataset_id: string;
  national: StateAnalyticsNational;
  states: StateAnalyticsRow[];
};

export type MunicipioAnalyticsRecord = {
  cvegeo: string;
  cve_ent: string;
  nom_ent: string;
  nom_mun: string;
  pobtot_iter: number;
  graproes: number;
  pct_sin_escolaridad_15ymas?: number;
  pct_posbasica_18ymas?: number;
  pct_pob_0_14: number;
  pct_pob_15_64: number;
  pct_pob_65_mas: number;
  pct_mujeres?: number;
  pct_hombres?: number;
  indice_masculinidad?: number;
  pob_pct_4g_garantizada: number;
  loc_pct_4g_garantizada: number;
  brecha_4g_pp?: number;
  cluster_id?: number | null;
  cluster_label?: string;
  irs_indice?: number;
  rf_4g_esperada?: number;
  rf_brecha_4g_pp?: number;
  rf_factor_principal?: string;
};
