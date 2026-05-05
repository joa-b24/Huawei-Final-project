"""publish.py — Copia los outputs del pipeline a public/data/ para que el frontend los sirva.

Es el único punto de contacto entre el pipeline Python y la app React.
Ejecutar después de correr todos los scripts de etl/ y analytics/.

Uso:
    python pipeline/publish.py
    python pipeline/publish.py --dry-run   # muestra qué copiaría sin hacerlo
"""
from __future__ import annotations

import argparse
import shutil
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"
PUBLIC_DIR = PROJECT_ROOT / "public" / "data"

# Mapa: archivo fuente en data/processed/ → nombre destino en public/data/.
# Para agregar un nuevo dataset al frontend: solo añadir una línea aquí.
PUBLISH_MAP: dict[str, str] = {
    # ETL outputs — datos por estado
    "endutih_2024_state_dashboard.wide.json": "endutih_2024_state_dashboard.wide.json",
    "context_variables_state_dashboard.wide.json": "context_variables_state_dashboard.wide.json",
    "cobertura_red_por_estado_2025.json": "cobertura_red_por_estado_2025.json",
    "cobertura_red_por_municipio_2025.json": "cobertura_red_por_municipio_2025.json",
    # Analytics outputs — Layer 1
    "state_cards.json": "state_cards.json",
    "correlations.json": "correlations.json",
    "distributions.json": "distributions.json",
    "rankings.json": "rankings.json",
    "outliers_iqr.json": "outliers_iqr.json",
}


def publish(dry_run: bool = False) -> None:
    if not dry_run:
        PUBLIC_DIR.mkdir(parents=True, exist_ok=True)

    ok, missing = 0, 0
    for src_name, dst_name in PUBLISH_MAP.items():
        src = PROCESSED_DIR / src_name
        dst = PUBLIC_DIR / dst_name
        if not src.exists():
            print(f"  [MISSING] {src.relative_to(PROJECT_ROOT)}")
            missing += 1
            continue
        if dry_run:
            print(f"  [dry-run] {src.relative_to(PROJECT_ROOT)} -> {dst.relative_to(PROJECT_ROOT)}")
        else:
            shutil.copy2(src, dst)
            print(f"  [ok]      {src.relative_to(PROJECT_ROOT)} -> {dst.relative_to(PROJECT_ROOT)}")
        ok += 1

    print(f"\nPublish completo: {ok} archivos copiados, {missing} faltantes.")
    if missing:
        print("  Tip: corre primero pipeline/etl/*.py y pipeline/analytics/layer1_descriptive.py")


def main() -> None:
    parser = argparse.ArgumentParser(description="Publica outputs del pipeline a public/data/")
    parser.add_argument("--dry-run", action="store_true", help="Muestra qué copiaría sin hacerlo")
    args = parser.parse_args()
    publish(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
