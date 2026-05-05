from __future__ import annotations

import json
import os
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import shapiro, zscore

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"
OUTPUT_DIR = PROCESSED_DIR  # Layer1 escribe en processed/; publish.py copia a public/data/


class Layer1Descriptive:
    """Capa descriptiva: estadísticas univariadas, distribuciones, correlaciones,
    outliers y rankings sobre el dataset combinado de 32 estados."""

    def __init__(self, context_df: pd.DataFrame, digital_df: pd.DataFrame) -> None:
        meta_cols = ["cve_ent", "estado", "region"]
        self.combined = pd.merge(
            context_df,
            digital_df.drop(columns=[c for c in meta_cols if c in digital_df.columns], errors="ignore"),
            on="state_code",
            how="outer",
        )

    # ── A. Estadísticas univariadas ──────────────────────────────────────────

    def univariate_stats(self) -> pd.DataFrame:
        numeric = self._numeric_cols()
        stats = self.combined[numeric].describe(percentiles=[0.25, 0.75]).T
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
            cols = ["state_code"] + ([estado_col] if estado_col else []) + [col]
            df_sorted = self.combined[cols].sort_values(col).reset_index(drop=True)
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

    # ── G. State profile cards ───────────────────────────────────────────────

    def state_profile_cards(self) -> dict:
        numeric = self._numeric_cols()
        col_min = self.combined[numeric].min()
        col_max = self.combined[numeric].max()
        col_range = (col_max - col_min).replace(0, float("nan"))
        normalized = (self.combined[numeric] - col_min) / col_range

        cards: dict = {}
        for idx, row in self.combined.iterrows():
            state = row["state_code"]
            norm_vals = normalized.loc[idx].dropna().values
            overall = float(np.mean(norm_vals) * 100) if len(norm_vals) > 0 else 0.0
            cards[state] = {
                "estado": row.get("estado", state),
                "region": row.get("region", ""),
                "metrics": {col: float(row[col]) for col in numeric if not _isnan(row[col])},
                "overall_score": round(overall, 2),
                "color_code": "green" if overall > 70 else "yellow" if overall > 50 else "red",
            }
        return cards

    # ── Export ───────────────────────────────────────────────────────────────

    def export(self, output_dir: Path = OUTPUT_DIR) -> Path:
        output_dir.mkdir(parents=True, exist_ok=True)

        analyses = {
            "distributions.json": self.distribution_analysis(),
            "correlations.json": self.correlation_matrices(),
            "outliers_iqr.json": self.outlier_detection(method="iqr"),
            "rankings.json": self.state_rankings(),
            "state_cards.json": self.state_profile_cards(),
        }
        for filename, data in analyses.items():
            (output_dir / filename).write_text(
                json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
            )
        self.univariate_stats().to_csv(output_dir / "univariate_stats.csv")
        self.combined.to_csv(output_dir / "combined_data.csv", index=False)
        print(f"Layer1 outputs escritos en: {output_dir}")
        return output_dir

    # ── Helpers ──────────────────────────────────────────────────────────────

    def _numeric_cols(self) -> list[str]:
        return self.combined.select_dtypes(include=["float64", "int64"]).columns.tolist()


def _isnan(x: object) -> bool:
    try:
        return bool(np.isnan(float(x)))  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return True


def load_wide_json(path: Path) -> pd.DataFrame:
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
    context_df = load_wide_json(PROCESSED_DIR / "context_variables_state_dashboard.wide.json")
    digital_df = load_wide_json(PROCESSED_DIR / "endutih_2024_state_dashboard.wide.json")
    digital_df = digital_df.drop(columns=["anio"], errors="ignore")

    layer1 = Layer1Descriptive(context_df, digital_df)
    layer1.export()


if __name__ == "__main__":
    main()
