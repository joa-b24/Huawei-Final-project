"""
update_variable_metadata.py — Actualiza metadatos de una variable en el catálogo y archivos derivados.

Uso:
    python scripts/update_variable_metadata.py <archivo.json>
    python scripts/update_variable_metadata.py          # procesa todos los *_metadata.json en imports/

Qué actualiza:
    - data/catalogs/variables.catalog.json
    - public/data/variables.catalog.json
    - public/data/state_dashboard.combined.json → metric_catalog[].label / .unidad / .categoria_id
      (solo si cambiaron nombre, unidad_base o categoria_id)

Payload esperado (escrito por vite-plugin-pipeline):
    {
      "variable_id": "...",
      "catalog_entry": { ...VariableCatalogEntry... }
    }
"""

from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PUBLIC_DATA_DIR = PROJECT_ROOT / "public" / "data"
COMBINED_PATH = PUBLIC_DATA_DIR / "state_dashboard.combined.json"
TEMPORAL_DIR = PUBLIC_DATA_DIR / "outputs" / "temporal"
MUNICIPAL_DIR = PUBLIC_DATA_DIR / "outputs" / "municipal"
IMPORTS_DIR = PROJECT_ROOT / "data" / "processed" / "imports"
CATALOG_PATH = PROJECT_ROOT / "data" / "catalogs" / "variables.catalog.json"
PUBLIC_CATALOG_PATH = PUBLIC_DATA_DIR / "variables.catalog.json"

# Campos que, si cambian, requieren actualizar combined.json
COMBINED_FIELDS = {"nombre", "unidad_base", "categoria_id"}


def _find_payload_files(explicit: str | None) -> list[Path]:
    if explicit:
        p = Path(explicit)
        return [p] if p.exists() else []
    return list(IMPORTS_DIR.glob("*_metadata.json"))


def _update_catalog(path: Path, variable_id: str, new_entry: dict) -> bool:
    catalog = json.loads(path.read_text(encoding="utf-8"))
    changed = False
    for v in catalog["variables"]:
        if v["variable_id"] == variable_id:
            for k, val in new_entry.items():
                if k == "variable_id":
                    continue
                if v.get(k) != val:
                    v[k] = val
                    changed = True
            break
    else:
        print(f"  WARN: variable '{variable_id}' no encontrada en {path.name}")
        return False

    if changed:
        path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")
    return changed


def _update_combined(variable_id: str, new_entry: dict, old_entry: dict) -> bool:
    changed_fields = {f for f in COMBINED_FIELDS if new_entry.get(f) != old_entry.get(f)}
    if not changed_fields:
        return False

    combined = json.loads(COMBINED_PATH.read_text(encoding="utf-8"))
    updated = False
    for m in combined.get("metric_catalog", []):
        if m["variable_id"] == variable_id:
            if "nombre" in changed_fields:
                m["label"] = new_entry["nombre"]
            if "unidad_base" in changed_fields:
                m["unidad"] = new_entry["unidad_base"]
            if "categoria_id" in changed_fields:
                m["categoria_id"] = new_entry["categoria_id"]
            combined["updated_at"] = str(date.today())
            updated = True
            break

    if updated:
        COMBINED_PATH.write_text(
            json.dumps(combined, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(f"  combined.json actualizado ({', '.join(sorted(changed_fields))})")
    return updated


def process_file(payload_path: Path) -> None:
    payload = json.loads(payload_path.read_text(encoding="utf-8"))
    variable_id: str = payload["variable_id"]
    new_entry: dict = payload["catalog_entry"]

    print(f"Actualizando metadatos: {variable_id}")

    # Leer entrada anterior del catálogo para detectar cambios
    catalog_data = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    old_entry = next(
        (v for v in catalog_data["variables"] if v["variable_id"] == variable_id), {}
    )

    # Actualizar ambos catálogos
    for path in (CATALOG_PATH, PUBLIC_CATALOG_PATH):
        changed = _update_catalog(path, variable_id, new_entry)
        status = "actualizado" if changed else "sin cambios"
        print(f"  {path.name}: {status}")

    # Actualizar combined.json si cambiaron campos relevantes
    _update_combined(variable_id, new_entry, old_entry)

    # Los archivos temporal/{variable_id}.json y municipal/{state}/{variable_id}.json
    # solo almacenan variable_id + registros numéricos (sin campo nombre/label).
    # El label se resuelve siempre desde el catálogo en runtime → no requieren actualización.
    temporal_file = TEMPORAL_DIR / f"{variable_id}.json"
    if temporal_file.exists():
        print(f"  Datos históricos: {temporal_file.name} (identificado por variable_id, sin cambios)")

    if MUNICIPAL_DIR.exists():
        mun_states = [d for d in MUNICIPAL_DIR.iterdir() if (d / f"{variable_id}.json").exists()]
        if mun_states:
            print(f"  Datos municipales: {len(mun_states)} estado(s) (identificados por variable_id, sin cambios)")

    # Eliminar archivo de payload
    payload_path.unlink()
    print(f"  Payload eliminado: {payload_path.name}")


def main(explicit_file: str | None = None) -> None:
    files = _find_payload_files(explicit_file)
    if not files:
        print("No hay archivos de metadata pendientes.")
        return
    for f in files:
        process_file(f)


if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else None
    main(arg)
