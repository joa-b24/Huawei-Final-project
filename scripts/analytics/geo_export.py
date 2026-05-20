"""Normaliza claves geoestadísticas antes de exportar JSON (evita 01 -> 1)."""
from __future__ import annotations

import pandas as pd


def normalize_geo_columns(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    if "cvegeo" in out.columns:
        out["cvegeo"] = out["cvegeo"].astype(str).str.replace(r"\.0$", "", regex=True).str.zfill(5)
    if "cve_ent" in out.columns:
        if "cvegeo" in out.columns:
            out["cve_ent"] = out["cvegeo"].str.slice(0, 2)
        else:
            out["cve_ent"] = out["cve_ent"].astype(str).str.replace(r"\.0$", "", regex=True).str.zfill(2)
    return out
