#!/usr/bin/env python3
"""
layer1_municipal.py — Calcula analytics descriptivos municipales y los embebe en el combined.

Lee:   public/data/outputs/municipal/{STATE_CODE}.json
       (estructura: { state_code, variables: { var_id: { year, records } } })

Escribe de vuelta al mismo archivo añadiendo bajo cada variable:
       stats    — mean, median, std, min, max, q1, q3
       rankings — lista ordenada por valor (según direction del catálogo)
       outliers — municipios fuera de Q1-1.5·IQR / Q3+1.5·IQR

Actualiza municipal_manifest.json → analytics_available = true.

Uso:
    python scripts/analytics/layer1_municipal.py AGS JAL   # estados específicos
    python scripts/analytics/layer1_municipal.py            # todos los estados con datos
"""

from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path
from statistics import mean, median, stdev

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

PROJECT_ROOT  = Path(__file__).resolve().parent.parent.parent
MUNICIPAL_DIR = PROJECT_ROOT / "public" / "data" / "outputs" / "municipal"
MANIFEST_PATH = PROJECT_ROOT / "public" / "data" / "municipal_manifest.json"
CATALOG_PATH  = PROJECT_ROOT / "data" / "catalogs" / "variables.catalog.json"

_catalog_cache: dict | None = None


def _direction(variable_id: str) -> str:
    global _catalog_cache
    if _catalog_cache is None and CATALOG_PATH.exists():
        _catalog_cache = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    if not _catalog_cache:
        return "higher_better"
    entry = next(
        (v for v in _catalog_cache.get("variables", []) if v["variable_id"] == variable_id),
        None,
    )
    return (entry or {}).get("direction") or "higher_better"


def compute_analytics(records: list[dict], variable_id: str) -> dict:
    values = [r["value"] for r in records if r.get("value") is not None]
    if not values:
        return {}

    n = len(values)
    sorted_vals = sorted(values)
    q1 = sorted_vals[max(0, int(n * 0.25) - 1)]
    q3 = sorted_vals[min(n - 1, int(n * 0.75))]
    iqr = q3 - q1

    stats = {
        "count": n,
        "mean":   round(mean(values), 4),
        "median": round(median(values), 4),
        "std":    round(stdev(values), 4) if n > 1 else 0.0,
        "min":    round(min(values), 4),
        "max":    round(max(values), 4),
        "q1":     round(q1, 4),
        "q3":     round(q3, 4),
    }

    ascending = _direction(variable_id) == "lower_better"
    rankings = [
        {"rank": i + 1, "cve_mun": r["cve_mun"], "value": round(r["value"], 4)}
        for i, r in enumerate(
            sorted(records, key=lambda r: r.get("value", 0), reverse=not ascending)
        )
        if r.get("value") is not None
    ]

    lo, hi = q1 - 1.5 * iqr, q3 + 1.5 * iqr
    outliers = [
        {"cve_mun": r["cve_mun"], "value": round(r["value"], 4)}
        for r in records
        if r.get("value") is not None and (r["value"] < lo or r["value"] > hi)
    ]

    return {"stats": stats, "rankings": rankings, "outliers": outliers}


def process_state(state_code: str) -> bool:
    combined_path = MUNICIPAL_DIR / f"{state_code}.json"
    if not combined_path.exists():
        print(f"  [skip] {state_code}: {combined_path.name} no encontrado")
        return False

    data = json.loads(combined_path.read_text(encoding="utf-8"))
    variables: dict = data.get("variables", {})
    if not variables:
        print(f"  [skip] {state_code}: sin variables en el combined")
        return False

    any_computed = False
    for variable_id, var_entry in variables.items():
        records = var_entry.get("records", [])
        analytics = compute_analytics(records, variable_id)
        if analytics:
            var_entry["stats"]    = analytics["stats"]
            var_entry["rankings"] = analytics["rankings"]
            var_entry["outliers"] = analytics["outliers"]
            any_computed = True
            print(f"  [ok] {state_code}/{variable_id}  ({len(records)} municipios)")

    if not any_computed:
        return False

    data["updated_at"] = date.today().isoformat()
    combined_path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return True


def mark_analytics_available(state_codes: list[str]) -> None:
    if not MANIFEST_PATH.exists():
        return
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    for sc in state_codes:
        if sc in manifest.get("states", {}):
            manifest["states"][sc]["analytics_available"] = True
    manifest["updated_at"] = date.today().isoformat()
    MANIFEST_PATH.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def main() -> None:
    if len(sys.argv) > 1:
        state_codes = [s.upper() for s in sys.argv[1:]]
    else:
        if not MUNICIPAL_DIR.exists():
            print("No se encontró public/data/outputs/municipal/")
            return
        state_codes = [
            f.stem for f in sorted(MUNICIPAL_DIR.glob("*.json"))
            if "." not in f.stem
        ]

    if not state_codes:
        print("Sin estados para procesar.")
        return

    print(f"Calculando analytics municipales para: {', '.join(state_codes)}")
    completed = [sc for sc in state_codes if process_state(sc)]

    if completed:
        mark_analytics_available(completed)
        print(f"\nCompletados: {len(completed)}/{len(state_codes)} estados")
    else:
        print("Sin resultados (archivos no encontrados o vacíos).")


if __name__ == "__main__":
    main()
