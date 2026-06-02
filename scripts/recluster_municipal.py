#!/usr/bin/env python3
"""Reasigna clusters k=3 por estado en municipios_master_analytics.json existente."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from analytics.geo_export import normalize_geo_columns
from build_municipal_analytics import assign_clusters_national

ROOT = Path(__file__).resolve().parent.parent
PATHS = [
    ROOT / "public" / "data" / "municipios_master_analytics.json",
    ROOT / "data" / "processed" / "municipios_master_analytics.json",
]


def main() -> None:
    src = next((p for p in PATHS if p.is_file()), None)
    if src is None:
        raise SystemExit("No se encontró municipios_master_analytics.json")

    df = pd.DataFrame(json.loads(src.read_text(encoding="utf-8")))
    df, n_clustered, cluster_k, cid_to_label = assign_clusters_national(df)
    df = normalize_geo_columns(df)

    records = json.loads(df.to_json(orient="records", force_ascii=False))
    text = json.dumps(records, ensure_ascii=False, indent=2)
    for p in PATHS:
        if p.parent.is_dir():
            p.write_text(text, encoding="utf-8")
            print(f"Actualizado: {p} ({len(records)} municipios, {n_clustered} con grupo, k={cluster_k})")

    dash_path = ROOT / "public" / "data" / "state_analytics_dashboard.json"
    if dash_path.is_file():
        dash = json.loads(dash_path.read_text(encoding="utf-8"))
        nat = dash.setdefault("national", {})
        nat["kmeans_k"] = cluster_k
        nat["kmeans_scope"] = "national"
        nat["cluster_labels"] = {str(cid): lab for cid, lab in cid_to_label.items()}
        nat.pop("kmeans_silhouette", None)
        dash_path.write_text(json.dumps(dash, ensure_ascii=False, indent=2), encoding="utf-8")
        proc_dash = ROOT / "data" / "processed" / "state_analytics_dashboard.json"
        if proc_dash.parent.is_dir():
            proc_dash.write_text(dash_path.read_text(encoding="utf-8"), encoding="utf-8")
        print(f"Actualizado metadata: {dash_path.name}")


if __name__ == "__main__":
    main()
