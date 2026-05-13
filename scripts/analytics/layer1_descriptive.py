from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import shapiro, zscore

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
PUBLIC_DATA_DIR = PROJECT_ROOT / "public" / "data"
CATALOG_PATH = PROJECT_ROOT / "data" / "catalogs" / "variables.catalog.json"
COMBINED_PATH = PUBLIC_DATA_DIR / "state_dashboard.combined.json"
OUTPUT_DIR = PUBLIC_DATA_DIR / "outputs" / "state"


def _load_direction_map() -> dict[str, str]:
    if not CATALOG_PATH.exists():
        return {}
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    return {
        v["variable_id"]: v["direction"]
        for v in catalog.get("variables", [])
        if "direction" in v
    }


class Layer1Descriptive:
    """Estadísticas descriptivas sobre el dataset combinado de 32 estados."""

    def __init__(self, df: pd.DataFrame, direction_map: dict[str, str] | None = None) -> None:
        self.combined = df
        self.direction_map: dict[str, str] = direction_map or {}

    # ── A. Estadísticas univariadas ──────────────────────────────────────────

    def univariate_stats(self) -> pd.DataFrame:
        numeric = self._numeric_cols()
        stats = self.combined[numeric].describe(percentiles=[0.25, 0.50, 0.75]).T
        stats["skewness"] = self.combined[numeric].skew()
        stats["kurtosis"] = self.combined[numeric].kurtosis()
        return stats.round(4)

    # ── B. Distribuciones ────────────────────────────────────────────────────

    def distribution_analysis(self) -> dict:
        output = {}
        for col in self._numeric_cols():
            data = self.combined[col].dropna()
            hist, bins = np.histogram(data, bins=10)
            stat, pval = (shapiro(data) if len(data) > 3 else (float("nan"), float("nan")))
            output[col] = {
                "histogram": {"bins": bins.tolist(), "counts": hist.tolist()},
                "normality": {
                    "statistic": float(stat) if not _isnan(stat) else None,
                    "p_value": float(pval) if not _isnan(pval) else None,
                    "is_normal": bool(pval > 0.05) if not _isnan(pval) else None,
                    "test": "Shapiro-Wilk",
                },
            }
        return output

    # ── C. Correlaciones ─────────────────────────────────────────────────────

    def correlation_matrices(self, pearson: bool = True, spearman: bool = True) -> dict:
        numeric = self._numeric_cols()
        output: dict = {}
        if pearson:
            m = self.combined[numeric].corr(method="pearson")
            output["pearson"] = {"matrix": m.values.tolist(), "variables": m.columns.tolist(),
                                  "note": "Correlación de Pearson — asume relación lineal"}
        if spearman:
            m = self.combined[numeric].corr(method="spearman")
            output["spearman"] = {"matrix": m.values.tolist(), "variables": m.columns.tolist(),
                                   "note": "Correlación de Spearman — robusto a outliers"}
        return output

    # ── D. Outliers ──────────────────────────────────────────────────────────

    def outlier_detection(self, method: str = "iqr") -> dict:
        numeric = self._numeric_cols()
        result: dict = {}
        for col in numeric:
            series = self.combined[col]
            if method == "iqr":
                q1, q3 = series.quantile(0.25), series.quantile(0.75)
                iqr = q3 - q1
                lower, upper = q1 - 1.5 * iqr, q3 + 1.5 * iqr
                mask = (series < lower) | (series > upper)
            else:
                z = zscore(series.dropna())
                mask = np.abs(z) > 3

            if mask.sum() > 0:
                result[col] = {
                    "outlier_states": self.combined.loc[mask, "state_code"].tolist(),
                    "values": series[mask].tolist(),
                    "bounds": {"lower": float(lower), "upper": float(upper)},
                    "method": "IQR" if method == "iqr" else "Z-score",
                }
        return result

    # ── E. Rankings ──────────────────────────────────────────────────────────

    def state_rankings(self) -> dict:
        rankings: dict = {}
        estado_col = "estado" if "estado" in self.combined.columns else None
        for col in self._numeric_cols():
            direction = self.direction_map.get(col, "higher_better")
            ascending = direction == "lower_better"
            cols = ["state_code"] + ([estado_col] if estado_col else []) + [col]
            df_sorted = (
                self.combined[cols]
                .sort_values(col, ascending=ascending)
                .reset_index(drop=True)
            )
            mean_val = self.combined[col].mean()
            rankings[col] = [
                {
                    "rank": i + 1,
                    "state": row["state_code"],
                    "estado": row.get(estado_col, row["state_code"]) if estado_col else row["state_code"],
                    "value": float(row[col]),
                    "pct_vs_mean": float(((row[col] - mean_val) / mean_val) * 100) if mean_val != 0 else 0,
                }
                for i, (_, row) in enumerate(df_sorted.iterrows())
            ]
        return rankings

    # ── F. State profile cards ───────────────────────────────────────────────

    def state_profile_cards(self) -> dict:
        numeric = self._numeric_cols()
        cards: dict = {}
        for _, row in self.combined.iterrows():
            state = row["state_code"]
            cards[state] = {
                "estado": row.get("estado", state),
                "region": row.get("region", ""),
                "metrics": {col: float(row[col]) for col in numeric if not _isnan(row[col])},
            }
        return cards

    # ── Export ───────────────────────────────────────────────────────────────

    def univariate_stats_json(self) -> dict:
        import math

        def _f(v) -> float | None:
            try:
                f = float(v)
                return None if (math.isnan(f) or math.isinf(f)) else f
            except (TypeError, ValueError):
                return None

        stats = self.univariate_stats()
        result: dict = {}
        for col, row in stats.iterrows():
            result[str(col)] = {
                "count": int(row.get("count", 0)),
                "mean": _f(row.get("mean")),
                "std": _f(row.get("std")),
                "min": _f(row.get("min")),
                "q25": _f(row.get("25%")),
                "q50": _f(row.get("50%")),
                "q75": _f(row.get("75%")),
                "max": _f(row.get("max")),
                "skewness": _f(row.get("skewness")),
                "kurtosis": _f(row.get("kurtosis")),
            }
        return result

    def export(self, output_dir: Path = OUTPUT_DIR, new_vars: set[str] | None = None) -> Path:
        output_dir.mkdir(parents=True, exist_ok=True)
        if new_vars is None:
            self._export_full(output_dir)
        else:
            self._export_partial(output_dir, new_vars)
        self.combined.to_csv(output_dir / "combined_data.csv", index=False)
        stats_df = self.univariate_stats()
        stats_df.to_csv(output_dir / "univariate_stats.csv")
        (output_dir / "univariate_stats.json").write_text(
            json.dumps(self.univariate_stats_json(), ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(f"  [ok] univariate_stats.json")
        print(f"Layer1 finalizado en: {output_dir}")
        return output_dir

    def _export_full(self, output_dir: Path) -> None:
        files = {
            "distributions.json": self.distribution_analysis(),
            "correlations.json": self.correlation_matrices(),
            "outliers_iqr.json": self.outlier_detection(method="iqr"),
            "rankings.json": self.state_rankings(),
        }
        for filename, data in files.items():
            (output_dir / filename).write_text(
                json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            print(f"  [ok] {filename}")

    def _export_partial(self, output_dir: Path, new_vars: set[str]) -> None:
        valid_vars = {v for v in new_vars if v in self.combined.columns}
        if not valid_vars:
            print("  [warn] Variables no encontradas en el dataset combinado, ejecutando recálculo completo...")
            self._export_full(output_dir)
            return

        per_var_files: dict[str, dict] = {
            "distributions.json": self.distribution_analysis(),
            "outliers_iqr.json": self.outlier_detection(method="iqr"),
            "rankings.json": self.state_rankings(),
        }
        for filename, fresh in per_var_files.items():
            target = output_dir / filename
            existing: dict = json.loads(target.read_text(encoding="utf-8")) if target.exists() else {}
            for var_id in valid_vars:
                if var_id in fresh:
                    existing[var_id] = fresh[var_id]
                    print(f"  [ok] {filename} ← {var_id}")
            target.write_text(json.dumps(existing, ensure_ascii=False, indent=2), encoding="utf-8")

        self._update_correlations_partial(output_dir / "correlations.json", valid_vars)

    def _update_correlations_partial(self, target: Path, new_vars: set[str]) -> None:
        existing: dict = json.loads(target.read_text(encoding="utf-8")) if target.exists() else {}

        for method in ("pearson", "spearman"):
            block = existing.get(method, {"matrix": [], "variables": [], "note": ""})
            ex_vars: list[str] = block["variables"]
            matrix: list[list] = block["matrix"]

            for var_id in new_vars:
                if var_id not in self.combined.columns:
                    continue
                if var_id not in ex_vars:
                    ex_vars.append(var_id)
                    for row in matrix:
                        row.append(None)
                    matrix.append([None] * len(ex_vars))

                idx = ex_vars.index(var_id)
                for j, other in enumerate(ex_vars):
                    if other not in self.combined.columns:
                        continue
                    pair = self.combined[[var_id, other]].dropna()
                    corr = float(pair.corr(method=method).iloc[0, 1]) if len(pair) > 2 else None
                    if corr is not None and np.isnan(corr):
                        corr = None
                    matrix[idx][j] = corr
                    matrix[j][idx] = corr

            block["variables"] = ex_vars
            block["matrix"] = matrix
            existing[method] = block
            print(f"  [ok] correlations.json ({method}) ← {new_vars}")

        target.write_text(json.dumps(existing, ensure_ascii=False, indent=2), encoding="utf-8")

    # ── Helpers ──────────────────────────────────────────────────────────────

    def _numeric_cols(self) -> list[str]:
        return self.combined.select_dtypes(include=["float64", "int64"]).columns.tolist()


def _isnan(x: object) -> bool:
    try:
        return bool(np.isnan(float(x)))  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return True


def load_combined_json(path: Path) -> pd.DataFrame:
    data = json.loads(path.read_text(encoding="utf-8"))
    rows = []
    for r in data["records"]:
        row: dict = {
            "state_code": r["state_code"],
            "cve_ent": r.get("cve_ent", ""),
            "estado": r.get("estado", r["state_code"]),
            "region": r.get("region", ""),
        }
        row.update(r.get("metrics", {}))
        rows.append(row)
    return pd.DataFrame(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description="Layer1: estadísticas descriptivas sobre el dataset combinado.")
    parser.add_argument(
        "--new-vars",
        default=None,
        help="IDs de variables nuevas separados por coma (activa recálculo parcial).",
    )
    parser.add_argument(
        "--input",
        default=str(COMBINED_PATH),
        help=f"Ruta del combined JSON (default: {COMBINED_PATH})",
    )
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        print(f"✗ No se encontró el combined JSON: {input_path}")
        print("  Ejecuta primero: python scripts/combine_data.py")
        return

    new_vars: set[str] | None = None
    if args.new_vars:
        new_vars = {v.strip() for v in args.new_vars.split(",") if v.strip()}
        print(f"Recálculo parcial: {new_vars}")

    df = load_combined_json(input_path)
    direction_map = _load_direction_map()
    layer1 = Layer1Descriptive(df, direction_map=direction_map)
    layer1.export(new_vars=new_vars)


if __name__ == "__main__":
    main()
