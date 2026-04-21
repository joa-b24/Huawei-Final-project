from __future__ import annotations

import csv
import json
import math
from collections import Counter
from pathlib import Path
from statistics import mean, pstdev


PROJECT_ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = PROJECT_ROOT / "data" / "raw"
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"
REPORT_JSON_PATH = PROCESSED_DIR / "endutih_2024_data_quality_report.json"
REPORT_MD_PATH = PROCESSED_DIR / "endutih_2024_data_quality_report.md"
LONG_DATASET_PATH = PROCESSED_DIR / "endutih_2024_state_observations.long.json"
WIDE_DATASET_PATH = PROCESSED_DIR / "endutih_2024_state_dashboard.wide.json"

RAW_FILES = {
    "endutih_usuarios": RAW_DIR / "tr_endutih_usuarios_anual_2024.csv",
    "endutih_usuarios2": RAW_DIR / "tr_endutih_usuarios2_anual_2024.csv",
    "teledensidad_movil": RAW_DIR / "TD_TELEDENSIDAD_INTMOVIL_ITE_VA.csv",
    "brecha_localidades": RAW_DIR / "localidades_conectividad.csv",
    "brecha_tipo": RAW_DIR / "loc_tipo_conectividad.csv",
}


def main() -> None:
    long_payload = json.loads(LONG_DATASET_PATH.read_text(encoding="utf-8"))
    wide_payload = json.loads(WIDE_DATASET_PATH.read_text(encoding="utf-8"))

    raw_summary = build_raw_summary()
    long_records = long_payload["records"]
    wide_records = wide_payload["records"]
    metric_catalog = wide_payload["metric_catalog"]

    metrics_profile = build_metrics_profile(wide_records, metric_catalog)
    validation_checks = build_validation_checks(long_records, wide_records, metric_catalog)
    source_breakdown = build_source_breakdown(long_records)

    report = {
        "updated_at": wide_payload["updated_at"],
        "dataset_id": wide_payload["dataset_id"],
        "summary": {
            "raw_files_profiled": len(raw_summary),
            "records_long": len(long_records),
            "states_wide": len(wide_records),
            "metrics_in_catalog": len(metric_catalog),
        },
        "cleaning_logic": {
            "endutih_weighted_estimator": "porcentaje = (sumatoria de FAC_PER para respuestas positivas / sumatoria total de FAC_PER por entidad) * 100",
            "locality_weighted_estimator": "porcentaje = (sumatoria ponderada por poblacion, hogares o localidades con condicion positiva / sumatoria total del denominador por entidad) * 100",
            "key_steps": [
                "se filtran registros sin CVE_ENT o sin FAC_PER en ENDUTIH",
                "se normaliza la clave estatal con dos digitos para el cruce con el maestro de estados",
                "se filtran los datos de brecha digital al anio 2024",
                "se integran solo entidades con catalogo maestro valido",
                "se redondean indicadores finales a dos decimales",
            ],
        },
        "raw_files": raw_summary,
        "source_breakdown": source_breakdown,
        "validation_checks": validation_checks,
        "metrics_profile": metrics_profile,
    }

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_JSON_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    REPORT_MD_PATH.write_text(build_markdown_report(report), encoding="utf-8")

    print(
        "Generado reporte de calidad con "
        f"{len(validation_checks)} validaciones y {len(metrics_profile)} metricas perfiladas."
    )


def build_raw_summary() -> list[dict]:
    summaries: list[dict] = []
    for source_id, file_path in RAW_FILES.items():
        encoding = "latin1" if "brecha" in source_id or "teledensidad" in source_id else "utf-8-sig"
        with file_path.open("r", encoding=encoding, newline="") as handle:
            reader = csv.DictReader(handle)
            rows = list(reader)

        empty_key_rows = 0
        if "endutih" in source_id:
            empty_key_rows = sum(
                1 for row in rows if not (row.get("CVE_ENT", "").strip() and row.get("FAC_PER", "").strip())
            )
        elif source_id == "brecha_tipo":
            empty_key_rows = sum(1 for row in rows if not row.get("CVEGEO", "").strip())
        elif source_id == "brecha_localidades":
            empty_key_rows = sum(1 for row in rows if not row.get("CVEGEO", "").strip())
        elif source_id == "teledensidad_movil":
            empty_key_rows = sum(1 for row in rows if not row.get("K_ENTIDAD", "").strip())

        summaries.append(
            {
                "source_id": source_id,
                "file_name": file_path.name,
                "rows_read": len(rows),
                "columns": reader.fieldnames or [],
                "rows_with_missing_primary_keys": empty_key_rows,
            }
        )
    return summaries


def build_metrics_profile(wide_records: list[dict], metric_catalog: list[dict]) -> list[dict]:
    profile: list[dict] = []
    for metric in metric_catalog:
        metric_id = metric["variable_id"]
        values = [
            record["metrics"][metric_id]
            for record in wide_records
            if metric_id in record["metrics"] and record["metrics"][metric_id] is not None
        ]

        if not values:
            continue

        profile.append(
            {
                "metric_id": metric_id,
                "label": metric["label"],
                "unit": metric["unidad"],
                "count": len(values),
                "min": round(min(values), 2),
                "max": round(max(values), 2),
                "mean": round(mean(values), 2),
                "std_dev": round(pstdev(values), 2) if len(values) > 1 else 0.0,
            }
        )
    return profile


def build_validation_checks(long_records: list[dict], wide_records: list[dict], metric_catalog: list[dict]) -> list[dict]:
    checks: list[dict] = []
    metric_ids = [metric["variable_id"] for metric in metric_catalog]
    expected_long_records = len(wide_records) * len(metric_ids)
    duplicate_pairs = count_duplicates(long_records)
    metrics_with_missing_coverage = [
        metric_id
        for metric_id in metric_ids
        if sum(1 for record in long_records if record["variable"] == metric_id) != len(wide_records)
    ]
    out_of_range_percentage_records = [
        record
        for record in long_records
        if record["unidad"] == "%" and (record["valor"] < 0 or record["valor"] > 100)
    ]

    checks.append(
        build_check(
            "state_coverage",
            len(wide_records) == 32,
            f"El dataset ancho contiene {len(wide_records)} entidades.",
        )
    )
    checks.append(
        build_check(
            "metric_coverage",
            not metrics_with_missing_coverage,
            f"Metricas con cobertura incompleta: {metrics_with_missing_coverage or 'ninguna'}.",
        )
    )
    checks.append(
        build_check(
            "expected_long_records",
            len(long_records) == expected_long_records,
            f"Registros largos observados: {len(long_records)}. Esperados: {expected_long_records}.",
        )
    )
    checks.append(
        build_check(
            "duplicate_state_variable_pairs",
            duplicate_pairs == 0,
            f"Pares entidad-variable duplicados: {duplicate_pairs}.",
        )
    )
    checks.append(
        build_check(
            "percentage_ranges",
            not out_of_range_percentage_records,
            f"Registros porcentuales fuera de rango: {len(out_of_range_percentage_records)}.",
        )
    )
    checks.append(
        build_check(
            "null_metric_values",
            all(value is not None for record in wide_records for value in record["metrics"].values()),
            "No se detectaron valores nulos en el dataset ancho.",
        )
    )

    return checks


def build_source_breakdown(long_records: list[dict]) -> list[dict]:
    counter = Counter(record["fuente"] for record in long_records)
    return [
        {"source": source, "records": records}
        for source, records in sorted(counter.items(), key=lambda item: item[0])
    ]


def count_duplicates(long_records: list[dict]) -> int:
    counter = Counter((record["cve_ent"], record["variable"]) for record in long_records)
    return sum(count - 1 for count in counter.values() if count > 1)


def build_check(check_id: str, passed: bool, detail: str) -> dict:
    return {
        "check_id": check_id,
        "status": "passed" if passed else "failed",
        "detail": detail,
    }


def build_markdown_report(report: dict) -> str:
    lines = [
        "# Reporte de calidad y transformacion de datos",
        "",
        f"Actualizado: {report['updated_at']}",
        "",
        "## Resumen",
        "",
        f"- archivos crudos perfilados: {report['summary']['raw_files_profiled']}",
        f"- registros en formato largo: {report['summary']['records_long']}",
        f"- entidades en formato ancho: {report['summary']['states_wide']}",
        f"- metricas en catalogo: {report['summary']['metrics_in_catalog']}",
        "",
        "## Logica de transformacion",
        "",
        f"- estimador ENDUTIH: {report['cleaning_logic']['endutih_weighted_estimator']}",
        f"- estimador territorial: {report['cleaning_logic']['locality_weighted_estimator']}",
        "",
        "Pasos principales:",
    ]

    for step in report["cleaning_logic"]["key_steps"]:
        lines.append(f"- {step}")

    lines.extend(["", "## Validaciones", ""])

    for check in report["validation_checks"]:
        lines.append(f"- {check['check_id']}: {check['status']} | {check['detail']}")

    lines.extend(["", "## Perfil de metricas", ""])

    for metric in report["metrics_profile"]:
        lines.append(
            "- "
            f"{metric['metric_id']}: min {metric['min']}, max {metric['max']}, "
            f"media {metric['mean']}, desv_est {metric['std_dev']}"
        )

    lines.extend(["", "## Fuentes integradas", ""])

    for source in report["source_breakdown"]:
        lines.append(f"- {source['source']}: {source['records']} registros")

    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    main()
