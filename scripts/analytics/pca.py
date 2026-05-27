"""
PCA — Análisis de Componentes Principales Ampliado
========================================================
Integra 4 fuentes:
  1. ENDUTIH 2024          — adopción y uso digital (INEGI)
  2. Contexto socioeconómico — pobreza, bienestar, economía (CONEVAL / INEGI)
  3. Analytics estatales   — desigualdad territorial de cobertura 4G (BIT / Ookla)
  4. Cobertura de red      — velocidad, mix 3G/4G/5G (Ookla / IFT)

Agrega sobre pca.py:
  • Validación KMO + Bartlett antes de reducir
  • PCA por bloques separados (digital, socioeconómico, territorial)
  • PCA mixto con variables seleccionadas cruzadas
  • Clustering K-means (elbow silhouette k=2-6) sobre espacio PCA
  • Índice compuesto Digital-Territorial 0-100
  • Análisis de brechas: índice vs pobreza / desigualdad intraestatal
  • Detección de outliers por distancia de Mahalanobis
  • Visualizaciones en panel 3x2

Salidas en data/processed/:
  pca_scores.csv       — PC scores + cluster + índice + outlier flag
  pca_loadings.csv     — loadings bloque mixto
  pca_index.json       — índice compuesto por estado (para frontend)
  pca_analysis.png     — 6 gráficos consolidados
"""

from __future__ import annotations

import json
import warnings

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from scipy import stats
from scipy.stats import chi2

warnings.filterwarnings("ignore")

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
PUBLIC_DATA  = PROJECT_ROOT / "public" / "data"
PROCESSED    = PROJECT_ROOT / "data" / "processed"
CATALOGS     = PROJECT_ROOT / "data" / "catalogs"
OUTPUT_STATE = PUBLIC_DATA / "outputs" / "state"   # para leer univariate_stats
OUTPUT_PCA   = PUBLIC_DATA / "outputs" / "pca"     # todas las salidas del script

 
# HELPERS DE CARGA
 

def load_wide_json(path: Path) -> pd.DataFrame:
    """Lee JSON con records[{metrics:{...}}] → DataFrame indexado por estado."""
    data = json.loads(path.read_text())
    rows = []
    for r in data.get("records", []):
        row = {"cve_ent": r["cve_ent"], "estado": r["estado"]}
        row.update(r.get("metrics", {}))
        rows.append(row)
    return pd.DataFrame(rows).set_index("estado")


def load_analytics_json(path: Path) -> pd.DataFrame:
    """Lee state_analytics_dashboard.json → DataFrame indexado por estado."""
    data = json.loads(path.read_text())
    return pd.DataFrame(data["states"]).set_index("estado")


def load_cobertura_estado(path: Path, cve_to_name: dict) -> pd.DataFrame:
    """
    Lee cobertura_red_por_estado_2025.json (formato columnar pandas).
    La clave CVE_ENT se mapea a nombre de estado.
    """
    data = json.loads(path.read_text())
    df = pd.DataFrame(data).set_index("CVE_ENT")
    numeric_cols = [c for c in df.columns if c != "int_tech_predominante"]
    df = df[numeric_cols].astype(float)
    df.index = df.index.map(cve_to_name)
    df.index.name = "estado"
    return df


 
# VALIDACIÓN ESTADÍSTICA
 

def kmo_bartlett(df_std: pd.DataFrame) -> dict:
    """
    KMO y prueba de Bartlett sobre la matriz estandarizada.
    KMO > 0.6 = adecuado.  Bartlett p < 0.05 = estructura factorizable.
    """
    X = df_std.values.astype(float)
    n, p = X.shape
    corr = np.corrcoef(X.T)

    # Bartlett's test of sphericity
    det = max(float(np.linalg.det(corr)), 1e-300)
    chi_sq = -(n - 1 - (2 * p + 5) / 6) * np.log(det)
    df_b   = p * (p - 1) / 2
    p_val  = float(1.0 - chi2.cdf(chi_sq, df_b))

    # KMO (Kaiser-Meyer-Olkin)
    try:
        corr_inv = np.linalg.pinv(corr)
        d        = np.sqrt(np.diag(corr_inv))
        partial  = -(corr_inv / np.outer(d, d))
        np.fill_diagonal(partial, 0.0)
        corr_off = corr.copy()
        np.fill_diagonal(corr_off, 0.0)
        kmo = float(np.sum(corr_off**2) / (np.sum(corr_off**2) + np.sum(partial**2)))
    except Exception:
        kmo = float("nan")

    return {"kmo": kmo, "bartlett_chi2": float(chi_sq), "bartlett_p": p_val}


def mahalanobis_outliers(
    scores_df: pd.DataFrame, threshold: float = 0.95
) -> tuple[pd.Series, np.ndarray]:
    """Detecta outliers por distancia de Mahalanobis en el espacio PCA."""
    X   = scores_df.values
    cov = np.cov(X.T)
    try:
        cov_inv = np.linalg.pinv(cov)
        diff    = X - X.mean(axis=0)
        md2     = np.array([d @ cov_inv @ d for d in diff])
        cutoff  = chi2.ppf(threshold, df=scores_df.shape[1])
        flag    = pd.Series(md2 > cutoff, index=scores_df.index, name="outlier")
    except Exception:
        md2  = np.zeros(len(scores_df))
        flag = pd.Series(False, index=scores_df.index, name="outlier")
    return flag, md2


 
# SELECCIÓN DE VARIABLES
 

# ── Bloque 1: Adopción y uso digital (ENDUTIH 2024 + IFT/BIT) ──────
BLOQUE_DIGITAL = [
    "personas_usuarias_internet_pct",
    "personas_usuarias_computadora_pct",
    "personas_con_smartphone_pct",
    "personas_usan_redes_sociales_pct",
    "personas_compras_internet_pct",
    "personas_pagos_internet_pct",
    "personas_banca_electronica_pct",
    "personas_usan_banca_movil_pct",
    "teledensidad_internet_movil",
    "poblacion_en_localidades_con_4g_garantizada_pct",
    "poblacion_en_localidades_con_5g_garantizada_pct",
]

# ── Bloque 2: Bienestar social y economía (CONEVAL 2022 / INEGI) ────
# Se excluye pobreza_extrema_pct (subconjunto de pobreza_pct)
# Se excluye vulnerable_carencias_pct / no_pobre_no_vulnerable_pct (composición lineal)
# Se excluye pib_total (variable de escala → usar per_capita con log)
# Se excluye poblacion_total (tamaño, no estructura)
BLOQUE_SOCIOECO = [
    "pobreza_pct",
    "rezago_educativo_pct",
    "carencia_servicios_basicos_pct",
    "ingreso_inferior_lp_pct",
    "poblacion_afiliada_imss_pct",
    "pib_per_capita",        # log-transform
]

# ── Bloque 3: Desigualdad territorial + calidad de red (BIT / Ookla) ──
BLOQUE_TERRITORIO = [
    "gini_pob_pct_4g",
    "theil_L_pob_pct_4g",
    "p10_pob_pct_4g",
    "mean_graproes",
    "int_avg_speed",
    "int_pct_5g_coverage",
]

# ── Bloque Mixto: representación cruzada de los 3 dominios ──────────
# 15 vars / 32 obs → ratio 2.1:1, suficiente para PCA estable
BLOQUE_MIXTO = [
    # digital
    "personas_usuarias_internet_pct",
    "personas_con_smartphone_pct",
    "personas_banca_electronica_pct",
    "personas_pagos_internet_pct",
    "teledensidad_internet_movil",
    "poblacion_en_localidades_con_4g_garantizada_pct",
    "int_avg_speed",
    # socioeconómico
    "pobreza_pct",
    "rezago_educativo_pct",
    "ingreso_inferior_lp_pct",
    "poblacion_afiliada_imss_pct",
    "pib_per_capita",            # log-transform
    # territorial
    "gini_pob_pct_4g",
    "mean_graproes",
    "p10_pob_pct_4g",
]

_LOG_VARS_FALLBACK = {"pib_per_capita"}


def decide_log_transforms(univariate_stats_path: Path) -> set[str]:
    """Detecta variables que necesitan log1p a partir de estadísticas univariadas.
    Criterio: skewness > 1.5 (distribución muy sesgada) y min > 0 (condición para log).
    Fallback al conjunto hardcodeado si el archivo no existe."""
    if not univariate_stats_path.exists():
        print(f"  [!] univariate_stats.json no encontrado, usando fallback: {_LOG_VARS_FALLBACK}")
        return _LOG_VARS_FALLBACK
    stats = json.loads(univariate_stats_path.read_text(encoding="utf-8"))
    detected = {
        var_id
        for var_id, s in stats.items()
        if (s.get("skewness") or 0) > 1.5 and (s.get("min") or 0) > 0
    }
    if detected != _LOG_VARS_FALLBACK:
        print(f"  [i] Variables con log-transform detectadas: {detected}")
    return detected if detected else _LOG_VARS_FALLBACK


LOG_VARS = decide_log_transforms(OUTPUT_STATE / "univariate_stats.json")


def _p5p95_scale(X: pd.DataFrame) -> pd.DataFrame:
    """Clip a [P5, P95] y escala a [0, 1]. Robusto a outliers extremos."""
    result = X.copy().astype(float)
    for col in result.columns:
        p5, p95 = result[col].quantile(0.05), result[col].quantile(0.95)
        clipped = result[col].clip(p5, p95)
        rng = p95 - p5
        result[col] = (clipped - p5) / rng if rng > 0 else 0.0
    return result


def prepare_block(df: pd.DataFrame, cols: list, name: str) -> pd.DataFrame:
    """Filtra columnas, aplica log-transform donde corresponde y normaliza P5-P95."""
    available = [c for c in cols if c in df.columns]
    missing   = set(cols) - set(available)
    if missing:
        print(f"  [!] {name}: no encontradas → {missing}")
    X = df[available].copy()
    for col in LOG_VARS:
        if col in X.columns:
            X[col] = np.log1p(X[col])
    return _p5p95_scale(X)


 
# 1. CARGA Y CRUCE DE FUENTES
 

print("=" * 65)
print("1. CARGANDO Y CRUZANDO FUENTES")
print("=" * 65)

states_data  = json.loads((CATALOGS / "states.master.json").read_text())
cve_to_estado = {s["cve_ent"]: s["estado"] for s in states_data["states"]}

df_endutih   = load_wide_json(PROCESSED / "endutih_2024_state_dashboard.wide.json")
df_context   = load_wide_json(PROCESSED / "context_variables_state_dashboard.wide.json")
df_analytics = load_analytics_json(PROCESSED / "state_analytics_dashboard.json")
df_cobertura = load_cobertura_estado(
    PROCESSED / "cobertura_red_por_estado_2025.json", cve_to_estado
)

for nombre, df_ in [
    ("ENDUTIH",    df_endutih),
    ("Contexto",   df_context),
    ("Analytics",  df_analytics),
    ("Cobertura",  df_cobertura),
]:
    print(f"  {nombre:12s}: {df_.shape[0]} estados, {df_.shape[1]} columnas")

common = sorted(
    set(df_endutih.index)
    & set(df_context.index)
    & set(df_analytics.index)
    & set(df_cobertura.index)
)
print(f"\n  Estados en común: {len(common)}")

df_all = (
    df_endutih.loc[common]
    .join(df_context.loc[common],   lsuffix="",     rsuffix="_ctx")
    .join(df_analytics.loc[common], lsuffix="",     rsuffix="_anl")
    .join(df_cobertura.loc[common], lsuffix="",     rsuffix="_cob")
)
print(f"  Matriz consolidada: {df_all.shape}\n")


 
# 2. VALIDACIÓN KMO + BARTLETT (bloque mixto)
 

print("=" * 65)
print("2. VALIDACIÓN ESTADÍSTICA (KMO + Bartlett) — bloque mixto")
print("=" * 65)

X_mixto_std   = prepare_block(df_all, BLOQUE_MIXTO, "MIXTO")
results_stat  = kmo_bartlett(X_mixto_std)

kmo_val   = results_stat["kmo"]
kmo_label = (
    "Muy adecuado" if kmo_val >= 0.80 else
    "Adecuado"     if kmo_val >= 0.60 else
    "Regular"      if kmo_val >= 0.50 else "Inadecuado"
)

print(f"  KMO:       {kmo_val:.4f}  → {kmo_label}")
print(f"  Bartlett:  χ²={results_stat['bartlett_chi2']:.2f}, "
      f"p={results_stat['bartlett_p']:.2e}")
print(
    f"  {'✓ PCA estadísticamente apropiado' if results_stat['bartlett_p'] < 0.05 else '⚠ p > 0.05: revisar supuestos'}\n"
)


 
# 3. PCA POR BLOQUES
 

print("=" * 65)
print("3. PCA POR BLOQUES")
print("=" * 65)

block_results: dict = {}

for nombre, cols in [
    ("Digital",        BLOQUE_DIGITAL),
    ("Socioeconómico", BLOQUE_SOCIOECO),
    ("Territorial",    BLOQUE_TERRITORIO),
    ("Mixto",          BLOQUE_MIXTO),
]:
    X_std  = prepare_block(df_all, cols, nombre)
    avail  = X_std.columns.tolist()
    n_comp = min(3, len(avail))

    pca_full = PCA().fit(X_std)
    cumvar   = np.cumsum(pca_full.explained_variance_ratio_)
    n_80     = int(np.argmax(cumvar >= 0.80)) + 1
    n_90     = int(np.argmax(cumvar >= 0.90)) + 1

    pca_3    = PCA(n_components=n_comp).fit(X_std)
    scores   = pca_3.transform(X_std)

    scores_df = pd.DataFrame(
        scores, index=X_std.index,
        columns=[f"PC{i+1}" for i in range(n_comp)],
    )
    loadings  = pca_3.components_.T * np.sqrt(pca_3.explained_variance_)
    load_df   = pd.DataFrame(
        loadings, index=avail,
        columns=[f"PC{i+1}" for i in range(n_comp)],
    )

    block_results[nombre] = {
        "pca": pca_3, "pca_full": pca_full,
        "scores": scores_df, "loadings": load_df,
        "vars": avail, "n_80": n_80, "n_90": n_90,
        "cumvar": cumvar,
    }

    var3 = pca_3.explained_variance_ratio_.sum()
    pcs  = pca_3.explained_variance_ratio_
    top3 = load_df["PC1"].abs().nlargest(3).index.tolist()

    print(f"\n  [{nombre}] {len(avail)} vars → PC1-PC3 = {var3:.1%}")
    print(f"    80%: {n_80} comp | 90%: {n_90} comp")
    print(f"    PC1: {pcs[0]:.1%} | PC2: {pcs[1]:.1%}" +
          (f" | PC3: {pcs[2]:.1%}" if n_comp >= 3 else ""))
    print(f"    Top-3 cargadores PC1: {', '.join(top3)}")


 
# 4. CLUSTERING K-MEANS EN ESPACIO MIXTO
 

print("\n" + "=" * 65)
print("4. CLUSTERING K-MEANS (espacio PCA mixto, k=2..6)")
print("=" * 65)

scores_mixto  = block_results["Mixto"]["scores"].copy()
k_range       = range(2, 7)
inertias, sil = [], []

for k in k_range:
    km  = KMeans(n_clusters=k, random_state=42, n_init=20)
    lbl = km.fit_predict(scores_mixto)
    inertias.append(km.inertia_)
    sil.append(silhouette_score(scores_mixto, lbl))

best_k = max(3, k_range.start + int(np.argmax(sil)))
print(f"  Silhouette: { {k: round(s, 3) for k, s in zip(k_range, sil)} }")
print(f"  Mejor k = {best_k}  (silhouette = {max(sil):.3f})\n")

km_final      = KMeans(n_clusters=best_k, random_state=42, n_init=20)
cluster_ids   = km_final.fit_predict(scores_mixto)
scores_mixto["cluster"] = cluster_ids

# Nombrar clusters por nivel de PC1 medio (mayor → más avanzado)
pc1_mean_by_cluster = (
    scores_mixto.groupby("cluster")["PC1"].mean()
    .sort_values(ascending=False)
)
NIVEL_LABELS = ["Avanzado", "Intermedio-Alto", "Intermedio-Bajo",
                "Rezagado", "Crítico"]
cluster_names = {
    c: f"Cluster {i+1}: {NIVEL_LABELS[min(i, len(NIVEL_LABELS)-1)]}"
    for i, c in enumerate(pc1_mean_by_cluster.index)
}
scores_mixto["perfil"] = scores_mixto["cluster"].map(cluster_names)

print("  Composición:")
for cid, cname in cluster_names.items():
    estados_c = scores_mixto[scores_mixto["cluster"] == cid].index.tolist()
    print(f"    {cname}")
    print(f"      → {', '.join(estados_c)}")


 
# 5. ÍNDICE COMPUESTO 0-100
 

print("\n" + "=" * 65)
print("5. ÍNDICE COMPUESTO DIGITAL-TERRITORIAL  (0 – 100)")
print("=" * 65)

pca_mixto = block_results["Mixto"]["pca"]
w1  = pca_mixto.explained_variance_ratio_[0]
w2  = pca_mixto.explained_variance_ratio_[1]

# Índice = combinación ponderada PC1 y PC2 (peso proporcional a varianza)
composite_raw = (w1 * scores_mixto["PC1"] + w2 * scores_mixto["PC2"]) / (w1 + w2)
mn, mx        = composite_raw.min(), composite_raw.max()
index_0_100   = ((composite_raw - mn) / (mx - mn) * 100).round(2)

ranking   = index_0_100.sort_values(ascending=False)
rank_nums = index_0_100.rank(ascending=False).astype(int)

print(f"\n  {'#':>3}  {'Estado':<25} {'Índice':>7}   Perfil")
print("  " + "-" * 60)
for rank, estado in enumerate(ranking.index, 1):
    perfil = scores_mixto.loc[estado, "perfil"]
    marker = "  ←brecha" if rank > len(ranking) - 6 else ""
    print(f"  {rank:>3}. {estado:<25} {ranking[estado]:>6.1f}   {perfil}{marker}")


 
# 6. ANÁLISIS DE BRECHAS
 

print("\n" + "=" * 65)
print("6. ANÁLISIS DE BRECHAS")
print("=" * 65)

df_brechas = pd.DataFrame({
    "indice_digital":   index_0_100,
    "pobreza_pct":      df_all["pobreza_pct"],
    "gini_cobertura":   df_all["gini_pob_pct_4g"],
    "rezago_educativo": df_all["rezago_educativo_pct"],
    "p10_cobertura_4g": df_all["p10_pob_pct_4g"],
}).dropna()

r_pob, p_pob = stats.pearsonr(df_brechas["indice_digital"], df_brechas["pobreza_pct"])
r_gin, p_gin = stats.pearsonr(df_brechas["indice_digital"], df_brechas["gini_cobertura"])
r_rez, p_rez = stats.pearsonr(df_brechas["indice_digital"], df_brechas["rezago_educativo"])

print(f"  Índice vs Pobreza:         r = {r_pob:+.3f}  (p={p_pob:.2e})")
print(f"  Índice vs Gini cobertura:  r = {r_gin:+.3f}  (p={p_gin:.2e})")
print(f"  Índice vs Rezago educativo:r = {r_rez:+.3f}  (p={p_rez:.2e})")

# Cuadrante de brecha crítica
idx_med = df_brechas["indice_digital"].median()
pob_med = df_brechas["pobreza_pct"].median()
criticos = df_brechas[
    (df_brechas["indice_digital"] < idx_med) &
    (df_brechas["pobreza_pct"]    > pob_med)
].index.tolist()
print(f"\n  Estados con brecha crítica (bajo índice + alta pobreza):")
print(f"  {', '.join(criticos)}")


 
# 7. DETECCIÓN DE OUTLIERS (Mahalanobis)
 

print("\n" + "=" * 65)
print("7. OUTLIERS — Distancia de Mahalanobis (umbral χ² p=0.95)")
print("=" * 65)

pc_cols      = [c for c in scores_mixto.columns if c.startswith("PC")]
outlier_flag, md2_vals = mahalanobis_outliers(scores_mixto[pc_cols])
outliers     = outlier_flag[outlier_flag].index.tolist()
md2_series   = pd.Series(md2_vals, index=scores_mixto.index, name="mahalanobis_d2")

print(f"  Outliers ({len(outliers)}): {', '.join(outliers) if outliers else 'Ninguno'}")
print(f"\n  Top-5 distancias:")
for est in md2_series.nlargest(5).index:
    print(f"    {est:<25}  D² = {md2_series[est]:.2f}"
          + (" ← OUTLIER" if outlier_flag[est] else ""))


 
# 8. GUARDAR RESULTADOS
 

print("\n" + "=" * 65)
print("8. GUARDANDO ARCHIVOS")
print("=" * 65)

OUTPUT_PCA.mkdir(parents=True, exist_ok=True)

# pca_scores.csv
scores_out = scores_mixto.copy()
scores_out["indice_digital"]  = index_0_100
scores_out["ranking"]         = rank_nums
scores_out["mahalanobis_d2"]  = md2_series
scores_out["es_outlier"]      = outlier_flag
scores_out.to_csv(OUTPUT_PCA / "pca_scores.csv")
print("  ✓ pca_scores.csv")

# pca_loadings.csv
load_df_mixto = block_results["Mixto"]["loadings"]
load_df_mixto.to_csv(OUTPUT_PCA / "pca_loadings.csv")
print("  ✓ pca_loadings.csv")

# pca_results.json → public/data/outputs/pca/ (para el frontend)
pca_results = {
    "updated_at": "2026-05-20",
    "description": "Índice Digital-Territorial PCA mixto (0=mín, 100=máx)",
    "sources": ["INEGI ENDUTIH 2024", "CONEVAL 2022 / INEGI PIBE 2024", "BIT / IFT / Ookla 2025"],
    "kmo": round(kmo_val, 4),
    "bartlett_p": float(results_stat["bartlett_p"]),
    "n_clusters": best_k,
    "variance_explained": [round(float(w1), 4), round(float(w2), 4)],
    "loadings": {
        "variables": load_df_mixto.index.tolist(),
        "pc1": load_df_mixto["PC1"].round(4).tolist(),
        "pc2": load_df_mixto["PC2"].round(4).tolist(),
    },
    "records": [
        {
            "state":         estado,
            "index":         float(index_0_100[estado]),
            "ranking":       int(rank_nums[estado]),
            "cluster":       int(scores_mixto.loc[estado, "cluster"]),
            "cluster_label": scores_mixto.loc[estado, "perfil"],
            "pc1":           round(float(scores_mixto.loc[estado, "PC1"]), 4),
            "pc2":           round(float(scores_mixto.loc[estado, "PC2"]), 4),
            "is_outlier":    bool(outlier_flag[estado]),
        }
        for estado in sorted(index_0_100.index)
    ],
    "cluster_stats": {
        str(cid): {
            "label":      cluster_names[cid],
            "states":     scores_mixto[scores_mixto["cluster"] == cid].index.tolist(),
            "mean_index": round(float(index_0_100[scores_mixto["cluster"] == cid].mean()), 2),
        }
        for cid in sorted(cluster_names.keys())
    },
}
(OUTPUT_PCA / "pca_results.json").write_text(
    json.dumps(pca_results, ensure_ascii=False, indent=2), encoding="utf-8"
)
print("  ✓ pca_results.json")


 
# 9. VISUALIZACIONES (panel 3×2)

print("\n  Generando visualizaciones...")

CLUSTER_COLORS = ["#1565C0", "#2E7D32", "#F57F17", "#B71C1C", "#6A1B9A"]
color_map = {
    c: CLUSTER_COLORS[i % len(CLUSTER_COLORS)]
    for i, c in enumerate(sorted(scores_mixto["cluster"].unique()))
}
state_c = scores_mixto["cluster"].map(color_map)

fig = plt.figure(figsize=(20, 15))
fig.suptitle(
    "PCA: Análisis Digital-Territorial — México 2024/2025\n"
    f"({len(BLOQUE_MIXTO)} variables | {len(common)} estados | "
    f"KMO={kmo_val:.3f} | k={best_k} clusters)",
    fontsize=13, fontweight="bold", y=0.99,
)

# ── Panel 1: Scree plot comparativo ────────────────────────────────
ax1 = fig.add_subplot(3, 2, 1)
styles = ["-o", "--s", "-.^", ":D"]
for (nombre, res), sty in zip(block_results.items(), styles):
    cv  = res["cumvar"]
    n_s = min(8, len(cv))
    ax1.plot(range(1, n_s + 1), cv[:n_s], sty, label=nombre, linewidth=2, markersize=5)
ax1.axhline(0.80, color="gray", linestyle="--", linewidth=1, alpha=0.6)
ax1.axhline(0.90, color="gray", linestyle=":",  linewidth=1, alpha=0.6)
ax1.text(6.5, 0.81, "80%", color="gray", fontsize=8)
ax1.text(6.5, 0.91, "90%", color="gray", fontsize=8)
ax1.set_xlabel("Componentes")
ax1.set_ylabel("Varianza acumulada")
ax1.set_title("Scree: Varianza acumulada por bloque")
ax1.legend(fontsize=8)
ax1.grid(True, alpha=0.3)
ax1.set_ylim(0, 1.05)

# ── Panel 2: Biplot PC1 vs PC2 con clusters ─────────────────────────
ax2 = fig.add_subplot(3, 2, 2)
for cid in sorted(scores_mixto["cluster"].unique()):
    mask   = scores_mixto["cluster"] == cid
    subset = scores_mixto[mask]
    ax2.scatter(
        subset["PC1"], subset["PC2"],
        color=color_map[cid], s=90, alpha=0.85,
        label=cluster_names[cid], zorder=3,
    )
for estado in scores_mixto.index:
    ax2.annotate(
        estado[:4],
        (scores_mixto.loc[estado, "PC1"], scores_mixto.loc[estado, "PC2"]),
        fontsize=7, alpha=0.8, xytext=(3, 3), textcoords="offset points",
    )
# Marcar outliers con círculo rojo
for estado in outliers:
    ax2.scatter(
        scores_mixto.loc[estado, "PC1"], scores_mixto.loc[estado, "PC2"],
        s=220, facecolors="none", edgecolors="red", linewidths=2, zorder=4,
    )
# Flechas de loadings (top 7 por magnitud en PC1)
load_df   = block_results["Mixto"]["loadings"]
top_vars  = load_df["PC1"].abs().nlargest(7).index
for var in top_vars:
    lx, ly = load_df.loc[var, "PC1"] * 3.5, load_df.loc[var, "PC2"] * 3.5
    ax2.annotate(
        "", xy=(lx, ly), xytext=(0, 0),
        arrowprops=dict(arrowstyle="->", color="tomato", lw=1.3, alpha=0.7),
    )
    ax2.text(lx * 1.08, ly * 1.08,
             var.replace("personas_", "").replace("_pct", "")[:15],
             fontsize=6.5, color="tomato", alpha=0.85)

pcs_m = pca_mixto.explained_variance_ratio_
ax2.set_xlabel(f"PC1 ({pcs_m[0]:.1%})")
ax2.set_ylabel(f"PC2 ({pcs_m[1]:.1%})")
ax2.set_title("Biplot PC1-PC2: clusters + loadings\n(círculo rojo = outlier Mahalanobis)")
ax2.legend(fontsize=7, loc="lower right")
ax2.grid(True, alpha=0.3)
ax2.axhline(0, color="k", lw=0.5)
ax2.axvline(0, color="k", lw=0.5)

# ── Panel 3: Ranking índice compuesto ───────────────────────────────
ax3 = fig.add_subplot(3, 2, 3)
rank_sorted = index_0_100.sort_values()
bar_c       = [color_map[scores_mixto.loc[e, "cluster"]] for e in rank_sorted.index]
bars        = ax3.barh(
    rank_sorted.index, rank_sorted.values,
    color=bar_c, edgecolor="white", height=0.75,
)
for bar, val in zip(bars, rank_sorted.values):
    ax3.text(val + 0.8, bar.get_y() + bar.get_height() / 2,
             f"{val:.0f}", va="center", fontsize=7)
ax3.set_xlabel("Índice Digital-Territorial (0-100)")
ax3.set_title("Ranking por estado\n(color = cluster)")
ax3.set_xlim(0, 115)
ax3.tick_params(axis="y", labelsize=7.5)
ax3.grid(True, alpha=0.3, axis="x")

# ── Panel 4: Heatmap loadings bloque mixto ──────────────────────────
ax4 = fig.add_subplot(3, 2, 4)
load_sorted = load_df.reindex(
    load_df.abs().sum(axis=1).sort_values(ascending=False).index
)
ylabels = [
    v.replace("personas_", "")
     .replace("_pct", "")
     .replace("_", " ")[:22]
    for v in load_sorted.index
]
sns.heatmap(
    load_sorted, annot=True, fmt=".2f",
    cmap="RdBu_r", center=0, ax=ax4,
    yticklabels=ylabels,
    cbar_kws={"label": "Loading", "shrink": 0.8},
    annot_kws={"size": 8},
)
ax4.set_title("Loadings PCA Mixto\n(variables ordenadas por magnitud)")
ax4.tick_params(axis="y", labelsize=8)

# ── Panel 5: Brecha — Índice vs Pobreza ─────────────────────────────
ax5 = fig.add_subplot(3, 2, 5)
for estado in df_brechas.index:
    c = color_map.get(scores_mixto.loc[estado, "cluster"] if estado in scores_mixto.index else 0, "gray")
    ax5.scatter(
        df_brechas.loc[estado, "indice_digital"],
        df_brechas.loc[estado, "pobreza_pct"],
        color=c, s=75, alpha=0.85, zorder=3,
    )
    ax5.annotate(
        estado[:4],
        (df_brechas.loc[estado, "indice_digital"], df_brechas.loc[estado, "pobreza_pct"]),
        fontsize=7, alpha=0.75, xytext=(3, 2), textcoords="offset points",
    )
# Línea de regresión
m, b    = np.polyfit(df_brechas["indice_digital"], df_brechas["pobreza_pct"], 1)
x_line  = np.linspace(df_brechas["indice_digital"].min(), df_brechas["indice_digital"].max(), 100)
ax5.plot(x_line, m * x_line + b, "k--", lw=1.5, alpha=0.5, label=f"r={r_pob:.2f}")
ax5.axhline(pob_med, color="gray", ls=":", alpha=0.5)
ax5.axvline(idx_med, color="gray", ls=":", alpha=0.5)
ax5.fill_between(
    [df_brechas["indice_digital"].min(), idx_med],
    [pob_med, pob_med], [df_brechas["pobreza_pct"].max() * 1.05] * 2,
    color="red", alpha=0.05,
)
ax5.text(
    df_brechas["indice_digital"].min() + 1,
    df_brechas["pobreza_pct"].max() * 0.97,
    "Brecha crítica", fontsize=8, color="red", alpha=0.7,
)
ax5.set_xlabel("Índice Digital-Territorial (0-100)")
ax5.set_ylabel("Población en pobreza (%)")
ax5.set_title(f"Brecha digital vs Pobreza\n(r={r_pob:.3f}, p={p_pob:.2e})")
ax5.legend(fontsize=8)
ax5.grid(True, alpha=0.3)

# ── Panel 6: Desigualdad territorial (Gini vs P10 cobertura 4G) ────
ax6 = fig.add_subplot(3, 2, 6)
for estado in df_brechas.index:
    c = color_map.get(scores_mixto.loc[estado, "cluster"] if estado in scores_mixto.index else 0, "gray")
    ax6.scatter(
        df_brechas.loc[estado, "gini_cobertura"],
        df_brechas.loc[estado, "p10_cobertura_4g"],
        color=c, s=75, alpha=0.85, zorder=3,
    )
    ax6.annotate(
        estado[:4],
        (df_brechas.loc[estado, "gini_cobertura"], df_brechas.loc[estado, "p10_cobertura_4g"]),
        fontsize=7, alpha=0.75, xytext=(3, 2), textcoords="offset points",
    )
# Anotar estados con alta desigualdad intraestatal (Gini > Q75)
gini_q75 = df_brechas["gini_cobertura"].quantile(0.75)
for estado in df_brechas[df_brechas["gini_cobertura"] > gini_q75].index:
    ax6.annotate(
        f" {estado[:8]}",
        (df_brechas.loc[estado, "gini_cobertura"], df_brechas.loc[estado, "p10_cobertura_4g"]),
        fontsize=7, color="darkred", alpha=0.85,
    )
ax6.set_xlabel("Gini cobertura 4G intraestatal (desigualdad)")
ax6.set_ylabel("P10 cobertura poblacional 4G (%)\n(cobertura del décil más bajo)")
ax6.set_title("Desigualdad territorial de conectividad\n(alto Gini + bajo P10 = rezago intraestatal)")
ax6.grid(True, alpha=0.3)

plt.tight_layout()
plt.savefig(OUTPUT_PCA / "pca_analysis.png", dpi=200, bbox_inches="tight")
print("  ✓ pca_analysis.png")

# ── Resumen final ────────────────────────────────────────────────────
print("\n" + "=" * 65)
print("✓  PCA COMPLETADO")
print("=" * 65)

archivos = [
    "pca_scores.csv",
    "pca_loadings.csv",
    "pca_index.json",
    "pca_analysis.png",
]
print(f"\nArchivos en {PROCESSED.relative_to(PROJECT_ROOT)}:")
for fn in archivos:
    p = PROCESSED / fn
    if p.exists():
        kb = p.stat().st_size / 1024
        print(f"  {fn:<38} {kb:>7.1f} KB")
