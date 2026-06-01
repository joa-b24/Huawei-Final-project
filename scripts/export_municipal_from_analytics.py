"""
export_municipal_from_analytics.py — Exporta datos municipales de municipios_master_analytics.json
al formato combinado outputs/municipal/{state_code}.json y actualiza variables.catalog.json.

Uso:
    python scripts/export_municipal_from_analytics.py

Salidas:
    public/data/outputs/municipal/{state_code}.json  — 32 archivos combinados
    public/data/municipal_manifest.json
    data/catalogs/variables.catalog.json             — entradas nuevas añadidas
    public/data/variables.catalog.json               — sincronizado
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

PROJECT_ROOT        = Path(__file__).resolve().parent.parent
ANALYTICS_PATH      = PROJECT_ROOT / "data" / "processed" / "municipios_master_analytics.json"
MUNICIPAL_DIR       = PROJECT_ROOT / "public" / "data" / "outputs" / "municipal"
MANIFEST_PATH       = PROJECT_ROOT / "public" / "data" / "municipal_manifest.json"
CATALOG_PATH        = PROJECT_ROOT / "data" / "catalogs" / "variables.catalog.json"
PUBLIC_CATALOG_PATH = PROJECT_ROOT / "public" / "data" / "variables.catalog.json"
COMBINED_PATH       = PROJECT_ROOT / "public" / "data" / "state_dashboard.combined.json"

INEGI_TO_CODE: dict[str, str] = {
    "01": "AGS", "02": "BCN", "03": "BCS", "04": "CAM",
    "05": "COA", "06": "COL", "07": "CHP", "08": "CHH",
    "09": "CMX", "10": "DUR", "11": "GUA", "12": "GRO",
    "13": "HID", "14": "JAL", "15": "MEX", "16": "MIC",
    "17": "MOR", "18": "NAY", "19": "NLE", "20": "OAX",
    "21": "PUE", "22": "QUE", "23": "ROO", "24": "SLP",
    "25": "SIN", "26": "SON", "27": "TAB", "28": "TAM",
    "29": "TLA", "30": "VER", "31": "YUC", "32": "ZAC",
}

# (bit_field, variable_id, year)
MAPPING: list[tuple[str, str, int]] = [
    ("pob_pct_4g_garantizada",       "poblacion_en_localidades_con_4g_garantizada_pct", 2024),
    ("loc_pct_4g_garantizada",       "localidades_con_4g_garantizada_pct",              2024),
    ("pob_pct_movil",                "poblacion_en_localidades_con_cobertura_movil_pct",2024),
    ("loc_pct_movil",                "localidades_con_cobertura_movil_pct",             2024),
    ("pob_pct_5g_garantizada",       "poblacion_en_localidades_con_5g_garantizada_pct", 2024),
    ("loc_pct_5g_garantizada",       "localidades_con_5g_garantizada_pct",              2024),
    ("graproes",                     "escolaridad_promedio_anios",                      2020),
    ("pobtot_iter",                  "poblacion_total",                                 2020),
    ("pct_analfabetismo_15ymas",     "analfabetismo_15ymas_pct",                        2020),
    ("pct_sin_escolaridad_15ymas",   "sin_escolaridad_15ymas_pct",                      2020),
    ("pct_posbasica_18ymas",         "posbasica_18ymas_pct",                            2020),
    ("pct_pob_0_14",                 "pob_0_14_pct",                                    2020),
    ("pct_pob_15_64",                "pob_15_64_pct",                                   2020),
    ("pct_pob_65_mas",               "pob_65_mas_pct",                                  2020),
    ("localidades_n",                "localidades_total",                               2020),
    ("irs_indice",                   "irs_indice",                                      2020),
    ("irs_pct_viv_sin_agua",         "viv_sin_agua_pct",                                2020),
    ("irs_pct_viv_sin_drenaje",      "viv_sin_drenaje_pct",                             2020),
    ("irs_pct_viv_sin_luz",          "viv_sin_luz_pct",                                 2020),
    ("irs_pct_sin_derechohabiencia", "sin_derechohabiencia_pct",                        2020),
    ("ookla_int_avg_speed",          "ookla_velocidad_avg_mbps",                        2025),
    ("ookla_pct_4g",                 "ookla_cobertura_4g_pct",                          2025),
    ("brecha_4g_pp",                 "brecha_4g_pp",                                    2024),
]

NEW_CATALOG_ENTRIES: list[dict] = [
    {
        "variable_id": "analfabetismo_15ymas_pct",
        "categoria_id": "bienestar_social",
        "nombre": "Analfabetismo 15+ años",
        "descripcion": "Porcentaje de poblacion de 15 anos o mas que no sabe leer ni escribir.",
        "unidad_base": "%", "tipo_valor": "percentage",
        "agregacion_default": "avg", "direction": "lower_better",
        "role": "explanatory", "fuente_sugerida": "INEGI ITER 2020",
    },
    {
        "variable_id": "sin_escolaridad_15ymas_pct",
        "categoria_id": "bienestar_social",
        "nombre": "Sin escolaridad 15+ años",
        "descripcion": "Porcentaje de poblacion de 15 anos o mas sin ningun nivel de escolaridad.",
        "unidad_base": "%", "tipo_valor": "percentage",
        "agregacion_default": "avg", "direction": "lower_better",
        "role": "explanatory", "fuente_sugerida": "INEGI ITER 2020",
    },
    {
        "variable_id": "posbasica_18ymas_pct",
        "categoria_id": "bienestar_social",
        "nombre": "Educación posbásica 18+ años",
        "descripcion": "Porcentaje de poblacion de 18 anos o mas con educacion superior a la basica.",
        "unidad_base": "%", "tipo_valor": "percentage",
        "agregacion_default": "avg", "direction": "higher_better",
        "role": "explanatory", "fuente_sugerida": "INEGI ITER 2020",
    },
    {
        "variable_id": "pob_0_14_pct",
        "categoria_id": "demografia",
        "nombre": "Población 0–14 años (%)",
        "descripcion": "Porcentaje de la poblacion municipal en el rango de 0 a 14 anos.",
        "unidad_base": "%", "tipo_valor": "percentage",
        "agregacion_default": "avg", "direction": None,
        "role": "contextual", "fuente_sugerida": "INEGI ITER 2020",
    },
    {
        "variable_id": "pob_15_64_pct",
        "categoria_id": "demografia",
        "nombre": "Población 15–64 años (%)",
        "descripcion": "Porcentaje de la poblacion municipal en edad productiva (15 a 64 anos).",
        "unidad_base": "%", "tipo_valor": "percentage",
        "agregacion_default": "avg", "direction": None,
        "role": "contextual", "fuente_sugerida": "INEGI ITER 2020",
    },
    {
        "variable_id": "pob_65_mas_pct",
        "categoria_id": "demografia",
        "nombre": "Población 65+ años (%)",
        "descripcion": "Porcentaje de la poblacion municipal de 65 anos o mas.",
        "unidad_base": "%", "tipo_valor": "percentage",
        "agregacion_default": "avg", "direction": None,
        "role": "contextual", "fuente_sugerida": "INEGI ITER 2020",
    },
    {
        "variable_id": "localidades_total",
        "categoria_id": "contexto_territorial",
        "nombre": "Total de localidades",
        "descripcion": "Numero de localidades en el municipio segun el ITER 2020.",
        "unidad_base": "", "tipo_valor": "integer",
        "agregacion_default": "sum", "direction": None,
        "role": "contextual", "fuente_sugerida": "INEGI ITER 2020",
    },
    {
        "variable_id": "irs_indice",
        "categoria_id": "bienestar_social",
        "nombre": "Índice de Rezago Social (IRS)",
        "descripcion": "Indice de rezago social municipal (CONAPO). Valores mas altos indican mayor marginacion.",
        "unidad_base": "", "tipo_valor": "number",
        "agregacion_default": "avg", "direction": "lower_better",
        "role": "explanatory", "fuente_sugerida": "CONAPO IRS 2020",
    },
    {
        "variable_id": "viv_sin_agua_pct",
        "categoria_id": "bienestar_social",
        "nombre": "Viviendas sin agua entubada (%)",
        "descripcion": "Porcentaje de viviendas particulares habitadas sin acceso a agua entubada.",
        "unidad_base": "%", "tipo_valor": "percentage",
        "agregacion_default": "avg", "direction": "lower_better",
        "role": "explanatory", "fuente_sugerida": "CONAPO IRS 2020",
    },
    {
        "variable_id": "viv_sin_drenaje_pct",
        "categoria_id": "bienestar_social",
        "nombre": "Viviendas sin drenaje (%)",
        "descripcion": "Porcentaje de viviendas particulares habitadas sin drenaje.",
        "unidad_base": "%", "tipo_valor": "percentage",
        "agregacion_default": "avg", "direction": "lower_better",
        "role": "explanatory", "fuente_sugerida": "CONAPO IRS 2020",
    },
    {
        "variable_id": "viv_sin_luz_pct",
        "categoria_id": "bienestar_social",
        "nombre": "Viviendas sin electricidad (%)",
        "descripcion": "Porcentaje de viviendas particulares habitadas sin energia electrica.",
        "unidad_base": "%", "tipo_valor": "percentage",
        "agregacion_default": "avg", "direction": "lower_better",
        "role": "explanatory", "fuente_sugerida": "CONAPO IRS 2020",
    },
    {
        "variable_id": "sin_derechohabiencia_pct",
        "categoria_id": "bienestar_social",
        "nombre": "Sin derechohabiencia (%)",
        "descripcion": "Porcentaje de poblacion sin acceso a servicios de salud por seguridad social.",
        "unidad_base": "%", "tipo_valor": "percentage",
        "agregacion_default": "avg", "direction": "lower_better",
        "role": "explanatory", "fuente_sugerida": "CONAPO IRS 2020",
    },
    {
        "variable_id": "ookla_velocidad_avg_mbps",
        "categoria_id": "infraestructura_digital",
        "nombre": "Velocidad promedio internet (Ookla)",
        "descripcion": "Velocidad promedio de internet medida por Ookla Speedtest Intelligence (Mbps).",
        "unidad_base": "Mbps", "tipo_valor": "number",
        "agregacion_default": "avg", "direction": "higher_better",
        "role": "target", "fuente_sugerida": "Ookla Speedtest Intelligence 2025",
    },
    {
        "variable_id": "ookla_cobertura_4g_pct",
        "categoria_id": "cobertura_red",
        "nombre": "Cobertura 4G Ookla (%)",
        "descripcion": "Porcentaje de muestras Ookla con tecnologia 4G en el municipio.",
        "unidad_base": "%", "tipo_valor": "percentage",
        "agregacion_default": "avg", "direction": "higher_better",
        "role": "target", "fuente_sugerida": "Ookla Speedtest Intelligence 2025",
    },
    {
        "variable_id": "brecha_4g_pp",
        "categoria_id": "cobertura_red",
        "nombre": "Brecha 4G (pp)",
        "descripcion": "Diferencia en puntos porcentuales entre cobertura 4G teorica (BIT) y medida (Ookla).",
        "unidad_base": "pp", "tipo_valor": "number",
        "agregacion_default": "avg", "direction": "lower_better",
        "role": "target", "fuente_sugerida": "BIT / Ookla 2024",
    },
]


def _load_json(path: Path) -> dict | list:
    return json.loads(path.read_text(encoding="utf-8"))


def _write_json(path: Path, data: dict | list, indent: int = 2) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=indent), encoding="utf-8")


def update_catalogs(existing_ids: set[str]) -> None:
    new_entries = [e for e in NEW_CATALOG_ENTRIES if e["variable_id"] not in existing_ids]
    if not new_entries:
        print("  Catálogo: sin entradas nuevas.")
        return
    for catalog_path in (CATALOG_PATH, PUBLIC_CATALOG_PATH):
        catalog = _load_json(catalog_path)
        catalog["variables"].extend(new_entries)
        catalog["updated_at"] = str(date.today())
        _write_json(catalog_path, catalog)
    print(f"  Catálogo: {len(new_entries)} variables añadidas.")


def _agg(values: list[float], method: str) -> float:
    return sum(values) if method == "sum" else mean(values)


def build_combined_files(analytics: list[dict]) -> tuple[dict[str, list[str]], dict[str, dict[str, dict]]]:
    """
    Agrupa todos los registros por estado y escribe un archivo combinado por estado:
        outputs/municipal/{state_code}.json  →  { state_code, updated_at, variables: { var_id: { year, records } } }
    Retorna dict state_code → [variable_ids] para el manifest.
    """
    # Collect all records grouped by state_code and variable_id
    by_state: dict[str, dict[str, dict]] = {}  # state_code → { variable_id → {year, records[]} }

    for bit_field, variable_id, year in MAPPING:
        for rec in analytics:
            val = rec.get(bit_field)
            if val is None or (isinstance(val, float) and val != val):
                continue
            cve_ent = str(rec.get("cve_ent", "")).zfill(2)
            state_code = INEGI_TO_CODE.get(cve_ent)
            if not state_code:
                continue
            cvegeo = str(rec.get("cvegeo", ""))
            if not cvegeo:
                continue

            state_vars = by_state.setdefault(state_code, {})
            var_entry = state_vars.setdefault(variable_id, {"year": year, "records": []})
            var_entry["records"].append({"cve_mun": cvegeo, "value": float(val)})

    today = str(date.today())
    state_var_ids: dict[str, list[str]] = {}

    for state_code, variables in sorted(by_state.items()):
        # Sort records within each variable
        for var_entry in variables.values():
            var_entry["records"].sort(key=lambda r: r["cve_mun"])

        combined = {
            "state_code": state_code,
            "updated_at": today,
            "variables": variables,
        }
        out_path = MUNICIPAL_DIR / f"{state_code}.json"
        _write_json(out_path, combined)

        kb = out_path.stat().st_size // 1024
        n_vars = len(variables)
        n_mun = len(next(iter(variables.values()))["records"]) if variables else 0
        print(f"  {state_code}: {n_vars} variables, ~{n_mun} municipios  {kb} KB")

        state_var_ids[state_code] = sorted(variables.keys())

    return state_var_ids, by_state


def aggregate_to_state(by_state: dict[str, dict[str, dict]]) -> None:
    """Agrega valores municipales a nivel estatal y los escribe en state_dashboard.combined.json."""
    if not COMBINED_PATH.exists():
        print("  ⚠ combined.json no encontrado, omitiendo agregación estatal.")
        return

    catalog = _load_json(CATALOG_PATH)
    agg_map: dict[str, str] = {
        v["variable_id"]: v.get("agregacion_default", "avg")
        for v in catalog.get("variables", [])
    }
    for e in NEW_CATALOG_ENTRIES:
        agg_map.setdefault(e["variable_id"], e.get("agregacion_default", "avg"))

    cat_by_id = {e["variable_id"]: e for e in NEW_CATALOG_ENTRIES}
    combined = _load_json(COMBINED_PATH)

    existing_metric_ids = {m["variable_id"] for m in combined.get("metric_catalog", [])}
    added = 0
    for _, variable_id, year in MAPPING:
        if variable_id not in existing_metric_ids:
            cat = cat_by_id.get(variable_id, {})
            combined.setdefault("metric_catalog", []).append({
                "variable_id": variable_id,
                "label": cat.get("nombre") or variable_id,
                "unidad": cat.get("unidad_base") or "",
                "categoria_id": cat.get("categoria_id", ""),
                "anio": year,
            })
            existing_metric_ids.add(variable_id)
            added += 1
    if added:
        print(f"  + {added} variables añadidas al metric_catalog")

    updated = 0
    for record in combined.get("records", []):
        sc = record.get("state_code", "")
        if sc not in by_state:
            continue
        for variable_id, var_entry in by_state[sc].items():
            values = [r["value"] for r in var_entry["records"]]
            if not values:
                continue
            record.setdefault("metrics", {})[variable_id] = round(
                _agg(values, agg_map.get(variable_id, "avg")), 4
            )
            updated += 1

    combined["updated_at"] = str(date.today())
    _write_json(COMBINED_PATH, combined)
    print(f"  OK combined.json: {updated} valores estatales escritos")


def trigger_analytics(state_codes: list[str]) -> None:
    """Dispara layer1_descriptive y layer1_municipal."""
    env = os.environ.copy()
    env["PYTHONUTF8"] = "1"
    env["PYTHONIOENCODING"] = "utf-8"

    def _run(cmd: list[str], label: str) -> None:
        result = subprocess.run(
            cmd, cwd=PROJECT_ROOT, capture_output=True,
            text=True, encoding="utf-8", errors="replace", env=env,
        )
        for line in result.stdout.strip().splitlines():
            print(f"    {line}")
        if result.returncode != 0:
            print(f"  Fallo {label}:")
            for line in result.stderr.strip().splitlines()[:5]:
                print(f"    {line}")

    layer1 = PROJECT_ROOT / "scripts" / "analytics" / "layer1_descriptive.py"
    if layer1.exists():
        print("  -> layer1_descriptive.py...")
        _run([sys.executable, str(layer1)], "layer1_descriptive.py")

    layer1_mun = PROJECT_ROOT / "scripts" / "analytics" / "layer1_municipal.py"
    if layer1_mun.exists():
        sc_preview = ", ".join(state_codes[:5]) + ("..." if len(state_codes) > 5 else "")
        print(f"  -> layer1_municipal.py [{sc_preview}]...")
        _run([sys.executable, str(layer1_mun)] + state_codes, "layer1_municipal.py")


def write_manifest(state_var_ids: dict[str, list[str]]) -> None:
    manifest = {
        "updated_at": str(date.today()),
        "states": {
            sc: {"variables": var_ids, "analytics_available": False}
            for sc, var_ids in state_var_ids.items()
        },
    }
    _write_json(MANIFEST_PATH, manifest)
    total = len({v for vs in state_var_ids.values() for v in vs})
    print(f"\n  municipal_manifest.json: {len(state_var_ids)} estados, {total} variables únicas")


_ANALYTICS_SLIM_FIELDS = [
    "cvegeo", "cve_ent", "nom_ent", "nom_mun",
    "pobtot_iter",
    "graproes", "pct_sin_escolaridad_15ymas", "pct_analfabetismo_15ymas", "pct_posbasica_18ymas",
    "pct_pob_0_14", "pct_pob_15_64", "pct_pob_65_mas",
    "pct_mujeres", "pct_hombres", "indice_masculinidad",
    "loc_pct_4g_garantizada", "pob_pct_4g_garantizada",
    "loc_pct_movil", "pob_pct_movil",
    "loc_pct_5g_garantizada", "pob_pct_5g_garantizada",
    "localidades_n",
    "irs_indice", "irs_grado_texto",
    "irs_pct_viv_sin_agua", "irs_pct_viv_sin_drenaje", "irs_pct_viv_sin_luz",
    "irs_pct_sin_derechohabiencia",
    "ookla_int_avg_speed", "ookla_pct_4g", "ookla_pct_5g", "ookla_cubierto",
    "brecha_4g_pp", "brecha_3g_pp",
    "cluster_id", "cluster_label",
    "rf_4g_esperada", "rf_brecha_4g_pp", "rf_factor_principal",
]


def embed_municipalities(analytics: list[dict]) -> None:
    """Embebe registros wide-format de municipios dentro de {state_code}.json existente.

    Añade la clave 'municipalities' al archivo que ya contiene 'variables'.
    Elimina archivos *.analytics.json legacy si existen.
    """
    by_state: dict[str, list[dict]] = {}
    for rec in analytics:
        cve_ent = str(rec.get("cve_ent", "")).zfill(2)
        state_code = INEGI_TO_CODE.get(cve_ent)
        if not state_code:
            continue
        slim = {k: rec[k] for k in _ANALYTICS_SLIM_FIELDS if k in rec}
        by_state.setdefault(state_code, []).append(slim)

    today = str(date.today())
    total_kb = 0
    for state_code, records in sorted(by_state.items()):
        state_path = MUNICIPAL_DIR / f"{state_code}.json"
        if state_path.exists():
            state_data = json.loads(state_path.read_text(encoding="utf-8"))
        else:
            state_data = {"state_code": state_code, "variables": {}}
        state_data["municipalities"] = records
        state_data["updated_at"] = today
        _write_json(state_path, state_data)
        kb = state_path.stat().st_size // 1024
        total_kb += kb
        print(f"  {state_code}.json: {len(records)} municipios  {kb} KB")

    for stale in sorted(MUNICIPAL_DIR.glob("*.analytics.json")):
        stale.unlink()
        print(f"  [rm] {stale.name}")

    print(f"  Total: {total_kb} KB ({total_kb // 1024} MB)")


def main() -> None:
    print("Leyendo municipios_master_analytics.json...")
    analytics_path = ANALYTICS_PATH if ANALYTICS_PATH.exists() else (
        PROJECT_ROOT / "data" / "processed" / "municipios_master_analytics.json"
    )
    if not analytics_path.exists():
        print("ERROR: no se encontró municipios_master_analytics.json")
        sys.exit(1)
    analytics = _load_json(analytics_path)
    print(f"  {len(analytics)} registros municipales cargados.")

    print("\nActualizando catálogos...")
    catalog = _load_json(CATALOG_PATH)
    existing_ids = {v["variable_id"] for v in catalog["variables"]}
    update_catalogs(existing_ids)

    print("\nGenerando archivos combinados por estado...")
    MUNICIPAL_DIR.mkdir(parents=True, exist_ok=True)
    state_var_ids, by_state = build_combined_files(analytics)

    print("\nEscribiendo manifest...")
    write_manifest(state_var_ids)

    print("\nAgregando a nivel estatal en combined.json...")
    aggregate_to_state(by_state)

    print("\nEmbebiendo municipalities en archivos por estado...")
    embed_municipalities(analytics)

    print("\nEjecutando analytics...")
    trigger_analytics(sorted(state_var_ids.keys()))

    print(f"\nListo. {len(state_var_ids)} archivos en {MUNICIPAL_DIR}")


if __name__ == "__main__":
    main()
