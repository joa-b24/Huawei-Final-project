#!/usr/bin/env python3
"""
import_variable.py — Fusiona un JSON exportado desde el wizard al wide dataset correspondiente.

Uso:
    python3 scripts/import_variable.py <archivo.json>
    python3 scripts/import_variable.py          # procesa todos los archivos en data/processed/imports/

El archivo se elimina después de procesarse (no es la fuente de verdad; esa es el wide JSON).

Operaciones soportadas:
    nueva_variable  — añade la variable al metric_catalog y agrega valores (granularidad estatal)
    actualizar      — reemplaza valores existentes (estatal)
    modificar       — alias de actualizar
    completar       — solo rellena donde el valor es null o no existe (estatal)
    historico       — crea/actualiza data/processed/historical/{variable_id}.json

Pendiente:
    municipal       — requiere definir estructura de wide municipal
"""

from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"
HISTORICAL_DIR = PROCESSED_DIR / "historical"
IMPORTS_DIR = PROCESSED_DIR / "imports"
CATALOG_PATH = PROJECT_ROOT / "data" / "catalogs" / "variables.catalog.json"

CATEGORY_TO_WIDE: dict[str, str] = {
    "infraestructura_digital": "endutih_2024_state_dashboard.wide.json",
    "cobertura_red": "endutih_2024_state_dashboard.wide.json",
}
DEFAULT_WIDE = "context_variables_state_dashboard.wide.json"

STATE_OPS = {"nueva_variable", "actualizar", "modificar", "completar"}


# ── Helpers ───────────────────────────────────────────────────────────────────

def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  Guardado: {path.relative_to(PROJECT_ROOT)}")


def find_catalog_entry(variable_id: str) -> dict | None:
    if not CATALOG_PATH.exists():
        return None
    catalog = load_json(CATALOG_PATH)
    return next((v for v in catalog.get("variables", []) if v["variable_id"] == variable_id), None)


def resolve_wide_path(variable_id: str) -> Path:
    entry = find_catalog_entry(variable_id)
    categoria = entry.get("categoria_id", "") if entry else ""
    return PROCESSED_DIR / CATEGORY_TO_WIDE.get(categoria, DEFAULT_WIDE)


def _save_to_catalog(entry: dict) -> None:
    CATALOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    catalog = load_json(CATALOG_PATH) if CATALOG_PATH.exists() else {"variables": []}
    existing = {v["variable_id"] for v in catalog.get("variables", [])}
    if entry.get("variable_id") in existing:
        return
    catalog.setdefault("variables", []).append(entry)
    save_json(CATALOG_PATH, catalog)
    print(f"  + Añadida a variables.catalog.json: {entry.get('variable_id')}")


# ── Merge: estatal (nueva_variable / actualizar / completar) ──────────────────

def merge_state(imp: dict, operation: str) -> None:
    variable_id: str = imp["variable_id"]
    records: list[dict] = imp.get("records", [])

    incoming: dict[str, float | None] = {
        r["state_code"]: r.get("metrics", {}).get(variable_id)
        for r in records if r.get("state_code")
    }
    if not incoming:
        print("  ✗ No se encontraron registros válidos.")
        return

    wide_path = resolve_wide_path(variable_id)
    if not wide_path.exists():
        print(f"  ✗ Wide JSON no encontrado: {wide_path.name}. Corre primero el ETL.")
        return

    wide = load_json(wide_path)

    if operation == "nueva_variable":
        existing_ids = {m["variable_id"] for m in wide.get("metric_catalog", [])}
        if variable_id not in existing_ids:
            cat = imp.get("catalog_entry") or find_catalog_entry(variable_id) or {}
            entry = {
                "variable_id": variable_id,
                "label": cat.get("nombre") or cat.get("label") or variable_id,
                "unidad": cat.get("unidad_base") or cat.get("unidad") or "",
                "categoria_id": cat.get("categoria_id", ""),
            }
            wide.setdefault("metric_catalog", []).append(entry)
            print(f"  + Añadida al metric_catalog: {variable_id}")
            _save_to_catalog(cat if cat else {"variable_id": variable_id})

    updated = skipped = 0
    not_found = set(incoming.keys())

    for record in wide.get("records", []):
        sc = record.get("state_code", "")
        if sc not in incoming:
            continue
        not_found.discard(sc)
        new_val = incoming[sc]
        if operation == "completar" and record.get("metrics", {}).get(variable_id) is not None:
            skipped += 1
            continue
        if new_val is not None:
            record.setdefault("metrics", {})[variable_id] = new_val
            updated += 1

    wide["updated_at"] = date.today().isoformat()
    save_json(wide_path, wide)

    print(f"  ✓ {updated} estados actualizados, {skipped} omitidos (completar)")
    if not_found:
        print(f"  ⚠ state_codes no encontrados en wide: {', '.join(sorted(not_found))}")


# ── Merge: histórico ──────────────────────────────────────────────────────────

def merge_historical(imp: dict) -> None:
    variable_id: str = imp["variable_id"]
    records: list[dict] = imp.get("records", [])

    incoming: list[dict] = []
    for r in records:
        sc = r.get("state_code", "")
        year = r.get("anio") or r.get("year")
        val = r.get("metrics", {}).get(variable_id)
        if sc and year is not None and val is not None:
            incoming.append({"state_code": sc, "year": int(year), "value": float(val)})

    if not incoming:
        print("  ✗ No se encontraron registros válidos (se requieren state_code, year y value).")
        return

    HISTORICAL_DIR.mkdir(parents=True, exist_ok=True)
    hist_path = HISTORICAL_DIR / f"{variable_id}.json"

    if hist_path.exists():
        existing = load_json(hist_path)
        # Índice por (state_code, year) para merge
        index: dict[tuple, dict] = {
            (r["state_code"], r["year"]): r
            for r in existing.get("records", [])
        }
    else:
        existing = {"variable_id": variable_id}
        index = {}

    added = updated = 0
    for r in incoming:
        key = (r["state_code"], r["year"])
        if key in index:
            index[key]["value"] = r["value"]
            updated += 1
        else:
            index[key] = r
            added += 1

    existing["updated_at"] = date.today().isoformat()
    existing["records"] = sorted(index.values(), key=lambda r: (r["state_code"], r["year"]))
    save_json(hist_path, existing)
    print(f"  ✓ {added} registros añadidos, {updated} actualizados → {hist_path.name}")


# ── Dispatcher ────────────────────────────────────────────────────────────────

def process(import_path: Path) -> None:
    imp = load_json(import_path)
    variable_id: str = imp.get("variable_id", "?")
    operation: str = imp.get("operation", "")
    granularity: str = imp.get("granularity", "state")

    print(f"  variable: {variable_id}  |  op: {operation}  |  granularity: {granularity}")

    if granularity == "municipal":
        print("  ⚠ Granularidad municipal pendiente de implementar.")
    elif operation == "historico":
        merge_historical(imp)
    elif operation in STATE_OPS:
        merge_state(imp, operation)
    else:
        print(f"  ✗ Operación desconocida: '{operation}'.")
        return

    import_path.unlink()
    print(f"  → Archivo eliminado (ya integrado al wide JSON).")


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    IMPORTS_DIR.mkdir(parents=True, exist_ok=True)

    if len(sys.argv) > 1:
        targets = [Path(sys.argv[1])]
    else:
        targets = sorted(IMPORTS_DIR.glob("*.json"))
        if not targets:
            print("No hay archivos en data/processed/imports/.")
            print("Coloca ahí el JSON exportado desde el wizard y vuelve a correr.")
            return

    for path in targets:
        print(f"\nProcesando: {path.name}")
        try:
            process(path)
        except Exception as e:
            print(f"  ✗ Error: {e}")

    print("\nDone. Ejecuta ahora:")
    print("  python3 scripts/analytics/layer1_descriptive.py")
    print("  python3 scripts/publish.py")


if __name__ == "__main__":
    main()
