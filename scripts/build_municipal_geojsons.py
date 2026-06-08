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

import numpy as np
import shapefile
from pyproj import Transformer

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

PROJECT_ROOT   = Path(__file__).resolve().parent.parent
GEO_SOURCE     = PROJECT_ROOT / "public" / "data" / "geo" / "mexico_municipios.geojson"
OUT_DIR        = PROJECT_ROOT / "public" / "data" / "geo" / "municipios"
MUN_SHAPEFILE  = PROJECT_ROOT / "data" / "raw" / "00mun.shp"

# ── CDMX override ────────────────────────────────────────────────────────────
# mexico_municipios.geojson usa una tolerancia uniforme que es demasiado gruesa
# para las pequeñas alcaldías de CDMX. Se regeneran desde el shapefile oficial
# con tolerancia fina (0.0001°, ~10 m) cuando el shapefile está disponible.
_CMX_CVE_ENT   = "09"
_CMX_TOL       = 0.0001   # grados — Douglas-Peucker para CDMX
_CMX_RADIAL    = 0.0001   # grados — pre-filtro radial
_CMX_MIN_PTS   = 4
_CMX_MIN_BBOX  = 0.02     # grados — descartar micro-anillos (islas menores)

_SOURCE_CRS_WKT = (
    'PROJCS["MEXICO_ITRF_2008_LCC",'
    'GEOGCS["GCS_ITRF_2008",'
    'DATUM["D_ITRF_2008",SPHEROID["GRS_1980",6378137.0,298.257222101]],'
    'PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],'
    'PROJECTION["Lambert_Conformal_Conic"],'
    'PARAMETER["False_Easting",2500000.0],'
    'PARAMETER["False_Northing",0.0],'
    'PARAMETER["Central_Meridian",-102.0],'
    'PARAMETER["Standard_Parallel_1",17.5],'
    'PARAMETER["Standard_Parallel_2",29.5],'
    'PARAMETER["Latitude_Of_Origin",12.0],'
    'UNIT["Meter",1.0]]'
)
_TRANSFORMER = Transformer.from_crs(_SOURCE_CRS_WKT, "EPSG:4326", always_xy=True)


def _radial_simplify(pts: list, min_d: float) -> list:
    if len(pts) <= 2:
        return pts
    result = [pts[0]]
    d2 = min_d * min_d
    for p in pts[1:-1]:
        dx, dy = p[0] - result[-1][0], p[1] - result[-1][1]
        if dx * dx + dy * dy >= d2:
            result.append(p)
    result.append(pts[-1])
    return result


def _douglas_peucker(pts: list, tol: float) -> list:
    if len(pts) <= 2:
        return pts
    arr = np.array(pts, dtype=float)
    keep = np.zeros(len(arr), dtype=bool)
    keep[0] = keep[-1] = True
    stack = [(0, len(arr) - 1)]
    while stack:
        s, e = stack.pop()
        if e - s < 2:
            continue
        seg = arr[e] - arr[s]
        seg_len = np.hypot(seg[0], seg[1])
        if seg_len == 0:
            dists = np.hypot(arr[s + 1:e, 0] - arr[s, 0], arr[s + 1:e, 1] - arr[s, 1])
        else:
            n = np.array([-seg[1], seg[0]]) / seg_len
            dists = np.abs((arr[s + 1:e] - arr[s]) @ n)
        idx = int(np.argmax(dists)) + s + 1
        if dists[idx - s - 1] > tol:
            keep[idx] = True
            stack.extend([(s, idx), (idx, e)])
    result = arr[keep].tolist()
    if result and result[0] != result[-1]:
        result.append(result[0])
    return result


def _simplify_ring_cmx(ring: list) -> list:
    if len(ring) < _CMX_MIN_PTS:
        return []
    xs = [p[0] for p in ring]; ys = [p[1] for p in ring]
    if (max(xs) - min(xs)) < _CMX_MIN_BBOX and (max(ys) - min(ys)) < _CMX_MIN_BBOX:
        return []
    r = _douglas_peucker(_radial_simplify(ring, _CMX_RADIAL), _CMX_TOL)
    return r if len(r) >= _CMX_MIN_PTS else []


def _ring_area(ring: list) -> float:
    """Shoelace. Negativo = CW = exterior en shapefiles INEGI."""
    n = len(ring) - 1
    return sum(ring[i][0] * ring[i+1][1] - ring[i+1][0] * ring[i][1] for i in range(n)) / 2.0


def _in_ring(x: float, y: float, ring: list) -> bool:
    inside, j = False, len(ring) - 2
    for i in range(len(ring) - 1):
        xi, yi = ring[i]; xj, yj = ring[j]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


def _shape_to_geometry(shape: shapefile.Shape) -> dict | None:
    parts = list(shape.parts) + [len(shape.points)]
    rings = []
    for i in range(len(parts) - 1):
        raw = shape.points[parts[i]: parts[i + 1]]
        lons, lats = _TRANSFORMER.transform([p[0] for p in raw], [p[1] for p in raw])
        ring = [[round(lon, 6), round(lat, 6)] for lon, lat in zip(lons, lats)]
        s = _simplify_ring_cmx(ring)
        if s:
            rings.append(s)
    if not rings:
        return None
    # Shapefiles INEGI: CW (área < 0) = exterior; invertir para RFC7946 (exterior CCW)
    exteriors = [r[::-1] for r in rings if _ring_area(r) < 0]
    holes     = [r[::-1] for r in rings if _ring_area(r) >= 0]
    if not exteriors:
        return None
    if len(exteriors) == 1:
        return {"type": "Polygon", "coordinates": [exteriors[0]] + holes}
    polys: list = [[ext] for ext in exteriors]
    for hole in holes:
        cx = sum(p[0] for p in hole[:-1]) / max(len(hole) - 1, 1)
        cy = sum(p[1] for p in hole[:-1]) / max(len(hole) - 1, 1)
        for poly in polys:
            if _in_ring(cx, cy, poly[0]):
                poly.append(hole); break
        else:
            polys[0].append(hole)
    return {"type": "MultiPolygon", "coordinates": [polys]}


def _load_cmx_from_shapefile(state_code: str) -> list[dict] | None:
    """Lee CDMX desde 00mun.shp con tolerancia fina. Retorna None si el shapefile no existe."""
    if not MUN_SHAPEFILE.exists():
        return None
    sf = shapefile.Reader(str(MUN_SHAPEFILE), encoding="latin-1")
    fields = [f[0] for f in sf.fields[1:]]
    features = []
    for sr in sf.shapeRecords():
        rec = dict(zip(fields, sr.record))
        if str(rec.get("CVE_ENT", "")).zfill(2) != _CMX_CVE_ENT:
            continue
        geom = _shape_to_geometry(sr.shape)
        if geom is None:
            continue
        features.append({
            "type": "Feature",
            "properties": {
                "cvegeo":     str(rec.get("CVEGEO", "")).zfill(5),
                "cve_ent":    _CMX_CVE_ENT,
                "state_code": state_code,
                "nom_mun":    str(rec.get("NOMGEO", "")),
            },
            "geometry": geom,
        })
    return features or None

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

    # ── Override CDMX con geometría de alta resolución desde shapefile ────────
    cmx_code = INEGI_TO_CODE[_CMX_CVE_ENT]
    cmx_from_shp = _load_cmx_from_shapefile(cmx_code)
    if cmx_from_shp is not None:
        by_state[cmx_code] = cmx_from_shp
        print(f"  CDMX: geometría reemplazada desde {MUN_SHAPEFILE.name} ({len(cmx_from_shp)} alcaldías)")
    else:
        print(f"  CDMX: shapefile no encontrado, usando geometría de mexico_municipios.geojson")

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
