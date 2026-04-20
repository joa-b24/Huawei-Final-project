from __future__ import annotations

import csv
import json
from collections import defaultdict
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = PROJECT_ROOT / "data" / "raw"
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"
PUBLIC_DIR = PROJECT_ROOT / "public" / "data"
STATE_MASTER_FILE = PROJECT_ROOT / "data" / "catalogs" / "states.master.json"

YEAR = 2024
SOURCE = "INEGI ENDUTIH 2024"
UPDATED_AT = "2026-04-19"

INPUT_FILES = {
    "usuarios": RAW_DIR / "tr_endutih_usuarios_anual_2024.csv",
    "usuarios2": RAW_DIR / "tr_endutih_usuarios2_anual_2024.csv",
}

TD_FILES = {
    "td_teledensidad_intmovil": RAW_DIR / "TD_TELEDENSIDAD_INTMOVIL_ITE_VA.csv",
}

BRECHA_FILES = {
    "loc_tipo": RAW_DIR / "loc_tipo_conectividad.csv",
    "localidades": RAW_DIR / "localidades_conectividad.csv",
}

VARIABLE_SPECS = [
    {
        "file_key": "usuarios",
        "variable": "personas_usuarias_computadora_pct",
        "categoria": "infraestructura_digital",
        "label": "Personas usuarias de computadora",
        "unidad": "%",
        "column": "P6_1",
        "positive_values": {"1"},
    },
    {
        "file_key": "usuarios",
        "variable": "personas_usuarias_internet_pct",
        "categoria": "infraestructura_digital",
        "label": "Personas usuarias de internet",
        "unidad": "%",
        "column": "P7_1",
        "positive_values": {"1"},
    },
    {
        "file_key": "usuarios",
        "variable": "personas_conexion_internet_movil_pct",
        "categoria": "cobertura_red",
        "label": "Personas con uso de internet movil",
        "unidad": "%",
        "column": "P7_8_7",
        "positive_values": {"1"},
    },
    {
        "file_key": "usuarios",
        "variable": "personas_usan_redes_sociales_pct",
        "categoria": "infraestructura_digital",
        "label": "Personas que usan redes sociales",
        "unidad": "%",
        "column": "P7_15",
        "positive_values": {"1"},
    },
    {
        "file_key": "usuarios",
        "variable": "personas_compras_internet_pct",
        "categoria": "infraestructura_digital",
        "label": "Personas que realizan compras por internet",
        "unidad": "%",
        "column": "P7_21",
        "positive_values": {"1"},
    },
    {
        "file_key": "usuarios",
        "variable": "personas_pagos_internet_pct",
        "categoria": "infraestructura_digital",
        "label": "Personas que realizan pagos por internet",
        "unidad": "%",
        "column": "P7_28",
        "positive_values": {"1"},
    },
    {
        "file_key": "usuarios",
        "variable": "personas_banca_electronica_pct",
        "categoria": "infraestructura_digital",
        "label": "Personas que usan banca electronica",
        "unidad": "%",
        "column": "P7_33",
        "positive_values": {"1"},
    },
    {
        "file_key": "usuarios2",
        "variable": "personas_con_celular_pct",
        "categoria": "cobertura_red",
        "label": "Personas con celular",
        "unidad": "%",
        "column": "P8_1",
        "positive_values": {"1"},
    },
    {
        "file_key": "usuarios2",
        "variable": "personas_usuarias_celular_pct",
        "categoria": "cobertura_red",
        "label": "Personas usuarias de celular",
        "unidad": "%",
        "column": "P8_3",
        "positive_values": {"1"},
    },
    {
        "file_key": "usuarios2",
        "variable": "personas_con_smartphone_pct",
        "categoria": "cobertura_red",
        "label": "Personas con smartphone",
        "unidad": "%",
        "column": "P8_4_2",
        "positive_values": {"1"},
    },
    {
        "file_key": "usuarios2",
        "variable": "personas_conexion_datos_celular_pct",
        "categoria": "cobertura_red",
        "label": "Personas que se conectan por datos celulares",
        "unidad": "%",
        "column": "P8_12_2",
        "positive_values": {"1"},
    },
    {
        "file_key": "usuarios2",
        "variable": "personas_usan_apps_redes_sociales_pct",
        "categoria": "infraestructura_digital",
        "label": "Personas que usan apps de redes sociales",
        "unidad": "%",
        "column": "P8_13_6",
        "positive_values": {"1"},
    },
    {
        "file_key": "usuarios2",
        "variable": "personas_usan_banca_movil_pct",
        "categoria": "infraestructura_digital",
        "label": "Personas que usan apps de banca movil",
        "unidad": "%",
        "column": "P8_13_7",
        "positive_values": {"1"},
    },
]

DIRECT_VALUE_SPECS = [
    {
        "file_key": "td_teledensidad_intmovil",
        "variable": "teledensidad_internet_movil",
        "categoria": "cobertura_red",
        "label": "Teledensidad de internet movil",
        "unidad": "lineas por cada 100 habitantes",
        "value_column": "T_INTMOVIL_ITE_VA",
        "entity_column": "K_ENTIDAD",
        "year_column": "ANIO",
        "encoding": "latin1",
        "source": "IFT TD_TELEDENSIDAD_INTMOVIL_ITE_VA",
        "source_table": "td_teledensidad_intmovil",
    }
]

LOCALITY_AGG_SPECS = [
    {
        "variable": "localidades_con_cobertura_movil_pct",
        "categoria": "cobertura_red",
        "label": "Localidades con cobertura movil",
        "unidad": "%",
        "weight_key": "localidades",
        "predicate": lambda row: row["MOVIL"].strip() == "Sí",
    },
    {
        "variable": "poblacion_en_localidades_con_cobertura_movil_pct",
        "categoria": "cobertura_red",
        "label": "Poblacion en localidades con cobertura movil",
        "unidad": "%",
        "weight_key": "poblacion",
        "predicate": lambda row: row["MOVIL"].strip() == "Sí",
    },
    {
        "variable": "localidades_con_4g_garantizada_pct",
        "categoria": "cobertura_red",
        "label": "Localidades con 4G garantizada",
        "unidad": "%",
        "weight_key": "localidades",
        "predicate": lambda row: row["G_4G"].strip() == "Garantizada",
    },
    {
        "variable": "poblacion_en_localidades_con_4g_garantizada_pct",
        "categoria": "cobertura_red",
        "label": "Poblacion en localidades con 4G garantizada",
        "unidad": "%",
        "weight_key": "poblacion",
        "predicate": lambda row: row["G_4G"].strip() == "Garantizada",
    },
    {
        "variable": "localidades_con_5g_garantizada_pct",
        "categoria": "cobertura_red",
        "label": "Localidades con 5G garantizada",
        "unidad": "%",
        "weight_key": "localidades",
        "predicate": lambda row: row["G_5G"].strip() == "Garantizada",
    },
    {
        "variable": "poblacion_en_localidades_con_5g_garantizada_pct",
        "categoria": "cobertura_red",
        "label": "Poblacion en localidades con 5G garantizada",
        "unidad": "%",
        "weight_key": "poblacion",
        "predicate": lambda row: row["G_5G"].strip() == "Garantizada",
    },
    {
        "variable": "hogares_en_localidades_con_internet_pct",
        "categoria": "infraestructura_digital",
        "label": "Hogares en localidades con internet",
        "unidad": "%",
        "weight_key": "hogares",
        "predicate": lambda row: row["INTERNET"].strip() == "Sí",
    },
    {
        "variable": "poblacion_en_localidades_con_internet_pct",
        "categoria": "infraestructura_digital",
        "label": "Poblacion en localidades con internet",
        "unidad": "%",
        "weight_key": "poblacion",
        "predicate": lambda row: row["INTERNET"].strip() == "Sí",
    },
]


def load_state_master() -> dict[str, dict]:
    payload = json.loads(STATE_MASTER_FILE.read_text(encoding="utf-8"))
    return {state["cve_ent"]: state for state in payload["states"]}


def aggregate_file(file_path: Path, specs: list[dict]) -> tuple[dict[str, float], dict[str, dict[str, float]]]:
    totals: dict[str, float] = defaultdict(float)
    positives: dict[str, dict[str, float]] = {
        spec["variable"]: defaultdict(float) for spec in specs
    }

    with file_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            cve_ent = row["CVE_ENT"].strip()
            fac_per = row["FAC_PER"].strip()

            if not cve_ent or not fac_per:
                continue

            weight = float(fac_per)
            totals[cve_ent] += weight

            for spec in specs:
                response = row.get(spec["column"], "").strip()
                if response in spec["positive_values"]:
                    positives[spec["variable"]][cve_ent] += weight

    return totals, positives


def load_locality_metadata() -> dict[str, dict]:
    metadata: dict[str, dict] = {}
    with BRECHA_FILES["localidades"].open("r", encoding="latin1", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            cvegeo = row["CVEGEO"].strip()
            metadata[cvegeo] = {
                "cve_ent": row["ENT"].strip().zfill(2),
                "poblacion": float((row["POBLACION"] or "0").strip() or 0),
                "hogares": float((row["TOTHOG"] or "0").strip() or 0),
                "localidades": 1.0,
            }
    return metadata


def aggregate_locality_connectivity(state_master: dict[str, dict]) -> list[dict]:
    locality_metadata = load_locality_metadata()
    totals_by_state: dict[str, dict[str, float]] = defaultdict(
        lambda: {"poblacion": 0.0, "hogares": 0.0, "localidades": 0.0}
    )
    positives_by_variable: dict[str, dict[str, float]] = {
        spec["variable"]: defaultdict(float) for spec in LOCALITY_AGG_SPECS
    }

    with BRECHA_FILES["loc_tipo"].open("r", encoding="latin1", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            if row["ANIO"].strip() != str(YEAR):
                continue

            cvegeo = row["CVEGEO"].strip()
            locality = locality_metadata.get(cvegeo)
            if not locality:
                continue

            cve_ent = locality["cve_ent"]
            for weight_key in ("poblacion", "hogares", "localidades"):
                totals_by_state[cve_ent][weight_key] += locality[weight_key]

            for spec in LOCALITY_AGG_SPECS:
                if spec["predicate"](row):
                    positives_by_variable[spec["variable"]][cve_ent] += locality[spec["weight_key"]]

    long_records: list[dict] = []
    for spec in LOCALITY_AGG_SPECS:
        for cve_ent, totals in sorted(totals_by_state.items()):
            state = state_master.get(cve_ent)
            denominator = totals[spec["weight_key"]]
            if not state or denominator == 0:
                continue

            value = round((positives_by_variable[spec["variable"]][cve_ent] / denominator) * 100, 2)
            long_records.append(
                {
                    "state_code": state["state_code"],
                    "cve_ent": cve_ent,
                    "estado": state["estado"],
                    "categoria": spec["categoria"],
                    "variable": spec["variable"],
                    "valor": value,
                    "anio": YEAR,
                    "fuente": "BIT brechas digitales 2024",
                    "unidad": spec["unidad"],
                }
            )

    return long_records


def build_outputs() -> tuple[dict, dict]:
    state_master = load_state_master()
    totals_by_file: dict[str, dict[str, float]] = {}
    positives_by_file: dict[str, dict[str, dict[str, float]]] = {}

    for file_key, file_path in INPUT_FILES.items():
        specs = [spec for spec in VARIABLE_SPECS if spec["file_key"] == file_key]
        totals, positives = aggregate_file(file_path, specs)
        totals_by_file[file_key] = totals
        positives_by_file[file_key] = positives

    long_records: list[dict] = []
    metric_catalog: list[dict] = []

    for spec in VARIABLE_SPECS:
        metric_catalog.append(
            {
                "variable_id": spec["variable"],
                "categoria_id": spec["categoria"],
                "label": spec["label"],
                "unidad": spec["unidad"],
                "source_table": spec["file_key"],
            }
        )

        totals = totals_by_file[spec["file_key"]]
        positives = positives_by_file[spec["file_key"]][spec["variable"]]

        for cve_ent, total_weight in sorted(totals.items()):
            state = state_master.get(cve_ent)
            if not state or total_weight == 0:
                continue

            value = round((positives[cve_ent] / total_weight) * 100, 2)
            long_records.append(
                {
                    "state_code": state["state_code"],
                    "cve_ent": cve_ent,
                    "estado": state["estado"],
                    "categoria": spec["categoria"],
                    "variable": spec["variable"],
                    "valor": value,
                    "anio": YEAR,
                    "fuente": SOURCE,
                    "unidad": spec["unidad"],
                }
            )

    for spec in DIRECT_VALUE_SPECS:
        metric_catalog.append(
            {
                "variable_id": spec["variable"],
                "categoria_id": spec["categoria"],
                "label": spec["label"],
                "unidad": spec["unidad"],
                "source_table": spec["source_table"],
            }
        )

        file_path = TD_FILES[spec["file_key"]]
        with file_path.open("r", encoding=spec["encoding"], newline="") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                cve_ent = row[spec["entity_column"]].strip().zfill(2)
                state = state_master.get(cve_ent)
                if not state:
                    continue

                year = int(row[spec["year_column"]])
                if year != YEAR:
                    continue

                value = float(row[spec["value_column"]].strip())
                long_records.append(
                    {
                        "state_code": state["state_code"],
                        "cve_ent": cve_ent,
                        "estado": state["estado"],
                        "categoria": spec["categoria"],
                        "variable": spec["variable"],
                        "valor": value,
                        "anio": year,
                        "fuente": spec["source"],
                        "unidad": spec["unidad"],
                    }
                )

    for spec in LOCALITY_AGG_SPECS:
        metric_catalog.append(
            {
                "variable_id": spec["variable"],
                "categoria_id": spec["categoria"],
                "label": spec["label"],
                "unidad": spec["unidad"],
                "source_table": "loc_tipo_conectividad + localidades_conectividad",
            }
        )

    long_records.extend(aggregate_locality_connectivity(state_master))

    wide_records_by_state: dict[str, dict] = {}
    for record in long_records:
        current = wide_records_by_state.setdefault(
            record["cve_ent"],
            {
                "state_code": record["state_code"],
                "cve_ent": record["cve_ent"],
                "estado": record["estado"],
                "region": state_master[record["cve_ent"]]["region"],
                "anio": YEAR,
                "metrics": {},
            },
        )
        current["metrics"][record["variable"]] = record["valor"]

    wide_records = list(sorted(wide_records_by_state.values(), key=lambda item: item["cve_ent"]))

    long_payload = {
        "updated_at": UPDATED_AT,
        "schema_version": "1.0.0",
        "dataset_id": "endutih_2024_state_observations.long",
        "source": SOURCE,
        "records": long_records,
    }

    wide_payload = {
        "updated_at": UPDATED_AT,
        "schema_version": "1.0.0",
        "dataset_id": "endutih_2024_state_dashboard.wide",
        "source": SOURCE,
        "metric_catalog": metric_catalog,
        "records": wide_records,
    }

    return long_payload, wide_payload


def write_outputs(long_payload: dict, wide_payload: dict) -> None:
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)

    long_json_path = PROCESSED_DIR / "endutih_2024_state_observations.long.json"
    long_csv_path = PROCESSED_DIR / "endutih_2024_state_observations.long.csv"
    wide_json_path = PROCESSED_DIR / "endutih_2024_state_dashboard.wide.json"
    public_json_path = PUBLIC_DIR / "endutih_2024_state_dashboard.wide.json"

    long_json_path.write_text(
        json.dumps(long_payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    wide_json_path.write_text(
        json.dumps(wide_payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    public_json_path.write_text(
        json.dumps(wide_payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    with long_csv_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "state_code",
                "cve_ent",
                "estado",
                "categoria",
                "variable",
                "valor",
                "anio",
                "fuente",
                "unidad",
            ],
        )
        writer.writeheader()
        writer.writerows(long_payload["records"])


def main() -> None:
    long_payload, wide_payload = build_outputs()
    write_outputs(long_payload, wide_payload)
    print(
        f"Generados {len(long_payload['records'])} registros largos y "
        f"{len(wide_payload['records'])} registros estatales."
    )


if __name__ == "__main__":
    main()
