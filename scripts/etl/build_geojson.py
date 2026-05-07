"""build_geojson.py — Convierte 00ent.shp -> estados.geojson simplificado para el mapa coropletico.

El GeoJSON resultante tiene una feature por estado con:
  - geometry: poligono/multipoligono simplificado (tolerancia ~0.001 grados)
  - properties.cve_ent: codigo de 2 digitos (join key con el dataset)
  - properties.estado: nombre canonico del estado

Fuente: INEGI Marco Geoestadistico Nacional (00ent.shp)
Join key: campo CVEGEO del shapefile <-> cve_ent del dataset

Sistema de coordenadas original: MEXICO_ITRF_2008_LCC (Lambert Conformal Conic, metros)
Este script reproyecta a WGS84 (EPSG:4326, grados) usando pyproj antes de simplificar.

Dependencias: pip install pyshp numpy pyproj

Uso:
  python scripts/etl/build_geojson.py
  # Resultado -> data/processed/estados.geojson
  # Copiar manualmente a public/data/estados.geojson
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import shapefile  # pyshp
from pyproj import Transformer

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
RAW_DIR = PROJECT_ROOT / "data" / "raw"
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"
STATE_MASTER_FILE = PROJECT_ROOT / "data" / "catalogs" / "states.master.json"
SHAPEFILE_PATH = RAW_DIR / "00ent.shp"

# Reproyeccion: ITRF2008 Lambert Conformal Conic (metros) -> WGS84 lon/lat
# Se usa el WKT exacto del archivo 00ent.prj en lugar de un codigo ESRI,
# para evitar errores por codigos incorrectos o no disponibles en la instalacion.
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
_TRANSFORMER = Transformer.from_crs(
    _SOURCE_CRS_WKT,
    "EPSG:4326",     # WGS84 geografico
    always_xy=True,  # input: (easting, northing) -> output: (lon, lat)
)

SIMPLIFY_TOLERANCE = 0.001  # grados (~100 m); tolerancia Douglas-Peucker post-reproyeccion
RADIAL_MIN_DIST = 0.001     # grados; elimina puntos dentro de este radio del anterior
MIN_RING_POINTS = 4          # anillos con menos puntos tras simplificacion se descartan
MIN_RING_BBOX_DEG = 0.05     # anillos cuya bbox sea menor a esto en ambas dimensiones se descartan (islas pequenas)


def load_state_master() -> dict[str, str]:
    payload = json.loads(STATE_MASTER_FILE.read_text(encoding="utf-8"))
    return {s["cve_ent"]: s["estado"] for s in payload["states"]}


def _radial_simplify(points: list[list[float]], min_dist: float) -> list[list[float]]:
    """Elimina puntos que esten dentro de min_dist del punto anterior aceptado."""
    if len(points) <= 2:
        return points
    result = [points[0]]
    d2 = min_dist * min_dist
    for p in points[1:-1]:
        dx = p[0] - result[-1][0]
        dy = p[1] - result[-1][1]
        if dx * dx + dy * dy >= d2:
            result.append(p)
    result.append(points[-1])
    return result


def _douglas_peucker(points: list[list[float]], tol: float) -> list[list[float]]:
    """Simplificacion Douglas-Peucker iterativa (sin recursion profunda)."""
    if len(points) <= 2:
        return points
    pts = np.array(points, dtype=float)
    keep = np.zeros(len(pts), dtype=bool)
    keep[0] = keep[-1] = True

    stack = [(0, len(pts) - 1)]
    while stack:
        start, end = stack.pop()
        if end - start < 2:
            continue
        seg = pts[end] - pts[start]
        seg_len = np.hypot(seg[0], seg[1])
        if seg_len == 0:
            dists = np.hypot(pts[start + 1:end, 0] - pts[start, 0],
                             pts[start + 1:end, 1] - pts[start, 1])
        else:
            n = np.array([-seg[1], seg[0]]) / seg_len
            diffs = pts[start + 1:end] - pts[start]
            dists = np.abs(diffs @ n)
        idx = int(np.argmax(dists)) + start + 1
        if dists[idx - start - 1] > tol:
            keep[idx] = True
            stack.append((start, idx))
            stack.append((idx, end))

    result = pts[keep].tolist()
    # Garantizar anillo cerrado
    if result and result[0] != result[-1]:
        result.append(result[0])
    return result


def simplify_ring(ring: list[list[float]], tol: float) -> list[list[float]]:
    if len(ring) < MIN_RING_POINTS:
        return []
    xs = [p[0] for p in ring]
    ys = [p[1] for p in ring]
    if (max(xs) - min(xs)) < MIN_RING_BBOX_DEG and (max(ys) - min(ys)) < MIN_RING_BBOX_DEG:
        return []
    reduced = _radial_simplify(ring, RADIAL_MIN_DIST)
    simplified = _douglas_peucker(reduced, tol)
    return simplified if len(simplified) >= MIN_RING_POINTS else []


def _ring_signed_area(ring: list[list[float]]) -> float:
    """Fórmula del lazo (shoelace). Positivo = sentido antihorario (CCW) = exterior en GeoJSON RFC7946."""
    n = len(ring) - 1  # el último punto repite el primero
    return sum(ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1] for i in range(n)) / 2.0


def _point_in_ring(x: float, y: float, ring: list[list[float]]) -> bool:
    """Ray-casting para determinar si un punto está dentro de un anillo."""
    inside = False
    n = len(ring) - 1
    j = n - 1
    for i in range(n):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


def shape_to_geojson_geometry(shape: shapefile.Shape, tol: float) -> dict | None:
    """Convierte una Shape a geometría GeoJSON, distinguiendo anillos exteriores de huecos.

    GeoJSON RFC7946: los anillos exteriores son CCW (área positiva) y los huecos CW (área negativa).
    Los shapefiles de INEGI listan los anillos en orden, pero sin marcador explícito de hueco;
    usamos el signo del área para clasificarlos.
    """
    if shape.shapeType not in (shapefile.POLYGON, shapefile.POLYGONZ):
        raise ValueError(f"Tipo de forma no soportado: {shape.shapeType}")

    parts = list(shape.parts) + [len(shape.points)]
    rings = []
    for i in range(len(parts) - 1):
        raw_pts = shape.points[parts[i]: parts[i + 1]]
        # Reproyectar de LCC metros a WGS84 lon/lat
        lons, lats = _TRANSFORMER.transform(
            [p[0] for p in raw_pts],
            [p[1] for p in raw_pts],
        )
        rings.append([[round(lon, 6), round(lat, 6)] for lon, lat in zip(lons, lats)])

    simplified = [simplify_ring(r, tol) for r in rings]
    simplified = [r for r in simplified if r]
    if not simplified:
        return None

    # Clasificar por winding order: CCW = exterior, CW = hueco
    exteriors = [r for r in simplified if _ring_signed_area(r) >= 0]
    holes = [r for r in simplified if _ring_signed_area(r) < 0]

    # Si no queda ningún exterior tras simplificación, descartar
    if not exteriors:
        return None

    if len(exteriors) == 1:
        # Polygon: [anillo_exterior, ...huecos]
        return {"type": "Polygon", "coordinates": [exteriors[0]] + holes}

    # MultiPolygon: asignar cada hueco al exterior que lo contiene
    polys: list[list[list[list[float]]]] = [[ext] for ext in exteriors]
    for hole in holes:
        cx = sum(p[0] for p in hole[:-1]) / max(len(hole) - 1, 1)
        cy = sum(p[1] for p in hole[:-1]) / max(len(hole) - 1, 1)
        assigned = False
        for poly in polys:
            if _point_in_ring(cx, cy, poly[0]):
                poly.append(hole)
                assigned = True
                break
        if not assigned:
            polys[0].append(hole)  # fallback: asignar al mayor exterior
    return {"type": "MultiPolygon", "coordinates": [polys]}


def build_geojson(tol: float = SIMPLIFY_TOLERANCE) -> dict:
    state_names = load_state_master()
    sf = shapefile.Reader(str(SHAPEFILE_PATH), encoding="latin-1")
    fields = [f[0] for f in sf.fields[1:]]

    features = []
    skipped = 0
    for sr in sf.shapeRecords():
        record = dict(zip(fields, sr.record))
        raw_cve = str(record.get("CVEGEO", record.get("CVE_ENT", ""))).zfill(2)
        estado = state_names.get(raw_cve, record.get("NOMGEO", raw_cve))
        geometry = shape_to_geojson_geometry(sr.shape, tol)
        if geometry is None:
            skipped += 1
            continue
        features.append({
            "type": "Feature",
            "id": raw_cve,
            "properties": {"cve_ent": raw_cve, "estado": estado},
            "geometry": geometry,
        })

    if skipped:
        print(f"  Advertencia: {skipped} features descartadas tras simplificacion")
    return {"type": "FeatureCollection", "features": features}


def main() -> None:
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    geojson = build_geojson()
    text = json.dumps(geojson, ensure_ascii=False, separators=(",", ":"))

    out_processed = PROCESSED_DIR / "estados.geojson"
    out_processed.write_text(text, encoding="utf-8")

    out_public = PROJECT_ROOT / "public" / "data" / "estados.geojson"
    out_public.write_text(text, encoding="utf-8")

    size_kb = len(text.encode()) / 1024
    print(f"GeoJSON generado: {len(geojson['features'])} estados, {size_kb:.0f} KB")
    print(f"  -> {out_processed}")
    print(f"  -> {out_public}")


if __name__ == "__main__":
    main()
