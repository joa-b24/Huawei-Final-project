from __future__ import annotations

import csv
import json
import os
import warnings
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

os.environ.setdefault("LOKY_MAX_CPU_COUNT", str(os.cpu_count() or 4))

# Evita trazas ruidosas de joblib/loky en algunos entornos (p. ej. sandbox).
os.environ.setdefault("JOBLIB_MULTIPROCESSING", "0")

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler


def _kmeans(n_clusters: int) -> KMeans:
    try:
        return KMeans(n_clusters=n_clusters, random_state=42, n_init="auto")
    except TypeError:
        return KMeans(n_clusters=n_clusters, random_state=42, n_init=10)


warnings.filterwarnings("ignore", category=UserWarning, module="joblib")

PROJECT_ROOT = Path(__file__).resolve().parent.parent
RAW = PROJECT_ROOT / "data" / "raw"
PROCESSED = PROJECT_ROOT / "data" / "processed"
PUBLIC_DATA = PROJECT_ROOT / "public" / "data"
STATE_MASTER_PATH = PROJECT_ROOT / "data" / "catalogs" / "states.master.json"

ITER_PATH = RAW / "conjunto_de_datos_iter_00CSV20.csv"
IRS_PATH = RAW / "IRS_entidades_mpios_2020.xlsx"
LOC_TIPO_PATH = RAW / "loc_tipo_conectividad.csv"
LOC_META_PATH = RAW / "localidades_conectividad.csv"
OOKLA_MUN_PATH = PROCESSED / "cobertura_red_por_municipio_2025.json"

CONNECTIVITY_YEAR = "2024"
UPDATED_AT = datetime.now(timezone.utc).strftime("%Y-%m-%d")


@dataclass(frozen=True)
class MunAggSpec:
    out_localidades_pct: str
    out_poblacion_pct: str
    predicate_col: str
    good_value: str


LOCALITY_SPECS: tuple[MunAggSpec, ...] = (
    MunAggSpec(
        "loc_pct_movil",
        "pob_pct_movil",
        "MOVIL",
        "Sí",
    ),
    MunAggSpec(
        "loc_pct_3g_garantizada",
        "pob_pct_3g_garantizada",
        "G_3G",
        "Garantizada",
    ),
    MunAggSpec(
        "loc_pct_4g_garantizada",
        "pob_pct_4g_garantizada",
        "G_4G",
        "Garantizada",
    ),
    MunAggSpec(
        "loc_pct_5g_garantizada",
        "pob_pct_5g_garantizada",
        "G_5G",
        "Garantizada",
    ),
)


def load_state_master() -> dict[str, dict]:
    payload = json.loads(STATE_MASTER_PATH.read_text(encoding="utf-8"))
    return {s["cve_ent"]: s for s in payload["states"]}


def load_locality_metadata() -> dict[str, dict[str, float]]:
    meta: dict[str, dict[str, float]] = {}
    with LOC_META_PATH.open("r", encoding="latin1", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            cvegeo = row["CVEGEO"].strip()
            meta[cvegeo] = {
                "poblacion": float((row["POBLACION"] or "0").strip() or 0),
                "localidades": 1.0,
            }
    return meta


def cvegeo_municipio(cvegeo_locality: str) -> str:
    return cvegeo_locality.strip().zfill(9)[:5]


def aggregate_municipal_connectivity(
    locality_metadata: dict[str, dict[str, float]], anio: str
) -> pd.DataFrame:
    totals: dict[str, dict[str, float]] = defaultdict(
        lambda: {"poblacion": 0.0, "localidades": 0.0}
    )
    pos: dict[str, dict[str, float]] = {
        spec.out_localidades_pct: defaultdict(float) for spec in LOCALITY_SPECS
    }
    pos.update({spec.out_poblacion_pct: defaultdict(float) for spec in LOCALITY_SPECS})

    with LOC_TIPO_PATH.open("r", encoding="latin1", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            if row["ANIO"].strip() != anio:
                continue
            loc = locality_metadata.get(row["CVEGEO"].strip())
            if not loc:
                continue
            mun = cvegeo_municipio(row["CVEGEO"])
            totals[mun]["poblacion"] += loc["poblacion"]
            totals[mun]["localidades"] += loc["localidades"]
            for spec in LOCALITY_SPECS:
                val = row.get(spec.predicate_col, "").strip()
                if val == spec.good_value:
                    pos[spec.out_localidades_pct][mun] += loc["localidades"]
                    pos[spec.out_poblacion_pct][mun] += loc["poblacion"]

    rows: list[dict] = []
    for mun in sorted(totals):
        t = totals[mun]
        rec: dict[str, str | float | int] = {"cvegeo": mun}
        if t["localidades"] == 0 or t["poblacion"] == 0:
            continue
        for spec in LOCALITY_SPECS:
            loc_pct = 100.0 * pos[spec.out_localidades_pct][mun] / t["localidades"]
            pob_pct = 100.0 * pos[spec.out_poblacion_pct][mun] / t["poblacion"]
            rec[spec.out_localidades_pct] = round(loc_pct, 4)
            rec[spec.out_poblacion_pct] = round(pob_pct, 4)
        rec["localidades_n"] = int(t["localidades"])
        rec["poblacion_iter_hint"] = float(t["poblacion"])
        rows.append(rec)
    return pd.DataFrame(rows)


def load_iter_municipios() -> pd.DataFrame:
    """Solo filas municipio (LOC=0000); streaming para no cargar todo el ITER."""
    usecols = [
        "ENTIDAD",
        "NOM_ENT",
        "MUN",
        "NOM_MUN",
        "LOC",
        "POBTOT",
        "POBFEM",
        "POBMAS",
        "GRAPROES",
        "P_15YMAS",
        "P_18YMAS",
        "P15YM_SE",
        "P15YM_AN",
        "P18YM_PB",
        "POB0_14",
        "POB15_64",
        "POB65_MAS",
    ]
    rows: list[dict[str, str]] = []
    with ITER_PATH.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            ent = row.get("ENTIDAD", "").strip()
            mun = row.get("MUN", "").strip()
            loc = row.get("LOC", "").strip()
            if ent == "00" or mun == "000" or loc != "0000":
                continue
            rows.append({k: row.get(k, "") for k in usecols})

    df = pd.DataFrame(rows)
    df["cve_ent"] = df["ENTIDAD"].str.strip().str.zfill(2)
    df["cvegeo"] = df["cve_ent"] + df["MUN"].str.strip().str.zfill(3)
    num = [
        "POBTOT",
        "POBFEM",
        "POBMAS",
        "GRAPROES",
        "P_15YMAS",
        "P_18YMAS",
        "P15YM_SE",
        "P15YM_AN",
        "P18YM_PB",
        "POB0_14",
        "POB15_64",
        "POB65_MAS",
    ]
    for c in num:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    df.rename(
        columns={
            "NOM_ENT": "nom_ent",
            "NOM_MUN": "nom_mun",
        },
        inplace=True,
    )
    pob = df["POBTOT"].replace(0, np.nan)
    p15 = df["P_15YMAS"].replace(0, np.nan)
    p18 = df["P_18YMAS"].replace(0, np.nan)
    df["pct_sin_escolaridad_15ymas"] = (df["P15YM_SE"] / p15 * 100).round(4)
    df["pct_analfabetismo_15ymas"] = (df["P15YM_AN"] / p15 * 100).round(4)
    df["pct_posbasica_18ymas"] = (df["P18YM_PB"] / p18 * 100).round(4)
    df["pct_pob_0_14"] = (df["POB0_14"] / pob * 100).round(4)
    df["pct_pob_15_64"] = (df["POB15_64"] / pob * 100).round(4)
    df["pct_pob_65_mas"] = (df["POB65_MAS"] / pob * 100).round(4)
    fem = df["POBFEM"].replace(0, np.nan)
    df["pct_mujeres"] = (df["POBFEM"] / pob * 100).round(4)
    df["pct_hombres"] = (df["POBMAS"] / pob * 100).round(4)
    df["indice_masculinidad"] = (df["POBMAS"] / fem * 100.0).round(4)
    df.rename(
        columns={
            "GRAPROES": "graproes",
            "POBTOT": "pobtot_iter",
        },
        inplace=True,
    )
    return df[
        [
            "cvegeo",
            "cve_ent",
            "nom_ent",
            "nom_mun",
            "pobtot_iter",
            "graproes",
            "pct_sin_escolaridad_15ymas",
            "pct_analfabetismo_15ymas",
            "pct_posbasica_18ymas",
            "pct_pob_0_14",
            "pct_pob_15_64",
            "pct_pob_65_mas",
            "pct_mujeres",
            "pct_hombres",
            "indice_masculinidad",
        ]
    ]


def _shorten_irs_columns(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    mapping: dict[str, str] = {}
    for c in out.columns:
        cl = str(c).lower()
        if "índice de rezago social" in cl and "lugar" not in cl:
            mapping[c] = "irs_indice"
        elif "grado de rezago social" in cl:
            mapping[c] = "irs_grado_texto"
        elif "lugar que ocupa" in cl:
            mapping[c] = "irs_rank_nacional"
        elif "analfabeta" in cl and "15" in cl:
            mapping[c] = "irs_pct_analfabeta"
        elif "no asiste" in cl and "6" in cl and "14" in cl:
            mapping[c] = "irs_pct_no_asiste_6_14"
        elif "básica incompleta" in cl or "basica incompleta" in cl or (
            "incompleta" in cl and "15" in cl and "años" in cl
        ):
            mapping[c] = "irs_pct_educ_basica_incompleta"
        elif "sin derechohabiencia" in cl:
            mapping[c] = "irs_pct_sin_derechohabiencia"
        elif "piso de tierra" in cl:
            mapping[c] = "irs_pct_viv_piso_tierra"
        elif "excusado" in cl:
            mapping[c] = "irs_pct_viv_sin_excusado"
        elif "agua entubada" in cl:
            mapping[c] = "irs_pct_viv_sin_agua"
        elif "drenaje" in cl and "no disponen" in cl:
            mapping[c] = "irs_pct_viv_sin_drenaje"
        elif "energía eléctrica" in cl or "energรญa elรฉctrica" in cl:
            mapping[c] = "irs_pct_viv_sin_luz"
        elif "lavadora" in cl:
            mapping[c] = "irs_pct_viv_sin_lavadora"
        elif "refrigerador" in cl:
            mapping[c] = "irs_pct_viv_sin_refri"
    out = out.rename(columns=mapping)
    return out


def load_irs_municipios() -> pd.DataFrame:
    raw = pd.read_excel(IRS_PATH, sheet_name="Municipios", header=[4, 5])
    parts: list[str] = []
    for col in raw.columns:
        bits = [str(x).strip() for x in col if str(x) != "nan" and "Unnamed" not in str(x)]
        parts.append(" | ".join(bits))
    raw.columns = parts
    raw = raw.rename(
        columns={
            "Clave entidad": "cve_ent",
            "Entidad\nfederativa": "nom_ent_irs",
            "Clave municipio": "irs_clave_mun_raw",
            "Municipio": "nom_mun_irs",
            "Población total": "irs_pob_total",
        }
    )
    raw = _shorten_irs_columns(raw)
    raw["cve_ent"] = raw["cve_ent"].astype(str).str.strip().str.zfill(2)


    def _row_cvegeo(x: object) -> str | None:
        if pd.isna(x):
            return None
        try:
            return str(int(round(float(x)))).zfill(5)
        except (TypeError, ValueError):
            return None

    raw["cvegeo"] = raw["irs_clave_mun_raw"].map(_row_cvegeo)
    raw = raw.dropna(subset=["cvegeo"])
    num_cols = [c for c in raw.columns if c.startswith("irs_pct") or c == "irs_indice"]
    for c in num_cols:
        raw[c] = pd.to_numeric(raw[c], errors="coerce")
    keep = [
        "cvegeo",
        "cve_ent",
        "nom_ent_irs",
        "nom_mun_irs",
        "irs_pob_total",
        "irs_indice",
        "irs_grado_texto",
        "irs_rank_nacional",
    ] + [c for c in raw.columns if c.startswith("irs_pct")]
    return raw[[c for c in keep if c in raw.columns]].drop_duplicates(subset=["cvegeo"])


def load_ookla_municipios() -> pd.DataFrame:
    payload = json.loads(OOKLA_MUN_PATH.read_text(encoding="utf-8"))
    df = pd.DataFrame(payload)
    df["cvegeo"] = df["id_cvegeo"].astype(str).str.strip().str.zfill(5)
    df["cve_ent_ookla"] = df["CVE_ENT"].astype(str).str.strip().str.zfill(2)
    df = df.rename(
        columns={
            "nom_mun": "nom_mun_ookla",
            "int_avg_speed": "ookla_int_avg_speed",
            "int_pct_3g_coverage": "ookla_pct_3g",
            "int_pct_4g_coverage": "ookla_pct_4g",
            "int_pct_5g_coverage": "ookla_pct_5g",
            "int_tech_predominante": "ookla_tech_predominante",
        }
    )
    df["ookla_cubierto"] = True
    return df[
        [
            "cvegeo",
            "cve_ent_ookla",
            "nom_mun_ookla",
            "ookla_int_avg_speed",
            "ookla_pct_3g",
            "ookla_pct_4g",
            "ookla_pct_5g",
            "ookla_tech_predominante",
            "ookla_cubierto",
        ]
    ]


def _trapz(y: np.ndarray, x: np.ndarray) -> float:
    if hasattr(np, "trapezoid"):
        return float(np.trapezoid(y, x))
    return float(np.trapz(y, x))  # type: ignore[attr-defined]


def weighted_gini(values: np.ndarray, weights: np.ndarray) -> float:
    v = np.asarray(values, dtype=float)
    w = np.asarray(weights, dtype=float)
    mask = np.isfinite(v) & np.isfinite(w) & (w > 0)
    v, w = v[mask], w[mask]
    if v.size == 0:
        return float("nan")
    order = np.argsort(v)
    v, w = v[order], w[order]
    cw = np.concatenate([[0], np.cumsum(w)])
    cx = np.concatenate([[0], np.cumsum(v * w)])
    total_w = cw[-1]
    total_xw = cx[-1]
    if total_xw <= 0:
        return 0.0
    cw_n = cw / total_w
    cx_n = cx / total_xw
    return float(1.0 - 2.0 * _trapz(cx_n, cw_n))


def theil_l(values: np.ndarray, weights: np.ndarray) -> float:
    v = np.asarray(values, dtype=float)
    w = np.asarray(weights, dtype=float)
    mask = np.isfinite(v) & np.isfinite(w) & (w > 0)
    v, w = v[mask], w[mask]
    if v.size == 0:
        return float("nan")
    v = np.maximum(v, 1e-6)
    mu = float(np.sum(w * v) / np.sum(w))
    if mu <= 0:
        return float("nan")
    return float(np.sum(w * np.log(mu / v)) / np.sum(w))


def spearman_safe(a: pd.Series, b: pd.Series) -> float:
    df = pd.DataFrame({"a": a, "b": b}).replace([np.inf, -np.inf], np.nan).dropna()
    if df.shape[0] < 5:
        return float("nan")
    return float(df["a"].corr(df["b"], method="spearman"))


def pick_kmeans_k(matrix: np.ndarray, k_min: int = 2, k_max: int = 7) -> tuple[int, float, np.ndarray]:
    best_k = k_min
    best_score = -1.0
    best_labels: np.ndarray | None = None
    for k in range(k_min, min(k_max + 1, matrix.shape[0])):
        model = _kmeans(k)
        labels = model.fit_predict(matrix)
        if len(set(labels)) < 2:
            continue
        score = silhouette_score(matrix, labels)
        if score > best_score:
            best_score = score
            best_k = k
            best_labels = labels.copy()
    assert best_labels is not None
    return best_k, float(best_score), best_labels


def label_clusters(df: pd.DataFrame) -> dict[int, str]:
    """Etiquetas legibles por perfil medio (sin LLM)."""
    prof = df.groupby("cluster_id", as_index=False).agg(
        pob_4g=("pob_pct_4g_garantizada", "mean"),
        pob_3g=("pob_pct_3g_garantizada", "mean"),
        irs=("irs_indice", "mean"),
        grap=("graproes", "mean"),
    )
    prof["score_digital"] = prof["pob_4g"] + 0.5 * prof["pob_3g"] - prof["irs"].fillna(0)
    prof = prof.sort_values("score_digital", ascending=False).reset_index(drop=True)
    templates = [
        "Perfil alto en cobertura poblacional y menor rezago IRS",
        "Perfil intermedio-alto en conectividad",
        "Perfil intermedio en conectividad y rezago",
        "Perfil con rezago territorial de cobertura o IRS elevado",
        "Perfil heterogéneo / transición",
        "Perfil de priorización (baja cobertura relativa)",
        "Perfil divergente (revisar outliers locales)",
    ]
    cid_to_label: dict[int, str] = {}
    for i, row in prof.iterrows():
        cid = int(row["cluster_id"])
        cid_to_label[cid] = f"Grupo {i + 1}: {templates[min(i, len(templates) - 1)]}"
    return cid_to_label


def main() -> None:
    state_master = load_state_master()
    locality_meta = load_locality_metadata()
    conn = aggregate_municipal_connectivity(locality_meta, CONNECTIVITY_YEAR)
    iter_df = load_iter_municipios()
    irs_df = load_irs_municipios()
    ookla_df = load_ookla_municipios()

    df = iter_df.merge(conn, on="cvegeo", how="inner")
    df = df.merge(irs_df, on=["cvegeo", "cve_ent"], how="left", suffixes=("", "_irs"))
    df = df.merge(ookla_df, on="cvegeo", how="left")
    df["ookla_cubierto"] = df["ookla_cubierto"].fillna(False)

    df["brecha_4g_pp"] = (
        df["pob_pct_4g_garantizada"] - df["loc_pct_4g_garantizada"]
    ).round(4)
    df["brecha_3g_pp"] = (
        df["pob_pct_3g_garantizada"] - df["loc_pct_3g_garantizada"]
    ).round(4)

    feature_cols = [
        "graproes",
        "pct_sin_escolaridad_15ymas",
        "pct_posbasica_18ymas",
        "pob_pct_4g_garantizada",
        "pob_pct_3g_garantizada",
        "loc_pct_4g_garantizada",
        "irs_indice",
        "pct_pob_65_mas",
    ]
    X = df[feature_cols].replace([np.inf, -np.inf], np.nan)
    row_ok = X.notna().all(axis=1)
    df_cluster = df.loc[row_ok].copy()
    X_ok = X.loc[row_ok].to_numpy(dtype=float)
    scaler = StandardScaler()
    Xz = scaler.fit_transform(X_ok)
    k, sil, labels = pick_kmeans_k(Xz)
    df_cluster["cluster_id"] = labels
    df["cluster_id"] = np.nan
    df.loc[df_cluster.index, "cluster_id"] = labels.astype(float)
    cluster_labels = label_clusters(df_cluster)
    df["cluster_label"] = df["cluster_id"].map(lambda x: cluster_labels.get(int(x), "") if pd.notna(x) else "")

    for c in feature_cols:
        df[f"{c}_z"] = np.nan
    df.loc[df_cluster.index, [f"{c}_z" for c in feature_cols]] = Xz

    nat_w = df["pobtot_iter"].to_numpy(dtype=float)
    nat_gini_4g = weighted_gini(df["pob_pct_4g_garantizada"].to_numpy(), nat_w)
    nat_theil_4g = theil_l(df["pob_pct_4g_garantizada"].to_numpy(), nat_w)
    nat_gini_3g = weighted_gini(df["pob_pct_3g_garantizada"].to_numpy(), nat_w)
    nat_spear = spearman_safe(df["graproes"], df["pob_pct_4g_garantizada"])
    nat_spear_mujeres = spearman_safe(df["pct_mujeres"], df["pob_pct_4g_garantizada"])
    nat_spear_65 = spearman_safe(df["pct_pob_65_mas"], df["pob_pct_4g_garantizada"])
    nat_spear_014 = spearman_safe(df["pct_pob_0_14"], df["pob_pct_4g_garantizada"])

    state_rows: list[dict] = []
    for cve_ent, g in df.groupby("cve_ent"):
        st = state_master.get(cve_ent, {})
        w = g["pobtot_iter"].to_numpy(dtype=float)
        state_rows.append(
            {
                "cve_ent": cve_ent,
                "state_code": st.get("state_code", ""),
                "estado": st.get("estado", g["nom_ent"].iloc[0]),
                "region": st.get("region", ""),
                "n_municipios": int(len(g)),
                "gini_pob_pct_4g": round(weighted_gini(g["pob_pct_4g_garantizada"].to_numpy(), w), 6),
                "theil_L_pob_pct_4g": round(theil_l(g["pob_pct_4g_garantizada"].to_numpy(), w), 6),
                "p90_pob_pct_4g": round(float(np.percentile(g["pob_pct_4g_garantizada"], 90)), 4),
                "p10_pob_pct_4g": round(float(np.percentile(g["pob_pct_4g_garantizada"], 10)), 4),
                "mean_graproes": round(float(g["graproes"].mean()), 4),
                "mean_pob_pct_4g": round(float(g["pob_pct_4g_garantizada"].mean()), 4),
                "mean_pct_mujeres": round(float(g["pct_mujeres"].mean()), 4),
                "spearman_graproes_vs_pob_4g": round(spearman_safe(g["graproes"], g["pob_pct_4g_garantizada"]), 6),
                "spearman_pct_mujeres_vs_pob_4g": round(
                    spearman_safe(g["pct_mujeres"], g["pob_pct_4g_garantizada"]), 6
                ),
                "spearman_pct_pob_65_mas_vs_pob_4g": round(
                    spearman_safe(g["pct_pob_65_mas"], g["pob_pct_4g_garantizada"]), 6
                ),
                "spearman_pct_pob_0_14_vs_pob_4g": round(
                    spearman_safe(g["pct_pob_0_14"], g["pob_pct_4g_garantizada"]), 6
                ),
                "ookla_municipios_cubiertos": int(g["ookla_cubierto"].sum()),
            }
        )
    state_rows.sort(key=lambda x: x["cve_ent"])

    national_payload = {
        "gini_pob_pct_4g": round(nat_gini_4g, 6),
        "gini_pob_pct_3g": round(nat_gini_3g, 6),
        "theil_L_pob_pct_4g": round(nat_theil_4g, 6),
        "spearman_graproes_vs_pob_4g": round(nat_spear, 6),
        "spearman_pct_mujeres_vs_pob_4g": round(nat_spear_mujeres, 6),
        "spearman_pct_pob_65_mas_vs_pob_4g": round(nat_spear_65, 6),
        "spearman_pct_pob_0_14_vs_pob_4g": round(nat_spear_014, 6),
        "kmeans_k": int(k),
        "kmeans_silhouette": round(sil, 6),
        "n_municipios_modelados": int(len(df)),
        "n_municipios_en_clustering": int(len(df_cluster)),
        "connectivity_year": CONNECTIVITY_YEAR,
        "cluster_labels": cluster_labels,
    }

    dashboard = {
        "updated_at": UPDATED_AT,
        "schema_version": "1.0.0",
        "dataset_id": "state_analytics_dashboard",
        "national": national_payload,
        "states": state_rows,
    }

    PROCESSED.mkdir(parents=True, exist_ok=True)
    PUBLIC_DATA.mkdir(parents=True, exist_ok=True)

    csv_path = PROCESSED / "municipios_master_analytics.csv"
    df.to_csv(csv_path, index=False, encoding="utf-8")

    json_mun_path = PROCESSED / "municipios_master_analytics.json"
    json_mun_path.write_text(df.to_json(orient="records", force_ascii=False, indent=2), encoding="utf-8")

    dash_path = PROCESSED / "state_analytics_dashboard.json"
    dash_path.write_text(json.dumps(dashboard, ensure_ascii=False, indent=2), encoding="utf-8")

    (PUBLIC_DATA / "municipios_master_analytics.json").write_text(
        json_mun_path.read_text(encoding="utf-8"), encoding="utf-8"
    )
    (PUBLIC_DATA / "state_analytics_dashboard.json").write_text(
        dash_path.read_text(encoding="utf-8"), encoding="utf-8"
    )

    print(f"Municipios en maestro: {len(df)}")
    print(f"Municipios en clustering: {len(df_cluster)} (k={k}, sil={sil:.4f})")
    print(f"Gini nacional 4G (ponderado): {nat_gini_4g:.4f}")
    print(f"Salidas: {csv_path.name}, {json_mun_path.name}, {dash_path.name}")


if __name__ == "__main__":
    main()
