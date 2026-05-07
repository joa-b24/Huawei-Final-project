from __future__ import annotations

import json
import unicodedata
from pathlib import Path

import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
RAW_DIR = PROJECT_ROOT / "data" / "raw"
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"
PUBLIC_DIR = PROJECT_ROOT / "public" / "data"
STATE_MASTER_FILE = PROJECT_ROOT / "data" / "catalogs" / "states.master.json"
CATALOG_FILE = PROJECT_ROOT / "data" / "catalogs" / "variables.catalog.json"

PIB_FILE = RAW_DIR / "PIBE_2.xlsx"
POBLACION_FILE = RAW_DIR / "conjunto_de_datos_iter_00CSV20.csv"
SHAPEFILE_PATH = RAW_DIR / "00ent.shp"
CONEVAL_FILE = RAW_DIR / "Anexo estadístico entidades 2022.xlsx"

SOURCE = "CONEVAL 2022 / INEGI ITER 2020 / INEGI PIB"
UPDATED_AT = "2026-04-22"

VARIABLE_SPECS = [
    {"variable": "pobreza_pct",                        "anio": 2022, "categoria": "bienestar_social", "label": "Población en situación de pobreza",        "unidad": "%"},
    {"variable": "pobreza_extrema_pct",                "anio": 2022, "categoria": "bienestar_social", "label": "Población en pobreza extrema",             "unidad": "%"},
    {"variable": "vulnerable_carencias_pct",           "anio": 2022, "categoria": "bienestar_social", "label": "Población vulnerable por carencias",       "unidad": "%"},
    {"variable": "no_pobre_no_vulnerable_pct",         "anio": 2022, "categoria": "bienestar_social", "label": "Población no pobre y no vulnerable",       "unidad": "%"},
    {"variable": "rezago_educativo_pct",               "anio": 2022, "categoria": "bienestar_social", "label": "Rezago educativo",                         "unidad": "%"},
    {"variable": "carencia_salud_pct",                 "anio": 2022, "categoria": "bienestar_social", "label": "Carencia por acceso a salud",              "unidad": "%"},
    {"variable": "carencia_servicios_basicos_pct",     "anio": 2022, "categoria": "bienestar_social", "label": "Carencia por servicios básicos",           "unidad": "%"},
    {"variable": "ingreso_inferior_lp_pct",            "anio": 2022, "categoria": "bienestar_social", "label": "Ingreso inferior a la línea de pobreza",  "unidad": "%"},
    {"variable": "pib_total",                          "anio": 2024, "categoria": "economia",          "label": "PIB total",                               "unidad": "MDP"},
    {"variable": "pib_per_capita",                     "anio": 2024, "categoria": "economia",          "label": "PIB per cápita",                          "unidad": "k MXN"},
    {"variable": "poblacion_total",                    "anio": 2020, "categoria": "demografia",        "label": "Población total",                         "unidad": "personas"},
    {"variable": "poblacion_edad_laboral_pct",         "anio": 2020, "categoria": "demografia",        "label": "Población en edad laboral",               "unidad": "%"},
    {"variable": "poblacion_economicamente_activa_pct","anio": 2020, "categoria": "demografia",        "label": "Población económicamente activa",         "unidad": "%"},
    {"variable": "poblacion_afiliada_imss_pct",        "anio": 2020, "categoria": "demografia",        "label": "Población afiliada al IMSS",              "unidad": "%"},
]


def _clean_entity_code(x: object) -> str:
    return str(x).zfill(2)


def _normalize(text: object) -> str:
    if text is None:
        return ""
    s = str(text).lower().strip()
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("utf-8")


def load_state_master() -> dict[str, dict]:
    payload = json.loads(STATE_MASTER_FILE.read_text(encoding="utf-8"))
    return {state["cve_ent"]: state for state in payload["states"]}


def build_state_lookup(state_master: dict[str, dict]) -> dict[str, str]:
    lookup: dict[str, str] = {}
    for cve, data in state_master.items():
        for name in [data["estado"]] + data.get("aliases", []):
            lookup[_normalize(name)] = cve
    return lookup


def load_pib() -> pd.DataFrame:
    df = pd.read_excel(PIB_FILE, skiprows=4)
    df = df.iloc[3:35]
    last_year = df.columns[-1]
    return df[["Concepto", last_year]].rename(columns={"Concepto": "estado", last_year: "pib_total"})


def load_poblacion() -> pd.DataFrame:
    df = pd.read_csv(
        POBLACION_FILE,
        dtype={"MUN": int, "LOC": int, "ENTIDAD": int, "POBTOT": int},
        usecols=["MUN", "LOC", "ENTIDAD", "POBTOT", "POB15_64", "PEA", "PDER_IMSS"],
    )
    df = df[(df["MUN"] == 0) & (df["LOC"] == 0) & (df["ENTIDAD"] != 0)]
    df = df.rename(columns={
        "ENTIDAD": "cve_ent",
        "POBTOT": "poblacion_total",
        "POB15_64": "poblacion_edad_laboral",
        "PEA": "poblacion_economicamente_activa",
        "PDER_IMSS": "poblacion_afiliada_imss",
    })
    df["cve_ent"] = df["cve_ent"].apply(_clean_entity_code)
    return df[["cve_ent", "poblacion_total", "poblacion_edad_laboral",
               "poblacion_economicamente_activa", "poblacion_afiliada_imss"]]


def load_coneval() -> pd.DataFrame:
    xls = pd.ExcelFile(CONEVAL_FILE)
    records = []
    for sheet in xls.sheet_names:
        if sheet == "Contenido":
            continue
        df = xls.parse(sheet, header=6)
        df.columns = df.columns.map(str)

        def get_value(label: str) -> float | None:
            row = df[df.iloc[:, 2].str.contains(label, na=False, case=False)]
            if row.empty:
                return None
            try:
                return float(row.iloc[0, 6])
            except (IndexError, ValueError):
                return None

        records.append({
            "estado": sheet,
            "pobreza_pct": get_value("Población en situación de pobreza"),
            "pobreza_extrema_pct": get_value("pobreza extrema"),
            "vulnerable_carencias_pct": get_value("vulnerable por carencias"),
            "no_pobre_no_vulnerable_pct": get_value("no pobre y no vulnerable"),
            "rezago_educativo_pct": get_value("Rezago educativo"),
            "carencia_salud_pct": get_value("salud"),
            "carencia_servicios_basicos_pct": get_value("servicios básicos"),
            "ingreso_inferior_lp_pct": get_value("línea de pobreza por ingresos"),
        })
    return pd.DataFrame(records)[1:]


def build_dataset() -> pd.DataFrame:
    state_master = load_state_master()
    lookup = build_state_lookup(state_master)

    pib = load_pib()
    pob = load_poblacion()
    coneval = load_coneval()

    coneval["cve_ent"] = coneval["estado"].apply(lambda x: lookup.get(_normalize(x)))
    coneval.drop(columns=["estado"], inplace=True)
    pib["cve_ent"] = pib["estado"].apply(lambda x: lookup.get(_normalize(x)))

    df = coneval.merge(pib, on="cve_ent", how="left").merge(pob, on="cve_ent", how="left")

    for col in ["pib_total", "poblacion_total", "poblacion_edad_laboral",
                "poblacion_economicamente_activa", "poblacion_afiliada_imss"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df["pib_per_capita"] = (df["pib_total"] * 1_000) / df["poblacion_total"]
    df["poblacion_edad_laboral_pct"] = (df["poblacion_edad_laboral"] / df["poblacion_total"]) * 100
    df["poblacion_economicamente_activa_pct"] = (df["poblacion_economicamente_activa"] / df["poblacion_total"]) * 100
    df["poblacion_afiliada_imss_pct"] = (df["poblacion_afiliada_imss"] / df["poblacion_total"]) * 100

    return df


def build_outputs(df: pd.DataFrame) -> tuple[dict, dict]:
    state_master = load_state_master()
    long_records: list[dict] = []
    metric_catalog: list[dict] = []

    for spec in VARIABLE_SPECS:
        metric_catalog.append({
            "variable_id": spec["variable"],
            "anio": spec["anio"],
            "categoria_id": spec["categoria"],
            "label": spec["label"],
            "unidad": spec["unidad"],
        })
        for _, row in df.iterrows():
            cve_ent = row["cve_ent"]
            state = state_master.get(cve_ent)
            if not state:
                continue
            value = row[spec["variable"]]
            if pd.isna(value):
                continue
            long_records.append({
                "state_code": state["state_code"],
                "cve_ent": cve_ent,
                "estado": state["estado"],
                "categoria": spec["categoria"],
                "variable": spec["variable"],
                "valor": round(float(value), 4),
                "anio": spec["anio"],
                "fuente": SOURCE,
                "unidad": spec["unidad"],
            })

    wide_records_by_state: dict[str, dict] = {}
    for record in long_records:
        current = wide_records_by_state.setdefault(record["cve_ent"], {
            "state_code": record["state_code"],
            "cve_ent": record["cve_ent"],
            "estado": record["estado"],
            "region": state_master[record["cve_ent"]]["region"],
            "metrics": {},
        })
        current["metrics"][record["variable"]] = record["valor"]

    wide_records = sorted(wide_records_by_state.values(), key=lambda r: r["cve_ent"])

    long_payload = {
        "updated_at": UPDATED_AT,
        "schema_version": "1.0.0",
        "dataset_id": "context_variables_state_observations.long",
        "source": SOURCE,
        "records": long_records,
    }
    wide_payload = {
        "updated_at": UPDATED_AT,
        "schema_version": "1.0.0",
        "dataset_id": "context_variables_state_dashboard.wide",
        "source": SOURCE,
        "metric_catalog": metric_catalog,
        "records": wide_records,
    }
    return long_payload, wide_payload


def write_outputs(long_payload: dict, wide_payload: dict) -> None:
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)

    (PROCESSED_DIR / "context_variables_state_observations.long.json").write_text(
        json.dumps(long_payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (PROCESSED_DIR / "context_variables_state_dashboard.wide.json").write_text(
        json.dumps(wide_payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"Generados {len(long_payload['records'])} registros para context_variables.")


def main() -> None:
    df = build_dataset()
    long_payload, wide_payload = build_outputs(df)
    write_outputs(long_payload, wide_payload)


if __name__ == "__main__":
    main()
