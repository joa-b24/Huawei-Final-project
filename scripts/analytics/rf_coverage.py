"""Random Forest: cobertura 4G esperada vs observada por municipio."""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor


RF_FEATURES: tuple[str, ...] = (
    "graproes",
    "pct_sin_escolaridad_15ymas",
    "pct_posbasica_18ymas",
    "pct_pob_0_14",
    "pct_pob_15_64",
    "pct_pob_65_mas",
    "pct_mujeres",
    "irs_indice",
    "irs_pct_viv_sin_agua",
    "irs_pct_viv_sin_drenaje",
    "pobtot_iter",
)

RF_FEATURE_LABELS: dict[str, str] = {
    "graproes": "Escolaridad promedio",
    "pct_sin_escolaridad_15ymas": "Sin escolaridad (15+)",
    "pct_posbasica_18ymas": "Educación posbásica (18+)",
    "pct_pob_0_14": "Población 0–14 años",
    "pct_pob_15_64": "Población 15–64 años",
    "pct_pob_65_mas": "Población 65+ años",
    "pct_mujeres": "Proporción de mujeres",
    "irs_indice": "Índice de rezago social",
    "irs_pct_viv_sin_agua": "Viviendas sin agua",
    "irs_pct_viv_sin_drenaje": "Viviendas sin drenaje",
    "pobtot_iter": "Población municipal",
}

TARGET = "pob_pct_4g_garantizada"


def _train_rf(X: np.ndarray, y: np.ndarray) -> RandomForestRegressor:
    model = RandomForestRegressor(
        n_estimators=200,
        max_depth=8,
        min_samples_leaf=5,
        random_state=42,
        n_jobs=1,
    )
    model.fit(X, y)
    return model


def _importance_payload(model: RandomForestRegressor, feature_cols: list[str]) -> list[dict]:
    imps = model.feature_importances_
    rows = [
        {"key": col, "label": RF_FEATURE_LABELS.get(col, col), "importance": round(float(imp), 6)}
        for col, imp in zip(feature_cols, imps)
    ]
    rows.sort(key=lambda r: r["importance"], reverse=True)
    return rows


def _main_driver(
    row: pd.Series,
    feature_cols: list[str],
    importances: np.ndarray,
    medians: pd.Series,
    stds: pd.Series,
    gap: float,
) -> str:
    scores: list[tuple[float, str]] = []
    for col, imp in zip(feature_cols, importances):
        if imp < 0.005 or col not in row.index:
            continue
        val = row[col]
        if not np.isfinite(val):
            continue
        std = stds[col] if stds[col] > 1e-9 else 1.0
        z = (val - medians[col]) / std
        # Municipio subatendido: resaltar variable extrema que empuja la expectativa
        score = abs(z) * imp
        if gap < 0 and z > 0:
            score *= 0.5
        if gap > 0 and z < 0:
            score *= 0.5
        scores.append((score, col))
    if not scores:
        top = int(np.argmax(importances))
        return RF_FEATURE_LABELS.get(feature_cols[top], feature_cols[top])
    best_col = max(scores, key=lambda x: x[0])[1]
    return RF_FEATURE_LABELS.get(best_col, best_col)


def apply_rf_coverage_diagnostics(
    df: pd.DataFrame,
) -> tuple[pd.DataFrame, list[dict], dict[str, list[dict]]]:
    """
    Añade rf_4g_esperada, rf_brecha_4g_pp, rf_factor_principal al dataframe.
    Retorna importancias nacionales y por estado (cve_ent).
    """
    out = df.copy()
    out["rf_4g_esperada"] = np.nan
    out["rf_brecha_4g_pp"] = np.nan
    out["rf_factor_principal"] = ""

    feature_cols = [c for c in RF_FEATURES if c in out.columns]
    if TARGET not in out.columns or len(feature_cols) < 4:
        return out, [], {}

    X_df = out[feature_cols].replace([np.inf, -np.inf], np.nan)
    y = out[TARGET].astype(float)
    ok = X_df.notna().all(axis=1) & y.notna()
    if ok.sum() < 30:
        return out, [], {}

    X = X_df.loc[ok].to_numpy(dtype=float)
    y_ok = y.loc[ok].to_numpy(dtype=float)
    if "pobtot_iter" in feature_cols:
        idx = feature_cols.index("pobtot_iter")
        X[:, idx] = np.log1p(np.maximum(X[:, idx], 0))

    national_model = _train_rf(X, y_ok)
    national_imps = _importance_payload(national_model, feature_cols)
    preds = national_model.predict(X)
    preds = np.clip(preds, 0.0, 100.0)

    medians = X_df.loc[ok].median()
    stds = X_df.loc[ok].std().replace(0, 1.0)

    for i, idx in enumerate(out.index[ok]):
        actual = float(y.loc[idx])
        expected = float(preds[i])
        gap = actual - expected
        out.at[idx, "rf_4g_esperada"] = round(expected, 4)
        out.at[idx, "rf_brecha_4g_pp"] = round(gap, 4)
        out.at[idx, "rf_factor_principal"] = _main_driver(
            out.loc[idx],
            feature_cols,
            national_model.feature_importances_,
            medians,
            stds,
            gap,
        )

    state_imps: dict[str, list[dict]] = {}
    min_state_n = 10
    for cve_ent, g in out.loc[ok].groupby("cve_ent"):
        if len(g) < min_state_n:
            state_imps[str(cve_ent)] = national_imps
            continue
        gX = g[feature_cols].to_numpy(dtype=float)
        if "pobtot_iter" in feature_cols:
            j = feature_cols.index("pobtot_iter")
            gX = gX.copy()
            gX[:, j] = np.log1p(np.maximum(gX[:, j], 0))
        gy = g[TARGET].to_numpy(dtype=float)
        st_model = _train_rf(gX, gy)
        state_imps[str(cve_ent)] = _importance_payload(st_model, feature_cols)

    return out, national_imps, state_imps
