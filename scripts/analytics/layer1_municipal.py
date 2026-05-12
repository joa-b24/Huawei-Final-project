#!/usr/bin/env python3
"""
layer1_municipal.py — Calcula analytics descriptivos a nivel municipio para estados dados.

Uso:
    python scripts/analytics/layer1_municipal.py AGS JAL   # estados específicos
    python scripts/analytics/layer1_municipal.py            # todos los estados con datos

Entrada:  public/data/outputs/municipal/{STATE_CODE}/{variable_id}.json
Salida:   public/data/outputs/municipal/{STATE_CODE}/analytics.json
          public/data/municipal_manifest.json  (marca analytics_available = true)
"""

from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path
from statistics import mean, median, stdev

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
MUNICIPAL_DIR = PROJECT_ROOT / "public" / "data" / "outputs" / "municipal"
MANIFEST_PATH = PROJECT_ROOT / "public" / "data" / "municipal_manifest.json"
CATALOG_PATH = PROJECT_ROOT / "data" / "catalogs" / "variables.catalog.json"


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def _direction(variable_id: str) -> str:
    if not CATALOG_PATH.exists():
        return "higher_better"
    catalog = load_json(CATALOG_PATH)
    entry = next((v for v in catalog.get("variables", []) if v["variable_id"] == variable_id), None)
    return (entry or {}).get("direction", "higher_better")


def compute_variable_analytics(records: list[dict], variable_id: str) -> dict:
    values = [r["value"] for r in records if r.get("value") is not None]
    if not values:
        return {}

    n = len(values)
    sorted_vals = sorted(values)
    q1 = sorted_vals[int(n * 0.25)]
    q3 = sorted_vals[int(n * 0.75)]

    stats = {
        "count": n,
        "mean": round(mean(values), 4),
        "median": round(median(values), 4),
        "std": round(stdev(values), 4) if n > 1 else 0.0,
        "min": round(min(values), 4),
        "max": round(max(values), 4),
        "q1": round(q1, 4),
        "q3": round(q3, 4),
    }

    direction = _direction(variable_id)
    ascending = direction == "lower_better"
    ranked = sorted(records, key=lambda r: r.get("value", 0), reverse=not ascending)
    rankings = [
        {"rank": i + 1, "cve_mun": r["cve_mun"], "value": round(r["value"], 4)}
        for i, r in enumerate(ranked)
        if r.get("value") is not None
    ]

    # IQR outliers
    iqr = q3 - q1
    lower, upper = q1 - 1.5 * iqr, q3 + 1.5 * iqr
    outliers = [
        {"cve_mun": r["cve_mun"], "value": round(r["value"], 4)}
        for r in records
        if r.get("value") is not None and (r["value"] < lower or r["value"] > upper)
    ]

    return {"stats": stats, "rankings": rankings, "outliers": outliers}


def process_state(state_code: str) -> bool:
    state_dir = MUNICIPAL_DIR / state_code
    if not state_dir.exists():
        print(f"  [skip] {state_code}: directorio no encontrado")
        return False

    variable_files = [f for f in state_dir.glob("*.json") if f.stem != "analytics"]
    if not variable_files:
        print(f"  [skip] {state_code}: sin archivos de variables")
        return False

    analytics: dict = {
        "state_code": state_code,
        "updated_at": date.today().isoformat(),
        "variables": {},
    }

    for var_file in sorted(variable_files):
        try:
            data = load_json(var_file)
            variable_id = data.get("variable_id", var_file.stem)
            records = data.get("records", [])
            year = data.get("year")

            var_analytics = compute_variable_analytics(records, variable_id)
            if var_analytics:
                analytics["variables"][variable_id] = {"year": year, **var_analytics}
                print(f"  [ok] {state_code}/{variable_id}  ({len(records)} municipios)")
        except Exception as e:
            print(f"  [error] {state_code}/{var_file.name}: {e}")

    if not analytics["variables"]:
        return False

    save_json(state_dir / "analytics.json", analytics)
    return True


def mark_analytics_available(state_codes: list[str]) -> None:
    if not MANIFEST_PATH.exists():
        return
    manifest = load_json(MANIFEST_PATH)
    for sc in state_codes:
        if sc in manifest.get("states", {}):
            manifest["states"][sc]["analytics_available"] = True
    manifest["updated_at"] = date.today().isoformat()
    save_json(MANIFEST_PATH, manifest)


def main() -> None:
    if len(sys.argv) > 1:
        state_codes = [s.upper() for s in sys.argv[1:]]
    else:
        if not MUNICIPAL_DIR.exists():
            print("No se encontró public/data/outputs/municipal/")
            return
        state_codes = [d.name for d in sorted(MUNICIPAL_DIR.iterdir()) if d.is_dir()]

    if not state_codes:
        print("Sin estados para procesar.")
        return

    print(f"Calculando analytics municipales para: {', '.join(state_codes)}")
    completed = [sc for sc in state_codes if process_state(sc)]

    if completed:
        mark_analytics_available(completed)
        print(f"\nAnalytics municipales completados: {', '.join(completed)}")
    else:
        print("Sin resultados.")


if __name__ == "__main__":
    main()
