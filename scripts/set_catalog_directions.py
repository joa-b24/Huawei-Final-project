"""
Añade el campo 'direction' a cada variable en variables.catalog.json.

Criterio:
  - lower_better: indicadores donde un valor menor es mejor
    (pobreza, carencias sociales, rezago educativo, ingreso bajo línea de pobreza)
  - higher_better: todos los demás (conectividad, cobertura, economía, demografía positiva)

Ejecutar UNA vez (o al añadir nuevas variables sin direction):
    python scripts/set_catalog_directions.py

El script es idempotente: no sobreescribe un campo direction ya existente a menos
que se pase --force como argumento.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CATALOG_PATH = PROJECT_ROOT / "data" / "catalogs" / "variables.catalog.json"
PUBLIC_CATALOG_PATH = PROJECT_ROOT / "public" / "data" / "variables.catalog.json"

LOWER_BETTER: set[str] = {
    "pobreza_pct",
    "pobreza_extrema_pct",
    "vulnerable_carencias_pct",
    "rezago_educativo_pct",
    "carencia_salud_pct",
    "carencia_servicios_basicos_pct",
    "ingreso_inferior_lp_pct",
}


def main(force: bool = False) -> None:
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    changed = 0

    for v in catalog["variables"]:
        vid = v["variable_id"]
        new_dir = "lower_better" if vid in LOWER_BETTER else "higher_better"

        if "direction" not in v or force:
            v["direction"] = new_dir
            changed += 1
        elif v["direction"] != new_dir:
            print(f"  SKIP {vid}: ya tiene direction='{v['direction']}' (esperado '{new_dir}'). "
                  "Usa --force para sobreescribir.")

    serialized = json.dumps(catalog, ensure_ascii=False, indent=2)
    CATALOG_PATH.write_text(serialized, encoding="utf-8")
    PUBLIC_CATALOG_PATH.write_text(serialized, encoding="utf-8")
    print(f"Catalogo actualizado: {changed} variable(s) modificadas en {CATALOG_PATH}")

    for v in catalog["variables"]:
        marker = "<-- lower_better" if v.get("direction") == "lower_better" else ""
        print(f"  {v.get('direction', 'N/A'):15} {v['variable_id']} {marker}")


if __name__ == "__main__":
    main(force="--force" in sys.argv)
