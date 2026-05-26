"""
Añade el campo 'role' a cada variable en variables.catalog.json.

Roles disponibles:
  - target      — objetivo principal de análisis (Y en OLS/correlaciones); no como predictor X.
  - explanatory — predictor/variable explicativa (X en OLS); no como objetivo Y.
  - both        — puede usarse como Y o como X (default para variables sin asignar).
  - contextual  — variable de escala/referencia; excluida del análisis estadístico.

Criterio aplicado a este proyecto:
  - target:      métricas de cobertura BIT (KPIs de conectividad Huawei).
  - explanatory: variables socioeconómicas, demográficas y de contexto territorial.
  - both:        indicadores de uso digital ENDUTIH (comportamiento de usuario).
  - contextual:  totales absolutos que funcionan solo como escala (ej. población total).

Ejecutar UNA vez (o al añadir nuevas variables sin role):
    python scripts/set_catalog_roles.py

El script es idempotente: no sobreescribe un campo role ya existente a menos
que se pase --force como argumento.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CATALOG_PATH = PROJECT_ROOT / "data" / "catalogs" / "variables.catalog.json"
PUBLIC_CATALOG_PATH = PROJECT_ROOT / "public" / "data" / "variables.catalog.json"

# ── KPIs de cobertura (objetivo del análisis Huawei) ──────────────────────────
TARGET: set[str] = {
    "localidades_con_cobertura_movil_pct",
    "poblacion_en_localidades_con_cobertura_movil_pct",
    "localidades_con_4g_garantizada_pct",
    "poblacion_en_localidades_con_4g_garantizada_pct",
    "localidades_con_5g_garantizada_pct",
    "poblacion_en_localidades_con_5g_garantizada_pct",
    "hogares_en_localidades_con_internet_pct",
    "poblacion_en_localidades_con_internet_pct",
    "teledensidad_internet_movil",
    "cobertura_4g_pct",
    "cobertura_5g_pct",
    "penetracion_movil_pct",
    "indice_conectividad_digital",
}

# ── Variables explicativas / predictores ─────────────────────────────────────
EXPLANATORY: set[str] = {
    # Bienestar social
    "pobreza_pct",
    "pobreza_extrema_pct",
    "vulnerable_carencias_pct",
    "no_pobre_no_vulnerable_pct",
    "rezago_educativo_pct",
    "carencia_salud_pct",
    "carencia_servicios_basicos_pct",
    "ingreso_inferior_lp_pct",
    # Contexto territorial
    "densidad_poblacional",
    "edad_mediana",
    "urbanizacion_pct",
    "escolaridad_promedio_anios",
    # Economía
    "pib_total",
    "pib_per_capita",
    # Industria
    "actividad_industrial_indice",
    "empleo_industrial_pct",
    "exportaciones_industriales_usd_millones",
    "inversion_extranjera_industria_usd_millones",
    # Demografía
    "poblacion_edad_laboral_pct",
    "poblacion_economicamente_activa_pct",
    "poblacion_afiliada_imss_pct",
}

# ── Solo escala/referencia, excluidas del análisis ───────────────────────────
CONTEXTUAL: set[str] = {
    "poblacion_total",
}

# Resto → "both" (default): indicadores de uso digital ENDUTIH


def main(force: bool = False) -> None:
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    changed = 0

    for v in catalog["variables"]:
        vid = v["variable_id"]

        if vid in TARGET:
            new_role = "target"
        elif vid in EXPLANATORY:
            new_role = "explanatory"
        elif vid in CONTEXTUAL:
            new_role = "contextual"
        else:
            new_role = "both"

        if "role" not in v or force:
            v["role"] = new_role
            changed += 1
        elif v["role"] != new_role:
            print(f"  SKIP {vid}: ya tiene role='{v['role']}' (esperado '{new_role}'). "
                  "Usa --force para sobreescribir.")

    serialized = json.dumps(catalog, ensure_ascii=False, indent=2)
    CATALOG_PATH.write_text(serialized, encoding="utf-8")
    PUBLIC_CATALOG_PATH.write_text(serialized, encoding="utf-8")
    print(f"Catálogo actualizado: {changed} variable(s) modificadas")
    print(f"  {CATALOG_PATH}")
    print(f"  {PUBLIC_CATALOG_PATH}")

    role_counts: dict[str, int] = {}
    for v in catalog["variables"]:
        r = v.get("role", "both")
        role_counts[r] = role_counts.get(r, 0) + 1
    for role, count in sorted(role_counts.items()):
        print(f"  {role:12} {count} variable(s)")


if __name__ == "__main__":
    main(force="--force" in sys.argv)
