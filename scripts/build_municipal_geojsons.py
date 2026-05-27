"""
build_municipal_geojsons.py — Genera GeoJSONs de geometría pura por estado.

Salida:
    public/data/geo/municipios/{state_code}.geojson   — 32 archivos (solo geometría)
    public/data/geo/municipios/bboxes.json            — bounding boxes para zoom automático

Los datos de variables viven en:
    public/data/outputs/municipal/{state_code}/{variable_id}.json
Ver export_municipal_from_analytics.py para generarlos.

Uso:
    python scripts/build_municipal_geojsons.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

PROJECT_ROOT = Path(__file__).resolve().parent.parent
GEO_SOURCE   = PROJECT_ROOT / "public" / "data" / "geo" / "mexico_municipios.geojson"
OUT_DIR      = PROJECT_ROOT / "public" / "data" / "geo" / "municipios"

INEGI_TO_CODE: dict[str, str] = {
    "01": "AGS", "02": "BCN", "03": "BCS", "04": "CAM",
    "05": "COA", "06": "COL", "07": "CHP", "08": "CHH",
    "09": "CMX", "10": "DUR", "11": "GUA", "12": "GRO",
    "13": "HID", "14": "JAL", "15": "MEX", "16": "MIC",
    "17": "MOR", "18": "NAY", "19": "NLE", "20": "OAX",
    "21": "PUE", "22": "QUE", "23": "ROO", "24": "SLP",
    "25": "SIN", "26": "SON", "27": "TAB", "28": "TAM",
    "29": "TLA", "30": "VER", "31": "YUC", "32": "ZAC",
}


def _bbox_of_feature(feature: dict) -> tuple[float, float, float, float] | None:
    geom = feature.get("geometry", {})
    geom_type = geom.get("type", "")
    coords = geom.get("coordinates", [])
    lons, lats = [], []

    def walk(ring_or_rings):
        if not ring_or_rings:
            return
        if isinstance(ring_or_rings[0], (int, float)):
            lons.append(ring_or_rings[0])
            lats.append(ring_or_rings[1])
        else:
            for item in ring_or_rings:
                walk(item)

    if geom_type == "Polygon":
        walk(coords)
    elif geom_type == "MultiPolygon":
        for poly in coords:
            walk(poly)
    else:
        return None

    if not lons:
        return None
    return (min(lons), min(lats), max(lons), max(lats))


def main() -> None:
    print("Leyendo geometría...")
    geo = json.loads(GEO_SOURCE.read_text(encoding="utf-8"))
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    by_state: dict[str, list[dict]] = {}
    skipped = 0

    for feat in geo["features"]:
        props = feat.get("properties", {})
        cve_ent = str(props.get("cve_ent", "")).zfill(2)
        state_code = INEGI_TO_CODE.get(cve_ent)
        if not state_code:
            skipped += 1
            continue

        cvegeo = str(props.get("cvegeo", ""))
        nom_mun = props.get("nom_mun") or props.get("NOM_MUN") or ""

        new_feat = {
            **feat,
            "properties": {
                "cvegeo":     cvegeo,
                "cve_ent":    cve_ent,
                "state_code": state_code,
                "nom_mun":    nom_mun,
            },
        }
        by_state.setdefault(state_code, []).append(new_feat)

    if skipped:
        print(f"  {skipped} features sin cve_ent reconocido (omitidos).")

    bboxes: dict[str, list[float]] = {}

    for state_code, features in sorted(by_state.items()):
        lon_min, lat_min, lon_max, lat_max = 180.0, 90.0, -180.0, -90.0
        for feat in features:
            bb = _bbox_of_feature(feat)
            if bb:
                lon_min = min(lon_min, bb[0])
                lat_min = min(lat_min, bb[1])
                lon_max = max(lon_max, bb[2])
                lat_max = max(lat_max, bb[3])

        bboxes[state_code] = [lon_min, lat_min, lon_max, lat_max]

        fc = {"type": "FeatureCollection", "features": features}
        out_path = OUT_DIR / f"{state_code}.geojson"
        out_path.write_text(
            json.dumps(fc, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )

        kb = out_path.stat().st_size // 1024
        print(f"  {state_code}: {len(features)} municipios  {kb} KB")

    bboxes_path = OUT_DIR / "bboxes.json"
    bboxes_path.write_text(
        json.dumps(bboxes, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"\n  bboxes.json: {len(bboxes)} estados")
    print(f"  {len(by_state)} GeoJSONs escritos en {OUT_DIR}")


if __name__ == "__main__":
    main()
