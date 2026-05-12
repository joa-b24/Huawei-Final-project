#!/usr/bin/env python3
"""
combine_data.py — Fusiona múltiples wide JSONs estatales en un único combined JSON para correr script de análisis y alimentar el dashboard.

Uso:
    python scripts/combine_data.py                        # usa todos los *_dashboard.wide.json en public/data/
    python scripts/combine_data.py file1.json file2.json  # fuentes explícitas (orden = autoridad, último gana)

Salida: public/data/state_dashboard.combined.json
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PUBLIC_DATA_DIR = PROJECT_ROOT / "public" / "data"
OUTPUT_PATH = PUBLIC_DATA_DIR / "state_dashboard.combined.json"


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def combine(sources: list[Path]) -> dict:
    """Merge wide JSONs en orden; el último gana en caso de conflicto."""
    catalog: dict[str, dict] = {}   # keyed by variable_id
    records: dict[str, dict] = {}   # keyed by state_code
    source_labels: list[str] = []

    for src_path in sources:
        data = load_json(src_path)
        source_labels.append(data.get("source", src_path.name))

        for entry in data.get("metric_catalog", []):
            vid = entry.get("variable_id")
            if vid:
                catalog[vid] = entry

        for r in data.get("records", []):
            sc = r.get("state_code")
            if not sc:
                continue
            if sc not in records:
                records[sc] = {
                    "state_code": sc,
                    "cve_ent": r.get("cve_ent", ""),
                    "estado": r.get("estado", sc),
                    "region": r.get("region", ""),
                    "metrics": {},
                }
            for field in ("cve_ent", "estado", "region"):
                if r.get(field):
                    records[sc][field] = r[field]
            records[sc]["metrics"].update(r.get("metrics", {}))

    return {
        "updated_at": date.today().isoformat(),
        "schema_version": "2.0",
        "sources": source_labels,
        "metric_catalog": list(catalog.values()),
        "records": sorted(records.values(), key=lambda r: r["state_code"]),
    }


def resolve_sources(raw: list[str]) -> list[Path]:
    if raw:
        return [Path(s) for s in raw]
    found = sorted(PUBLIC_DATA_DIR.glob("*_dashboard.wide.json"))
    if not found:
        print("✗ No se encontraron archivos *_dashboard.wide.json en public/data/")
        sys.exit(1)
    return found


def main() -> None:
    parser = argparse.ArgumentParser(description="Combina wide JSONs estatales.")
    parser.add_argument(
        "sources",
        nargs="*",
        help="Archivos wide JSON a combinar (orden de autoridad, último gana).",
    )
    parser.add_argument(
        "--output",
        default=str(OUTPUT_PATH),
        help=f"Ruta de salida (default: public/data/state_dashboard.combined.json)",
    )
    args = parser.parse_args()

    sources = resolve_sources(args.sources)

    missing = [s for s in sources if not s.exists()]
    if missing:
        for m in missing:
            print(f"✗ No encontrado: {m}")
        sys.exit(1)

    print(f"Combinando {len(sources)} fuente(s):")
    for s in sources:
        try:
            rel = s.relative_to(PROJECT_ROOT)
        except ValueError:
            rel = s
        print(f"  {rel}")

    combined = combine(sources)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    save_json(output_path, combined)

    n_vars = len(combined["metric_catalog"])
    n_states = len(combined["records"])
    try:
        rel_out = output_path.relative_to(PROJECT_ROOT)
    except ValueError:
        rel_out = output_path
    print(f"✓ {rel_out}  ({n_vars} variables · {n_states} estados)")


if __name__ == "__main__":
    main()
