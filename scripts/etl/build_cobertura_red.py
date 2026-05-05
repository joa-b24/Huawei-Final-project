from __future__ import annotations

import json
from pathlib import Path

import geopandas as gpd
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
RAW_DIR = PROJECT_ROOT / "data" / "raw"
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"

MUNICIPIOS_PATH = RAW_DIR / "00mun.shp"
OOKLA_PATH = RAW_DIR / "gps_mobile_tiles.shp"

# Bounding box de México
MEXICO_BBOX = (-118.5, 14.5, -86.5, 32.7)

# Umbral mínimo de tests por hexágono para considerarlo confiable
MIN_TESTS = 3

# Proxy de tecnología según velocidad de descarga promedio (estándar IFT)
def _classify_tech(speed_mbps: float) -> str:
    if speed_mbps < 10:
        return "3G"
    if speed_mbps < 40:
        return "4G"
    return "5G"


def load_and_filter_ookla() -> gpd.GeoDataFrame:
    municipios = gpd.read_file(MUNICIPIOS_PATH)
    ookla = gpd.read_file(OOKLA_PATH)

    if municipios.crs.to_epsg() != 4326:
        municipios = municipios.to_crs("EPSG:4326")
    ookla = ookla.to_crs("EPSG:4326")

    minx, miny, maxx, maxy = MEXICO_BBOX
    ookla_mx = ookla.cx[minx:maxx, miny:maxy].copy()

    if "tests" in ookla_mx.columns:
        ookla_mx = ookla_mx[ookla_mx["tests"] >= MIN_TESTS]

    ookla_mx["avg_d_mbps"] = ookla_mx["avg_d_kbps"] / 1000
    ookla_mx["tech_proxy"] = ookla_mx["avg_d_mbps"].apply(_classify_tech)
    ookla_mx["int_pct_3g_coverage"] = (ookla_mx["tech_proxy"] == "3G").astype(float) * 100
    ookla_mx["int_pct_4g_coverage"] = (ookla_mx["tech_proxy"] == "4G").astype(float) * 100
    ookla_mx["int_pct_5g_coverage"] = (ookla_mx["tech_proxy"] == "5G").astype(float) * 100

    ookla_mx["geometry_hex"] = ookla_mx.geometry
    ookla_mx["geometry"] = ookla_mx.geometry.centroid
    joined = gpd.sjoin(ookla_mx, municipios[["CVE_ENT", "CVEGEO", "NOMGEO", "geometry"]],
                       how="inner", predicate="within")
    joined["geometry"] = joined["geometry_hex"]
    return joined.to_crs("EPSG:4326")


def build_municipal(joined: gpd.GeoDataFrame) -> pd.DataFrame:
    agg = joined.groupby(["CVE_ENT", "CVEGEO", "NOMGEO"]).agg(
        int_avg_speed=("avg_d_mbps", "mean"),
        int_tech_predominante=("tech_proxy", lambda x: x.mode()[0]),
        tests=("tests", "sum") if "tests" in joined.columns else ("avg_d_mbps", "count"),
        int_pct_3g_coverage=("int_pct_3g_coverage", "mean"),
        int_pct_4g_coverage=("int_pct_4g_coverage", "mean"),
        int_pct_5g_coverage=("int_pct_5g_coverage", "mean"),
    ).reset_index()
    return agg.rename(columns={"CVEGEO": "id_cvegeo", "NOMGEO": "nom_mun"})


def build_state(municipal: pd.DataFrame) -> pd.DataFrame:
    return municipal.groupby("CVE_ENT").agg(
        int_avg_speed=("int_avg_speed", "mean"),
        int_pct_3g_coverage=("int_pct_3g_coverage", "mean"),
        int_pct_4g_coverage=("int_pct_4g_coverage", "mean"),
        int_pct_5g_coverage=("int_pct_5g_coverage", "mean"),
        int_tech_predominante=("int_tech_predominante", lambda x: x.mode()[0]),
    ).reset_index()


def write_outputs(municipal: pd.DataFrame, state: pd.DataFrame) -> None:
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    municipal.to_json(
        PROCESSED_DIR / "cobertura_red_por_municipio_2025.json",
        orient="records", force_ascii=False, indent=2,
    )
    state.to_json(
        PROCESSED_DIR / "cobertura_red_por_estado_2025.json",
        orient="records", force_ascii=False, indent=2,
    )
    print(f"Cobertura: {len(municipal)} municipios, {len(state)} estados.")


def main() -> None:
    joined = load_and_filter_ookla()
    municipal = build_municipal(joined)
    state = build_state(municipal)
    write_outputs(municipal, state)


if __name__ == "__main__":
    main()
