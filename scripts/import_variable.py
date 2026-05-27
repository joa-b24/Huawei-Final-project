#!/usr/bin/env python3
"""
import_variable.py — Importa datos del wizard directamente al combined JSON y regenera analytics.

Uso:
    python scripts/import_variable.py <archivo.json>
    python scripts/import_variable.py          # procesa todos los archivos en data/processed/imports/

Operaciones:
    nueva_variable  — registra variable en metric_catalog + agrega valores estatales
    actualizar      — reemplaza valores existentes (estatal)
    completar       — solo rellena donde el valor es null o no existe (estatal)
    historico       — crea/actualiza public/data/outputs/temporal/{variable_id}.json
    municipal       — persiste por municipio + agrega a nivel estatal

Escribe directamente en state_dashboard.combined.json.
Los archivos endutih y context_variables son fuentes de solo lectura.

ADVERTENCIA: npm run data:combine regenera el combined desde los wide files y
sobreescribirá variables importadas por el wizard. Correr combine solo para
actualizaciones de fuentes originales, no de forma rutinaria.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from datetime import date
from pathlib import Path
from statistics import mean

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PUBLIC_DATA_DIR = PROJECT_ROOT / "public" / "data"
COMBINED_PATH = PUBLIC_DATA_DIR / "state_dashboard.combined.json"
TEMPORAL_DIR = PUBLIC_DATA_DIR / "outputs" / "temporal"
TEMPORAL_MANIFEST_PATH = TEMPORAL_DIR / "manifest.json"
MUNICIPAL_DIR = PUBLIC_DATA_DIR / "outputs" / "municipal"
MANIFEST_PATH = PUBLIC_DATA_DIR / "municipal_manifest.json"
IMPORTS_DIR = PROJECT_ROOT / "data" / "processed" / "imports"
CATALOG_PATH = PROJECT_ROOT / "data" / "catalogs" / "variables.catalog.json"
PUBLIC_CATALOG_PATH = PUBLIC_DATA_DIR / "variables.catalog.json"

STATE_OPS = {"nueva_variable", "actualizar", "completar"}

# Mapping from INEGI 2-digit numeric codes to 3-letter abbreviations used in combined JSON
_INEGI_TO_CODE: dict[str, str] = {
    "01": "AGS", "02": "BCN", "03": "BCS", "04": "CAM",
    "05": "COA", "06": "COL", "07": "CHP", "08": "CHH",
    "09": "CMX", "10": "DUR", "11": "GUA", "12": "GRO",
    "13": "HID", "14": "JAL", "15": "MEX", "16": "MIC",
    "17": "MOR", "18": "NAY", "19": "NLE", "20": "OAX",
    "21": "PUE", "22": "QUE", "23": "ROO", "24": "SLP",
    "25": "SIN", "26": "SON", "27": "TAB", "28": "TAM",
    "29": "TLA", "30": "VER", "31": "YUC", "32": "ZAC",
}


def _normalize_state_code(sc: str, valid_codes: set[str] | None = None) -> str:
    """Normalize a state_code to the 3-letter format used in combined JSON.

    Accepts: 3-letter codes (AGS), 2-digit INEGI strings ("09"), or integers as strings ("9").
    If valid_codes is provided and sc is already in it, returns sc unchanged.
    """
    if valid_codes and sc in valid_codes:
        return sc
    padded = sc.zfill(2)
    return _INEGI_TO_CODE.get(padded, sc)


# ── Helpers ───────────────────────────────────────────────────────────────────

def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  Guardado: {path.relative_to(PROJECT_ROOT)}")


def find_catalog_entry(variable_id: str) -> dict | None:
    for path in (PUBLIC_CATALOG_PATH, CATALOG_PATH):
        if not path.exists():
            continue
        catalog = load_json(path)
        entry = next((v for v in catalog.get("variables", []) if v["variable_id"] == variable_id), None)
        if entry:
            return entry
    return None


def _save_to_catalog(entry: dict) -> None:
    """Write catalog entry to both the source catalog and the public catalog."""
    variable_id = entry.get("variable_id")
    if not variable_id:
        return
    for path in (CATALOG_PATH, PUBLIC_CATALOG_PATH):
        path.parent.mkdir(parents=True, exist_ok=True)
        catalog = load_json(path) if path.exists() else {"variables": []}
        existing = {v["variable_id"] for v in catalog.get("variables", [])}
        if variable_id in existing:
            continue
        catalog.setdefault("variables", []).append(entry)
        save_json(path, catalog)
    print(f"  + Añadida a variables.catalog.json: {variable_id}")


def _load_combined() -> dict:
    if not COMBINED_PATH.exists():
        print("  ⚠ state_dashboard.combined.json no encontrado, generando desde wide files...")
        combine_script = PROJECT_ROOT / "scripts" / "combine_data.py"
        result = subprocess.run(
            [sys.executable, str(combine_script)],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        if result.returncode != 0 or not COMBINED_PATH.exists():
            raise RuntimeError(
                f"No se pudo generar el combined: {result.stderr.strip()}"
            )
        print("  ✓ combined generado.")
    return load_json(COMBINED_PATH)


# ── Pipeline trigger ──────────────────────────────────────────────────────────

def _run(cmd: list[str], label: str) -> bool:
    """Run a subprocess with forced UTF-8 I/O, print output, return True on success."""
    env = os.environ.copy()
    env["PYTHONUTF8"] = "1"
    env["PYTHONIOENCODING"] = "utf-8"
    result = subprocess.run(
        cmd,
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=env,
    )
    for line in result.stdout.strip().splitlines():
        print(f"    {line}")
    if result.returncode != 0:
        print(f"  ✗ {label} falló (código {result.returncode}):")
        for line in result.stderr.strip().splitlines():
            print(f"    {line}")
        return False
    return True


def trigger_layer1(variable_id: str) -> None:
    """Regenera analytics (distributions, rankings, correlations) para la variable importada."""
    layer1_script = PROJECT_ROOT / "scripts" / "analytics" / "layer1_descriptive.py"
    if not layer1_script.exists():
        print("  ⚠ layer1_descriptive.py no encontrado, omitiendo analytics.")
        return
    print(f"  → Ejecutando layer1_descriptive.py --new-vars {variable_id}...")
    _run([sys.executable, str(layer1_script), "--new-vars", variable_id], "layer1_descriptive.py")


def trigger_municipal_analytics(state_codes: list[str]) -> None:
    """layer1_municipal síncrono para los estados dados."""
    script = PROJECT_ROOT / "scripts" / "analytics" / "layer1_municipal.py"
    if not script.exists():
        return
    print(f"  → Ejecutando layer1_municipal.py para: {', '.join(state_codes)}")
    _run([sys.executable, str(script)] + state_codes, "layer1_municipal.py")


# ── Merge: estatal ────────────────────────────────────────────────────────────

def merge_state(imp: dict, operation: str) -> None:
    variable_id: str = imp["variable_id"]
    records: list[dict] = imp.get("records", [])

    combined = _load_combined()
    valid_codes = {r.get("state_code", "") for r in combined.get("records", [])}

    incoming: dict[str, float | None] = {
        _normalize_state_code(str(r["state_code"]), valid_codes): r.get("metrics", {}).get(variable_id)
        for r in records if r.get("state_code") is not None
    }
    if not incoming:
        print("  ✗ No se encontraron registros válidos.")
        return

    if operation == "nueva_variable":
        existing_ids = {m["variable_id"] for m in combined.get("metric_catalog", [])}
        if variable_id not in existing_ids:
            cat = imp.get("catalog_entry") or find_catalog_entry(variable_id) or {}
            combined.setdefault("metric_catalog", []).append({
                "variable_id": variable_id,
                "label": cat.get("nombre") or cat.get("label") or variable_id,
                "unidad": cat.get("unidad_base") or cat.get("unidad") or "",
                "categoria_id": cat.get("categoria_id", ""),
            })
            print(f"  + Añadida al metric_catalog: {variable_id}")
            _save_to_catalog(cat if cat else {"variable_id": variable_id})

    updated = skipped = 0
    not_found = set(incoming.keys())

    for record in combined.get("records", []):
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

    combined["updated_at"] = date.today().isoformat()
    save_json(COMBINED_PATH, combined)
    print(f"  ✓ {updated} estados actualizados, {skipped} omitidos (completar)")
    if not_found:
        print(f"  ⚠ state_codes no encontrados: {', '.join(sorted(not_found))}")


# ── Merge: municipal ──────────────────────────────────────────────────────────

def _agg(values: list[float], method: str) -> float:
    if method == "sum":
        return sum(values)
    return mean(values)


def _year_in_combined_catalog(combined: dict, variable_id: str) -> int | None:
    for m in combined.get("metric_catalog", []):
        if m.get("variable_id") == variable_id:
            return m.get("anio")
    return None


def update_municipal_manifest(variable_id: str, state_codes: list[str]) -> None:
    manifest: dict = load_json(MANIFEST_PATH) if MANIFEST_PATH.exists() else {
        "updated_at": "", "states": {}
    }
    for sc in state_codes:
        entry = manifest["states"].setdefault(sc, {"variables": [], "analytics_available": False})
        if variable_id not in entry["variables"]:
            entry["variables"].append(variable_id)
    manifest["updated_at"] = date.today().isoformat()
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  ✓ municipal_manifest.json actualizado")


def merge_municipal(imp: dict) -> None:
    variable_id: str = imp["variable_id"]
    records: list[dict] = imp.get("records", [])

    by_state: dict[str, list[dict]] = {}
    year_incoming: int | None = None
    for r in records:
        raw_sc = str(r.get("state_code", "")).strip()
        cve_mun = str(r.get("cve_mun", "")).strip()
        # Derive state_code from cve_mun: zero-pad to 5 digits first so that
        # 4-digit codes (states 1-9, e.g. "5012") resolve correctly to "05"
        if not raw_sc and len(cve_mun) >= 4:
            raw_sc = cve_mun.zfill(5)[:2]
        sc = _normalize_state_code(raw_sc) if raw_sc else ""
        val = r.get("metrics", {}).get(variable_id)
        yr = r.get("anio") or r.get("year")
        if not sc or not cve_mun or val is None:
            continue
        if yr is not None:
            year_incoming = int(yr)
        by_state.setdefault(sc, []).append({
            "cve_mun": str(cve_mun),
            "value": float(val),
            "year": year_incoming,
        })

    if not by_state:
        print("  ✗ No se encontraron registros municipales válidos (requiere state_code, cve_mun, value).")
        return

    cat_entry = find_catalog_entry(variable_id) or {}
    agg_method = cat_entry.get("agregacion_default", "avg")

    # Persist municipal data — merged into combined per-state file
    for state_code, mun_records in by_state.items():
        combined_path = MUNICIPAL_DIR / f"{state_code}.json"
        if combined_path.exists():
            combined_state = load_json(combined_path)
        else:
            MUNICIPAL_DIR.mkdir(parents=True, exist_ok=True)
            combined_state = {"state_code": state_code, "updated_at": "", "variables": {}}
        combined_state["variables"][variable_id] = {
            "year": year_incoming,
            "records": sorted(mun_records, key=lambda r: r["cve_mun"]),
        }
        combined_state["updated_at"] = date.today().isoformat()
        combined_path.write_text(json.dumps(combined_state, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"  Guardado: outputs/municipal/{state_code}.json (+{variable_id}, {len(mun_records)} municipios)")

    update_municipal_manifest(variable_id, list(by_state.keys()))

    # Always aggregate to state level — year conflict warning is handled in the wizard UI.
    combined = _load_combined()
    year_state = _year_in_combined_catalog(combined, variable_id)
    reason = "variable nueva en combined" if year_state is None else f"año municipal {year_incoming}, reemplaza año estatal {year_state}"
    print(f"  → Agregando a nivel estatal en combined ({reason}, método: {agg_method})...")

    # Register in metric_catalog if missing
    existing_ids = {m["variable_id"] for m in combined.get("metric_catalog", [])}
    if variable_id not in existing_ids:
        cat = imp.get("catalog_entry") or cat_entry or {}
        combined.setdefault("metric_catalog", []).append({
            "variable_id": variable_id,
            "label": cat.get("nombre") or cat.get("label") or variable_id,
            "unidad": cat.get("unidad_base") or cat.get("unidad") or "",
            "categoria_id": cat.get("categoria_id", ""),
            "anio": year_incoming,
        })
        print(f"  + Añadida al metric_catalog (municipal): {variable_id}")
    elif year_incoming:
        for m in combined.get("metric_catalog", []):
            if m.get("variable_id") == variable_id:
                m["anio"] = year_incoming
                break

    updated = 0
    for state_code, mun_records in by_state.items():
        agg_value = _agg([r["value"] for r in mun_records], agg_method)
        for record in combined.get("records", []):
            if record.get("state_code") == state_code:
                record.setdefault("metrics", {})[variable_id] = agg_value
                updated += 1
                break

    combined["updated_at"] = date.today().isoformat()
    save_json(COMBINED_PATH, combined)
    print(f"  ✓ {updated} estados actualizados en combined.")

    trigger_layer1(variable_id)
    trigger_municipal_analytics(list(by_state.keys()))


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
        print("  ✗ No se encontraron registros válidos (requiere state_code, year, value).")
        return

    TEMPORAL_DIR.mkdir(parents=True, exist_ok=True)
    hist_path = TEMPORAL_DIR / f"{variable_id}.json"

    if hist_path.exists():
        existing = load_json(hist_path)
        index: dict[tuple, dict] = {
            (r["state_code"], r["year"]): r for r in existing.get("records", [])
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

    # ── Update combined.json ──────────────────────────────────────────────────
    cat = imp.get("catalog_entry") or find_catalog_entry(variable_id) or {}
    combined = _load_combined()
    valid_codes = {r.get("state_code", "") for r in combined.get("records", [])}
    combined_changed = False

    # Register in metric_catalog if missing
    existing_metric_ids = {m["variable_id"] for m in combined.get("metric_catalog", [])}
    if variable_id not in existing_metric_ids:
        combined.setdefault("metric_catalog", []).append({
            "variable_id": variable_id,
            "label": cat.get("nombre") or cat.get("label") or variable_id,
            "unidad": cat.get("unidad_base") or cat.get("unidad") or "",
            "categoria_id": cat.get("categoria_id", ""),
        })
        print(f"  + Registrada en metric_catalog: {variable_id}")
        combined_changed = True

    # Derive state-level values from the latest year in the imported series
    latest_year = max(r["year"] for r in incoming)
    latest_by_state = {
        _normalize_state_code(r["state_code"], valid_codes): r["value"]
        for r in incoming if r["year"] == latest_year
    }

    has_state_data = any(
        r.get("metrics", {}).get(variable_id) is not None
        for r in combined.get("records", [])
    )
    update_state = imp.get("update_state_level", True) if has_state_data else True

    if update_state and latest_by_state:
        state_updated = 0
        for record in combined.get("records", []):
            sc = record.get("state_code", "")
            if sc in latest_by_state:
                record.setdefault("metrics", {})[variable_id] = latest_by_state[sc]
                state_updated += 1
        for m in combined.get("metric_catalog", []):
            if m.get("variable_id") == variable_id:
                m["anio"] = latest_year
                break
        print(f"  + {state_updated} valores estatales actualizados desde año {latest_year}")
        combined_changed = True

    if combined_changed:
        combined["updated_at"] = date.today().isoformat()
        save_json(COMBINED_PATH, combined)

    # Registrar en variables.catalog.json para que aparezca en DatosTab
    full_cat_entry = {
        "variable_id": variable_id,
        "categoria_id": cat.get("categoria_id", ""),
        "nombre": cat.get("nombre") or cat.get("label") or variable_id,
        "descripcion": cat.get("descripcion", ""),
        "unidad_base": cat.get("unidad_base") or cat.get("unidad") or "",
        "tipo_valor": cat.get("tipo_valor", "number"),
        "agregacion_default": cat.get("agregacion_default", "avg"),
        "fuente_sugerida": cat.get("fuente_sugerida", ""),
        "sinonimos": cat.get("sinonimos", []),
    }
    _save_to_catalog(full_cat_entry)

    _update_temporal_manifest(variable_id, cat)

    if update_state and latest_by_state:
        trigger_layer1(variable_id)


# ── Temporal manifest ────────────────────────────────────────────────────────

def _update_temporal_manifest(variable_id: str, cat: dict) -> None:
    """Añade variable_id al manifest.json del tab Evolución si no está ya."""
    TEMPORAL_DIR.mkdir(parents=True, exist_ok=True)
    if TEMPORAL_MANIFEST_PATH.exists():
        manifest = load_json(TEMPORAL_MANIFEST_PATH)
    else:
        manifest = {"updated_at": "", "variables": [], "metadata": {}}

    if variable_id not in manifest.get("variables", []):
        manifest.setdefault("variables", []).append(variable_id)
        print(f"  + {variable_id} añadida a temporal/manifest.json")

    manifest.setdefault("metadata", {})[variable_id] = {
        "label": cat.get("nombre") or cat.get("label") or variable_id,
        "unit":  cat.get("unidad_base") or cat.get("unidad") or "",
        "source": cat.get("fuente_sugerida", ""),
    }
    manifest["updated_at"] = date.today().isoformat()
    TEMPORAL_MANIFEST_PATH.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )


# ── Dispatcher ────────────────────────────────────────────────────────────────

def process(import_path: Path) -> None:
    imp = load_json(import_path)
    variable_id: str = imp.get("variable_id", "?")
    operation: str = imp.get("operation", "")
    granularity: str = imp.get("granularity", "state")

    print(f"  variable: {variable_id}  |  op: {operation}  |  granularity: {granularity}")

    cat_entry = imp.get("catalog_entry")
    if cat_entry and cat_entry.get("variable_id") and operation != "historico":
        _save_to_catalog(cat_entry)

    if granularity == "municipal":
        merge_municipal(imp)
    elif operation == "historico":
        merge_historical(imp)
    elif operation in STATE_OPS:
        merge_state(imp, operation)
        trigger_layer1(variable_id)
    else:
        print(f"  ✗ Operación desconocida: '{operation}'.")
        return

    import_path.unlink()
    print("  → Archivo de importación eliminado.")


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    IMPORTS_DIR.mkdir(parents=True, exist_ok=True)

    if len(sys.argv) > 1:
        targets = [Path(sys.argv[1])]
    else:
        targets = sorted(IMPORTS_DIR.glob("*.json"))
        if not targets:
            print("No hay archivos en data/processed/imports/.")
            return

    for path in targets:
        print(f"\nProcesando: {path.name}")
        try:
            process(path)
        except Exception as e:
            print(f"  ✗ Error: {e}")


if __name__ == "__main__":
    main()
