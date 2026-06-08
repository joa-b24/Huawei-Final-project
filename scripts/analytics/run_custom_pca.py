"""
run_custom_pca.py — Ejecutor genérico de PCA personalizado
===========================================================
Lee un archivo JSON de configuración y produce:
  public/data/outputs/pca/<id>/pca_results.json
  public/data/outputs/pca/<id>/pca_loadings.csv
  public/data/outputs/pca/<id>/pca_scores.csv

Actualiza public/data/outputs/pca/manifest.json al terminar.

Uso:
  python scripts/analytics/run_custom_pca.py <config_path.json>

Esquema del config JSON:
  {
    "id": "slug-unico",
    "name": "Nombre del análisis",
    "index_name": "Nombre del índice",
    "variables": ["var1", "var2", ...],
    "n_clusters": 4,          // 0 = auto-detect (elbow + silhouette)
    "normalize": true
  }
"""

from __future__ import annotations

import json
import sys
import warnings
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats
from scipy.stats import chi2
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler

warnings.filterwarnings("ignore")

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
PUBLIC_DATA  = PROJECT_ROOT / "public" / "data"
OUTPUT_PCA   = PUBLIC_DATA / "outputs" / "pca"
UNIVARIATE   = PUBLIC_DATA / "outputs" / "state" / "univariate_stats.json"
COMBINED_CSV = PUBLIC_DATA / "outputs" / "state" / "combined_data.csv"
CATALOG_PATH = PROJECT_ROOT / "data" / "catalogs" / "variables.catalog.json"


def load_polaridades() -> dict[str, int]:
    """Devuelve {variable_id: +1 si higher_better, -1 si lower_better}."""
    try:
        cat = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
        result = {}
        for v in cat.get("variables", []):
            vid = v.get("variable_id", "")
            pol = v.get("polaridad", "higher_better")
            result[vid] = -1 if pol == "lower_better" else 1
        return result
    except Exception:
        return {}


# ── Helpers estadísticos (copiados de pca.py para independencia) ───────────────

def kmo_bartlett(X: np.ndarray) -> dict:
    n, p = X.shape
    corr = np.corrcoef(X.T)
    det  = max(float(np.linalg.det(corr)), 1e-300)
    chi_sq = -(n - 1 - (2 * p + 5) / 6) * np.log(det)
    df_b   = p * (p - 1) / 2
    p_val  = float(1.0 - chi2.cdf(chi_sq, df_b))
    try:
        corr_inv = np.linalg.pinv(corr)
        d        = np.sqrt(np.diag(corr_inv))
        partial  = -(corr_inv / np.outer(d, d))
        np.fill_diagonal(partial, 0.0)
        corr_off = corr.copy(); np.fill_diagonal(corr_off, 0.0)
        kmo = float(np.sum(corr_off**2) / (np.sum(corr_off**2) + np.sum(partial**2)))
    except Exception:
        kmo = float("nan")
    return {"kmo": kmo, "bartlett_chi2": float(chi_sq), "bartlett_p": p_val}


def mahalanobis_outliers(scores: np.ndarray, index: pd.Index, threshold: float = 0.95):
    try:
        cov     = np.cov(scores.T)
        cov_inv = np.linalg.pinv(cov)
        diff    = scores - scores.mean(axis=0)
        md2     = np.array([d @ cov_inv @ d for d in diff])
        cutoff  = chi2.ppf(threshold, df=scores.shape[1])
        flag    = pd.Series(md2 > cutoff, index=index)
    except Exception:
        flag = pd.Series(False, index=index)
    return flag


def best_k(X: np.ndarray, k_range=range(2, 7)) -> int:
    best_sil, best_k = -1.0, 2
    for k in k_range:
        if k >= len(X):
            break
        labels = KMeans(n_clusters=k, random_state=42, n_init=10).fit_predict(X)
        sil    = silhouette_score(X, labels)
        if sil > best_sil:
            best_sil, best_k = sil, k
    return best_k


def label_cluster(cluster_id: int, n: int, mean_idx: float) -> str:
    tier = "Alto" if mean_idx >= 65 else "Medio-alto" if mean_idx >= 50 else "Medio" if mean_idx >= 35 else "Bajo"
    return f"{tier} ({cluster_id + 1})"


# ── Carga de datos ─────────────────────────────────────────────────────────────

def load_wide_data(variables: list[str]) -> pd.DataFrame:
    """Lee combined_data.csv y devuelve un DataFrame wide con las variables pedidas."""
    df = pd.read_csv(COMBINED_CSV, encoding="utf-8")
    if "estado" not in df.columns or "state_code" not in df.columns:
        raise ValueError("combined_data.csv debe tener columnas 'estado' y 'state_code'")

    # Mantener una fila por estado (tomar la primera si hay duplicados)
    df = df.drop_duplicates("estado").set_index("estado")

    missing = [v for v in variables if v not in df.columns]
    if missing:
        raise ValueError(f"Variables no encontradas en combined_data.csv: {missing}")

    return df[variables].dropna()


# ── Pipeline principal ─────────────────────────────────────────────────────────

def run(config: dict) -> None:
    analysis_id   = config["id"]
    analysis_name = config.get("name", analysis_id)
    index_name    = config.get("index_name", "Índice PCA")
    variables     = config["variables"]
    n_clusters_cfg = int(config.get("n_clusters", 0))
    normalize     = bool(config.get("normalize", True))

    if len(variables) < 3:
        raise ValueError("Se necesitan al menos 3 variables para PCA.")

    print(f"[run_custom_pca] Análisis: {analysis_name}  ({len(variables)} variables)")

    # 1. Cargar datos
    df_raw = load_wide_data(variables)
    states = df_raw.index.tolist()
    X      = df_raw.values.astype(float)
    print(f"  Estados con datos completos: {len(states)}")

    # 2. Log-transform para variables con sesgo positivo extremo
    for i, var in enumerate(variables):
        col = X[:, i]
        sk  = float(stats.skew(col))
        if sk > 1.5 and col.min() > 0:
            X[:, i] = np.log1p(col)

    # 3. Estandarizar
    if normalize:
        scaler = StandardScaler()
        X_std  = scaler.fit_transform(X)
    else:
        X_std = X.copy()

    # 4. Validación KMO + Bartlett
    stat_vals = kmo_bartlett(X_std)
    print(f"  KMO={stat_vals['kmo']:.3f}  Bartlett p={stat_vals['bartlett_p']:.4f}")

    # 5. PCA (2 componentes para el scatter)
    pca  = PCA(n_components=min(2, len(variables)), random_state=42)
    scores = pca.fit_transform(X_std)
    var_exp = pca.explained_variance_ratio_
    loadings_pc1 = pca.components_[0].tolist()
    loadings_pc2 = pca.components_[1].tolist() if pca.n_components_ > 1 else [0.0] * len(variables)

    # Orientación: PC1 positivo → "mejor" según polaridad de cada variable.
    # Para cada variable: loading * signo_polaridad. Si el voto neto es negativo, invertir.
    polaridades = load_polaridades()
    direction_signs = np.array([polaridades.get(v, 1) for v in variables], dtype=float)
    net_vote = float(np.dot(np.array(loadings_pc1), direction_signs))
    print(f"  Orientación PC1 — voto neto polaridad: {net_vote:+.3f} {'(invertido)' if net_vote < 0 else '(directo)'}")
    if net_vote < 0:
        scores[:, 0]  *= -1
        loadings_pc1   = [-v for v in loadings_pc1]

    # 6. Índice 0-100 desde PC1
    pc1_raw = scores[:, 0]
    mn, mx  = pc1_raw.min(), pc1_raw.max()
    index_vals = ((pc1_raw - mn) / (mx - mn) * 100).tolist() if mx > mn else [50.0] * len(states)

    # 7. Clustering
    n_k = n_clusters_cfg if n_clusters_cfg >= 2 else best_k(scores)
    n_k = min(n_k, len(states) - 1)
    km  = KMeans(n_clusters=n_k, random_state=42, n_init=10)
    labels = km.fit_predict(scores).tolist()
    print(f"  Clusters: {n_k}")

    # 8. Outliers
    outlier_flags = mahalanobis_outliers(scores, pd.Index(states))

    # 9. Ranking por índice
    idx_series = pd.Series(dict(zip(states, index_vals))).sort_values(ascending=False)
    rankings   = {s: r + 1 for r, s in enumerate(idx_series.index)}

    # 10. Estadísticas por cluster
    cluster_stats: dict[str, dict] = {}
    for k in range(n_k):
        members = [s for s, c in zip(states, labels) if c == k]
        mean_idx = float(np.mean([index_vals[states.index(s)] for s in members]))
        cluster_stats[str(k)] = {
            "label": label_cluster(k, n_k, mean_idx),
            "states": members,
            "mean_index": round(mean_idx, 2),
        }

    # 11. Records
    records = []
    for i, state in enumerate(states):
        records.append({
            "state":         state,
            "index":         round(index_vals[i], 2),
            "ranking":       rankings[state],
            "cluster":       labels[i],
            "cluster_label": cluster_stats[str(labels[i])]["label"],
            "pc1":           round(float(scores[i, 0]), 4),
            "pc2":           round(float(scores[i, 1]) if scores.shape[1] > 1 else 0.0, 4),
            "is_outlier":    bool(outlier_flags[state]),
        })

    # 12. Output dir
    out_dir = OUTPUT_PCA / analysis_id
    out_dir.mkdir(parents=True, exist_ok=True)

    # 13. pca_results.json
    pca_results = {
        "analysis_id":   analysis_id,
        "analysis_name": analysis_name,
        "index_name":    index_name,
        "updated_at":    date.today().isoformat(),
        "kmo":           round(stat_vals["kmo"], 4),
        "bartlett_p":    round(stat_vals["bartlett_p"], 6),
        "n_clusters":    n_k,
        "variance_explained": [round(float(v), 4) for v in var_exp[:2]],
        "loadings": {
            "variables": variables,
            "pc1":       [round(v, 4) for v in loadings_pc1],
            "pc2":       [round(v, 4) for v in loadings_pc2],
        },
        "records":       records,
        "cluster_stats": cluster_stats,
    }
    (out_dir / "pca_results.json").write_text(
        json.dumps(pca_results, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    # 14. pca_loadings.csv
    loadings_df = pd.DataFrame({
        "variable": variables,
        "pc1":      loadings_pc1,
        "pc2":      loadings_pc2,
    })
    loadings_df.to_csv(out_dir / "pca_loadings.csv", index=False, encoding="utf-8")

    # 15. pca_scores.csv
    scores_df = pd.DataFrame({
        "estado":    states,
        "pc1":       scores[:, 0].tolist(),
        "pc2":       (scores[:, 1].tolist() if scores.shape[1] > 1 else [0.0] * len(states)),
        "index":     index_vals,
        "cluster":   labels,
        "is_outlier": outlier_flags.tolist(),
    })
    scores_df.to_csv(out_dir / "pca_scores.csv", index=False, encoding="utf-8")

    # 16. Actualizar manifest.json
    manifest_path = OUTPUT_PCA / "manifest.json"
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    else:
        manifest = {"active": analysis_id, "analyses": []}

    # Reemplazar o agregar entrada
    entry = {
        "id":         analysis_id,
        "name":       analysis_name,
        "index_name": index_name,
        "created_at": date.today().isoformat(),
        "variables":  variables,
        "n_clusters": n_k,
        "normalize":  normalize,
    }
    manifest["analyses"] = [a for a in manifest["analyses"] if a["id"] != analysis_id]
    manifest["analyses"].append(entry)
    manifest["active"] = analysis_id

    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    print(f"  Salidas en: {out_dir}")
    print(f"  Manifest actualizado: {manifest_path}")
    print("[run_custom_pca] Listo.")


# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python scripts/analytics/run_custom_pca.py <config.json>", file=sys.stderr)
        sys.exit(1)

    config_path = Path(sys.argv[1])
    if not config_path.exists():
        print(f"No se encontró: {config_path}", file=sys.stderr)
        sys.exit(1)

    config = json.loads(config_path.read_text(encoding="utf-8"))
    run(config)
