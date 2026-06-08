"""
delete_variable.py — Elimina una variable del catálogo y todos sus archivos derivados.

Qué elimina/actualiza:
    - data/catalogs/variables.catalog.json
    - public/data/variables.catalog.json
    - public/data/state_dashboard.combined.json (metric_catalog + metrics en registros estatales)
    - public/data/outputs/state/rankings.json
    - public/data/outputs/state/distributions.json
    - public/data/outputs/state/outliers_iqr.json
    - public/data/outputs/state/univariate_stats.json
    - public/data/outputs/state/univariate_stats.csv
    - public/data/outputs/state/combined_data.csv  (elimina columna)
    - public/data/outputs/state/correlations.json  (elimina fila+columna de matrix)
    - public/data/outputs/state/state_cards.json
    - Si está en temporal/manifest.json: elimina temporal/{id}.json y {id}.forecast.json, actualiza manifest
    - Si está en municipal_manifest.json: elimina variable de cada state json, actualiza manifest
"""

from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

import pandas as pd

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PUBLIC_DATA_DIR = PROJECT_ROOT / "public" / "data"
COMBINED_PATH = PUBLIC_DATA_DIR / "state_dashboard.combined.json"
TEMPORAL_DIR = PUBLIC_DATA_DIR / "outputs" / "temporal"
MUNICIPAL_DIR = PUBLIC_DATA_DIR / "outputs" / "municipal"
TEMPORAL_MANIFEST_PATH = TEMPORAL_DIR / "manifest.json"
MUNICIPAL_MANIFEST_PATH = PUBLIC_DATA_DIR / "municipal_manifest.json"
CATALOG_PATH = PROJECT_ROOT / "data" / "catalogs" / "variables.catalog.json"
PUBLIC_CATALOG_PATH = PUBLIC_DATA_DIR / "variables.catalog.json"
STATE_OUTPUTS_DIR = PUBLIC_DATA_DIR / "outputs" / "state"
RANKINGS_PATH = STATE_OUTPUTS_DIR / "rankings.json"
DISTRIBUTIONS_PATH = STATE_OUTPUTS_DIR / "distributions.json"
OUTLIERS_PATH = STATE_OUTPUTS_DIR / "outliers_iqr.json"
UNIVARIATE_JSON_PATH = STATE_OUTPUTS_DIR / "univariate_stats.json"
UNIVARIATE_CSV_PATH = STATE_OUTPUTS_DIR / "univariate_stats.csv"
COMBINED_CSV_PATH = STATE_OUTPUTS_DIR / "combined_data.csv"
CORRELATIONS_PATH = STATE_OUTPUTS_DIR / "correlations.json"
STATE_CARDS_PATH = STATE_OUTPUTS_DIR / "state_cards.json"


def _remove_from_catalog(path: Path, variable_id: str) -> bool:
    if not path.exists():
        print(f"  SKIP: {path.name} no encontrado")
        return False
    catalog = json.loads(path.read_text(encoding="utf-8"))
    before = len(catalog.get("variables", []))
    catalog["variables"] = [v for v in catalog.get("variables", []) if v["variable_id"] != variable_id]
    if len(catalog["variables"]) == before:
        print(f"  WARN: '{variable_id}' no encontrado en {path.name}")
        return False
    catalog["updated_at"] = str(date.today())
    path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  {path.name}: eliminado")
    return True


def _remove_from_combined(variable_id: str) -> bool:
    if not COMBINED_PATH.exists():
        return False
    combined = json.loads(COMBINED_PATH.read_text(encoding="utf-8"))
    before = len(combined.get("metric_catalog", []))
    combined["metric_catalog"] = [
        m for m in combined.get("metric_catalog", []) if m["variable_id"] != variable_id
    ]
    changed = len(combined["metric_catalog"]) < before

    for record in combined.get("records", []):
        if variable_id in record.get("metrics", {}):
            del record["metrics"][variable_id]
            changed = True

    if changed:
        combined["updated_at"] = str(date.today())
        COMBINED_PATH.write_text(json.dumps(combined, ensure_ascii=False, indent=2), encoding="utf-8")
        print("  combined.json: eliminado de metric_catalog y registros estatales")
    return changed


def _remove_temporal(variable_id: str) -> bool:
    if not TEMPORAL_MANIFEST_PATH.exists():
        return False
    manifest = json.loads(TEMPORAL_MANIFEST_PATH.read_text(encoding="utf-8"))
    if variable_id not in manifest.get("variables", []):
        return False

    manifest["variables"] = [v for v in manifest["variables"] if v != variable_id]
    if "metadata" in manifest and variable_id in manifest["metadata"]:
        del manifest["metadata"][variable_id]
    manifest["updated_at"] = str(date.today())
    TEMPORAL_MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print("  temporal/manifest.json: actualizado")

    for suffix in ("", ".forecast"):
        f = TEMPORAL_DIR / f"{variable_id}{suffix}.json"
        if f.exists():
            f.unlink()
            print(f"  temporal/{f.name}: eliminado")
    return True


def _remove_municipal(variable_id: str) -> bool:
    if not MUNICIPAL_MANIFEST_PATH.exists():
        return False
    manifest = json.loads(MUNICIPAL_MANIFEST_PATH.read_text(encoding="utf-8"))
    states_with_var = [
        code
        for code, entry in manifest.get("states", {}).items()
        if variable_id in entry.get("variables", [])
    ]
    if not states_with_var:
        return False

    for state_code in states_with_var:
        state_file = MUNICIPAL_DIR / f"{state_code}.json"
        if not state_file.exists():
            continue
        state_data = json.loads(state_file.read_text(encoding="utf-8"))
        if variable_id in state_data.get("variables", {}):
            del state_data["variables"][variable_id]
            state_data["updated_at"] = str(date.today())
            state_file.write_text(json.dumps(state_data, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"  municipal/{state_code}.json: variable eliminada")
        manifest["states"][state_code]["variables"] = [
            v for v in manifest["states"][state_code]["variables"] if v != variable_id
        ]

    manifest["updated_at"] = str(date.today())
    MUNICIPAL_MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  municipal_manifest.json: actualizado ({len(states_with_var)} estado(s))")
    return True


def _remove_state_outputs(variable_id: str) -> None:
    """Elimina la variable de todos los outputs analíticos de granularidad estatal."""

    # rankings.json, distributions.json, outliers_iqr.json, univariate_stats.json
    # — todos tienen la misma estructura: { variable_id: {...} }
    for path in (RANKINGS_PATH, DISTRIBUTIONS_PATH, OUTLIERS_PATH, UNIVARIATE_JSON_PATH):
        if not path.exists():
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        if variable_id in data:
            del data[variable_id]
            path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"  {path.name}: entrada eliminada")

    # univariate_stats.csv — filas indexadas por variable_id
    if UNIVARIATE_CSV_PATH.exists():
        df = pd.read_csv(UNIVARIATE_CSV_PATH, index_col=0)
        if variable_id in df.index:
            df = df.drop(index=variable_id)
            df.to_csv(UNIVARIATE_CSV_PATH, encoding="utf-8")
            print(f"  {UNIVARIATE_CSV_PATH.name}: fila eliminada")

    # combined_data.csv — columna por variable_id
    if COMBINED_CSV_PATH.exists():
        df = pd.read_csv(COMBINED_CSV_PATH, encoding="utf-8")
        if variable_id in df.columns:
            df = df.drop(columns=[variable_id])
            df.to_csv(COMBINED_CSV_PATH, index=False, encoding="utf-8")
            print(f"  {COMBINED_CSV_PATH.name}: columna eliminada")

    # correlations.json — elimina fila+columna en matrix y entry en variables (pearson + spearman)
    if CORRELATIONS_PATH.exists():
        corr = json.loads(CORRELATIONS_PATH.read_text(encoding="utf-8"))
        changed = False
        for method in ("pearson", "spearman"):
            if method not in corr:
                continue
            variables = corr[method].get("variables", [])
            if variable_id not in variables:
                continue
            idx = variables.index(variable_id)
            corr[method]["variables"] = [v for v in variables if v != variable_id]
            matrix = corr[method].get("matrix", [])
            matrix = [row[:idx] + row[idx + 1:] for i, row in enumerate(matrix) if i != idx]
            corr[method]["matrix"] = matrix
            changed = True
        if changed:
            CORRELATIONS_PATH.write_text(json.dumps(corr, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"  {CORRELATIONS_PATH.name}: variable eliminada de matrix y lista")

    # state_cards.json — elimina la métrica de cada estado
    if STATE_CARDS_PATH.exists():
        cards = json.loads(STATE_CARDS_PATH.read_text(encoding="utf-8"))
        changed = False
        for state_data in cards.values():
            metrics = state_data.get("metrics", {})
            if variable_id in metrics:
                del metrics[variable_id]
                changed = True
        if changed:
            STATE_CARDS_PATH.write_text(json.dumps(cards, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"  {STATE_CARDS_PATH.name}: métrica eliminada de todos los estados")


def delete_variable(variable_id: str) -> None:
    print(f"Eliminando variable: {variable_id}")
    _remove_from_catalog(CATALOG_PATH, variable_id)
    _remove_from_catalog(PUBLIC_CATALOG_PATH, variable_id)
    _remove_from_combined(variable_id)
    _remove_state_outputs(variable_id)
    _remove_temporal(variable_id)
    _remove_municipal(variable_id)
    print(f"✓ Variable '{variable_id}' eliminada correctamente.")


def main() -> None:
    if len(sys.argv) < 2:
        print("Uso: python scripts/delete_variable.py <variable_id>")
        sys.exit(1)
    delete_variable(sys.argv[1])


if __name__ == "__main__":
    main()
