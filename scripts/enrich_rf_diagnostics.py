#!/usr/bin/env python3
"""Enriquece municipios_master_analytics.json y state_analytics_dashboard.json con diagnóstico RF."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from analytics.geo_export import normalize_geo_columns
from analytics.rf_coverage import apply_rf_coverage_diagnostics

ROOT = SCRIPTS_DIR.parent
PUBLIC = ROOT / "public" / "data"
PROCESSED = ROOT / "data" / "processed"


def main() -> None:
    for base in (PROCESSED, PUBLIC):
        mun_path = base / "municipios_master_analytics.json"
        dash_path = base / "state_analytics_dashboard.json"
        if not mun_path.exists():
            continue
        df = pd.read_json(mun_path)
        df = normalize_geo_columns(df)
        df, rf_national, rf_state = apply_rf_coverage_diagnostics(df)
        df = normalize_geo_columns(df)
        mun_path.write_text(df.to_json(orient="records", force_ascii=False, indent=2), encoding="utf-8")
        print(f"Actualizado {mun_path} ({len(df)} municipios)")

        if dash_path.exists():
            dash = json.loads(dash_path.read_text(encoding="utf-8"))
            dash.setdefault("national", {})["rf_feature_importances"] = rf_national
            for row in dash.get("states", []):
                cve = str(row.get("cve_ent", ""))
                row["rf_feature_importances"] = rf_state.get(cve, rf_national)
            dash_path.write_text(json.dumps(dash, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"Actualizado {dash_path}")


if __name__ == "__main__":
    main()
