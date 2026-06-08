"""
build_temporal_outputs.py
=========================
Genera los archivos JSON que consume el tab Evolución del dashboard.

Fuentes:
  1. test_data/BD_consts.csv       — Pct_Hogares_Internet, Pct_Uso_Educacion,
                                     Pct_Uso_Gobierno  (2015-2024, ENDUTIH/INEGI)
  2. data/processed/context_variables_state_observations.long.json
                                   — pobreza_pct, rezago_educativo_pct,
                                     pib_per_capita  (2020, 2022, 2024)

Salidas en public/data/outputs/temporal/:
  manifest.json          — lista de variables disponibles + metadata de labels
  {varId}.json           — registros históricos por estado y año
  {varId}.forecast.json  — tendencia OLS, proyección Holt y (si ≥6 puntos) curva S
"""

from __future__ import annotations

import json
import warnings
import unicodedata
from pathlib import Path

import numpy as np
import pandas as pd
from statsmodels.tsa.holtwinters import Holt
from scipy.optimize import curve_fit, OptimizeWarning

warnings.filterwarnings("ignore", category=OptimizeWarning)
warnings.filterwarnings("ignore")

# ─── Rutas ───────────────────────────────────────────────────────────────────
ROOT       = Path(__file__).resolve().parent.parent.parent
TEST_DATA  = ROOT / "test_data"
PROCESSED  = ROOT / "data" / "processed"
CATALOGS   = ROOT / "data" / "catalogs"
OUT        = ROOT / "public" / "data" / "outputs" / "temporal"
OUT.mkdir(parents=True, exist_ok=True)

TODAY = "2026-05-27"


# ─── Helpers ─────────────────────────────────────────────────────────────────

def normalize(s: str) -> str:
    """Quita acentos y pasa a minúsculas para comparación fuzzy."""
    return unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower().strip()


def build_alias_map(catalog_path: Path) -> dict[str, str]:
    """Retorna dict alias_normalizado → state_code."""
    data = json.loads(catalog_path.read_text(encoding="utf-8"))
    m: dict[str, str] = {}
    for s in data["states"]:
        code = s["state_code"]
        m[normalize(s["estado"])] = code
        for alias in s.get("aliases", []):
            m[normalize(alias)] = code
    return m


def build_direction_map(catalog_path: Path) -> dict[str, str]:
    """Retorna dict variable_id → direction ('higher_better' | 'lower_better')."""
    data = json.loads(catalog_path.read_text(encoding="utf-8"))
    return {v["variable_id"]: v.get("direction", "higher_better") for v in data.get("variables", [])}


def map_state(name: str, alias_map: dict[str, str]) -> str | None:
    return alias_map.get(normalize(name))


# ─── Modelos ─────────────────────────────────────────────────────────────────

def ols_trend(years: np.ndarray, values: np.ndarray, forecast_year: int
              ) -> dict:
    """OLS lineal: retorna pendiente, intercepto, R², y valor proyectado."""
    n = len(years)
    x = years.astype(float)
    y = values.astype(float)
    xm, ym = x.mean(), y.mean()
    slope = float(np.sum((x - xm) * (y - ym)) / np.sum((x - xm) ** 2))
    intercept = float(ym - slope * xm)
    y_hat = slope * x + intercept
    ss_res = float(np.sum((y - y_hat) ** 2))
    ss_tot = float(np.sum((y - ym) ** 2))
    r2 = 1 - ss_res / ss_tot if ss_tot > 0 else float("nan")
    # Tendencia completa: desde primer año hasta forecast_year
    trend_years = list(range(int(years[0]), forecast_year + 1))
    trend_values = [round(slope * yr + intercept, 3) for yr in trend_years]
    return {
        "slope": round(slope, 4),
        "intercept": round(intercept, 4),
        "r2": round(r2, 4) if not np.isnan(r2) else None,
        "forecast_year": forecast_year,
        "forecast_value": round(slope * forecast_year + intercept, 3),
        "trend_years": trend_years,
        "trend_values": trend_values,
    }


def holt_forecast(values: np.ndarray, last_year: int, steps: int = 1
                  ) -> list[dict]:
    """Holt amortiguado. Retorna lista de {year, value} proyectados."""
    try:
        model = Holt(values.astype(float),
                     initialization_method="estimated",
                     damped_trend=True).fit(optimized=True)
        preds = model.forecast(steps)
        return [{"year": last_year + i + 1, "value": round(float(v), 3)}
                for i, v in enumerate(preds)]
    except Exception:
        return []


def logistic(x: np.ndarray, L: float, k: float, x0: float) -> np.ndarray:
    return L / (1 + np.exp(-k * (x - x0)))


def fit_scurve(years: np.ndarray, values: np.ndarray, last_year: int,
               direction: str = "higher_better",
               ceiling_max: float | None = None) -> dict | None:
    """
    Ajusta curva logística S. Requiere ≥6 puntos y varianza suficiente.

    Para variables 'lower_better' (e.g. pobreza_pct) invierte la serie antes
    del ajuste: y_fit = y[0] - y (crece cuando la variable decrece).
    El campo 'ceiling' devuelto es el piso de saturación esperado.
    """
    if len(years) < 6:
        return None
    x = (years - years[0]).astype(float)
    y = values.astype(float)
    if y.max() - y.min() < 5:
        return None

    is_lower = direction == "lower_better"
    amplitude = float(y.max() - y.min())  # rango observado — escala-agnóstico

    if is_lower:
        # Serie invertida: crece a medida que la variable mejora (baja)
        y_fit = y[0] - y
        L_lower = max(float(y_fit.max()), amplitude * 0.5)
        # Techo de mejora: como mínimo el doble del rango observado, sin asumir límite de 100
        L_upper = max(amplitude * 4.0, float(y[0]) * 0.95)
        p0 = [L_lower * 1.5, 0.5, float(len(x) / 2)]
        bounds = ([L_lower, 0.001, 0.0], [L_upper, 3.0, float(len(x)) * 2])
    else:
        y_fit = y
        L_min = float(y.max())
        # Si hay un máximo natural (e.g. 100 para %) lo respetamos; si no, usamos el rango
        L_max = float(ceiling_max) if ceiling_max is not None else L_min + amplitude * 4.0
        p0 = [min(L_min + amplitude, L_max), 0.5, float(len(x) / 2)]
        bounds = ([L_min, 0.001, 0.0], [L_max, 3.0, float(len(x)) * 2])

    try:
        params, _ = curve_fit(logistic, x, y_fit, p0=p0, bounds=bounds, maxfev=5000)
        L, k, x0_param = params
        inflection_year = int(years[0] + x0_param)
        passed_inflection = int(years[-1]) >= inflection_year

        if is_lower:
            floor_val = float(y[0]) - float(L)
            ceiling_out = round(floor_val, 2)
            gap_out = round(float(y[-1]) - floor_val, 2)
        else:
            ceiling_out = round(float(L), 2)
            gap_out = round(float(L) - float(y[-1]), 2)

        # Cuando la inflexión cae en el primer año o antes, el modelo solo ve
        # la desaceleración final (meseta); k no refleja la velocidad de adopción
        # real sino qué tan rápido se acerca al techo. En ese caso usamos la
        # pendiente OLS (pp/año) como indicador del ritmo actual observable.
        inflection_in_data = x0_param >= 1.0  # al menos 1 año dentro de la serie

        if not inflection_in_data:
            # Fase madura: ritmo relativo = fracción del rango total cubierta por año
            n_years = float(len(years) - 1) if len(years) > 1 else 1.0
            ols_slope = float(np.polyfit(x, y if not is_lower else y_fit, 1)[0])
            # Ritmo relativo: qué fracción del rango observado se avanza por año
            rel_rate = abs(ols_slope) / amplitude if amplitude > 0 else 0.0
            if rel_rate > 0.12:   # > 12% del rango por año → rápido
                velocity = "Maduración rápida"
                velocity_label = (
                    "El indicador ya superó su pico de crecimiento (antes del período disponible) "
                    "y continúa avanzando a buen ritmo hacia su techo de saturación"
                )
            elif rel_rate > 0.04:  # > 4% del rango por año → gradual
                velocity = "Maduración"
                velocity_label = (
                    "El indicador ya superó su pico de crecimiento (antes del período disponible) "
                    "y se aproxima gradualmente a su techo de saturación"
                )
            else:                  # ≤ 4% del rango por año → lento
                velocity = "Maduración lenta"
                velocity_label = (
                    "El indicador ya superó su pico de crecimiento (antes del período disponible) "
                    "y converge muy lentamente hacia su techo de saturación"
                )
        elif is_lower:
            if k > 0.6:
                velocity = "Acelerada"
                velocity_label = "Reducción acelerada — ciclo completo estimado en ~5 años"
            elif k > 0.3:
                velocity = "Moderada"
                velocity_label = "Reducción constante y estable"
            else:
                velocity = "Lenta"
                velocity_label = "Reducción gradual prolongada"
        else:
            if k > 0.6:
                velocity = "Acelerada"
                velocity_label = "Crecimiento explosivo — ciclo completo estimado en ~5 años"
            elif k > 0.3:
                velocity = "Moderada"
                velocity_label = "Crecimiento constante y estable"
            else:
                velocity = "Lenta"
                velocity_label = "Adopción paulatina prolongada"

        # Proyección hasta last_year+3 (valores en escala original)
        proj_years = list(range(int(years[0]), last_year + 4))
        proj_x = np.array(proj_years, dtype=float) - years[0]
        proj_vals_fit = [float(logistic(np.array([xi]), L, k, x0_param)[0]) for xi in proj_x]
        if is_lower:
            proj_vals = [round(float(y[0]) - pv, 3) for pv in proj_vals_fit]
        else:
            proj_vals = [round(pv, 3) for pv in proj_vals_fit]

        return {
            "ceiling": ceiling_out,   # piso cuando direction="lower_better"
            "gap": gap_out,
            "inflection_year": inflection_year,
            "passed_inflection": passed_inflection,
            "velocity": velocity,
            "velocity_label": velocity_label,
            "direction": direction,
            "proj_years": proj_years,
            "proj_values": proj_vals,
        }
    except Exception:
        return None


# ─── Funciones principales ───────────────────────────────────────────────────

def save_temporal_json(var_id: str, records: list[dict]) -> None:
    payload = {
        "variable_id": var_id,
        "updated_at": TODAY,
        "records": records,
    }
    (OUT / f"{var_id}.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def save_forecast_json(var_id: str, states_forecast: dict) -> None:
    payload = {
        "variable_id": var_id,
        "updated_at": TODAY,
        "states": states_forecast,
    }
    (OUT / f"{var_id}.forecast.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def process_series(var_id: str, df_long: pd.DataFrame,
                   state_col: str = "state_code",
                   year_col: str = "year",
                   value_col: str = "value",
                   direction: str = "higher_better",
                   ceiling_max: float | None = None) -> list[dict]:
    """Convierte un DataFrame long en lista de records y calcula forecasts."""
    records = []
    states_forecast: dict[str, dict] = {}

    for code, grp in df_long.groupby(state_col):
        grp = grp.sort_values(year_col)
        years  = grp[year_col].values.astype(int)
        values = grp[value_col].values.astype(float)

        # Filtrar NaN
        mask = ~np.isnan(values)
        years, values = years[mask], values[mask]
        if len(years) == 0:
            continue

        for yr, val in zip(years, values):
            records.append({"state_code": str(code), "year": int(yr), "value": round(float(val), 4)})

        if len(years) < 2:
            continue

        last_year = int(years[-1])
        forecast_year = last_year + 1
        ols    = ols_trend(years, values, forecast_year)
        holt   = holt_forecast(values, last_year, steps=2)
        scurve = fit_scurve(years, values, last_year, direction=direction, ceiling_max=ceiling_max)

        states_forecast[str(code)] = {
            "ols":     ols,
            "holt":    holt,
            "logistic": scurve,
        }

    save_temporal_json(var_id, records)
    save_forecast_json(var_id, states_forecast)
    print(f"  OK {var_id}.json  ({len(records)} registros, direction={direction})")
    return records


# ═══════════════════════════════════════════════════════════════════════════
# Cargar catálogo una sola vez — fuente de verdad para metadatos y dirección
# ═══════════════════════════════════════════════════════════════════════════
alias_map  = build_alias_map(CATALOGS / "states.master.json")
cat_data   = json.loads((CATALOGS / "variables.catalog.json").read_text(encoding="utf-8"))
cat_vars   = {v["variable_id"]: v for v in cat_data.get("variables", [])}
direction_map = {vid: v.get("direction", "higher_better") for vid, v in cat_vars.items()}

# ═══════════════════════════════════════════════════════════════════════════
# 1. BD_consts.csv — auto-descubrimiento por sinonimos del catálogo
# ═══════════════════════════════════════════════════════════════════════════
print("=" * 60)
print("1. BD_consts.csv — descubrimiento automático por sinonimos")
print("=" * 60)

bd_path = TEST_DATA / "BD_consts.csv"
df_bd = pd.read_csv(bd_path, encoding="utf-8-sig")
df_bd.columns = [c.strip() for c in df_bd.columns]
df_bd["state_code"] = df_bd["Entidad Federativa"].apply(lambda x: map_state(str(x), alias_map))
df_bd = df_bd.dropna(subset=["state_code"])

bd_cols = set(df_bd.columns)

# bd_col_map: vid → nombre de columna en el CSV (para actualizar combined.json después)
bd_col_map:  dict[str, str]  = {}
bd_metadata: dict[str, dict] = {}

for vid, v in cat_vars.items():
    for sin in v.get("sinonimos", []):
        if sin not in bd_cols:
            continue
        long = (
            df_bd[["state_code", "Anio", sin]]
            .rename(columns={"Anio": "year", sin: "value"})
            .dropna(subset=["value"])
        )
        unit = v.get("unidad", v.get("unidad_base", ""))
        # Para variables acotadas naturalmente (porcentaje → 100, índice 0-1 → 1) se pasa el techo
        ceiling_max: float | None = 100.0 if unit in ("%", "pct", "porcentaje") else None
        process_series(vid, long, direction=direction_map.get(vid, "higher_better"), ceiling_max=ceiling_max)
        bd_col_map[vid] = sin
        bd_metadata[vid] = {
            "label":  v.get("label", v.get("nombre", vid)),
            "unit":   v.get("unidad", v.get("unidad_base", "")),
            "source": v.get("fuente_sugerida", ""),
        }
        break  # primer sinonimo que coincida es suficiente

if not bd_col_map:
    print("  AVISO: ninguna variable del catálogo coincide con columnas de BD_consts.csv")

# ═══════════════════════════════════════════════════════════════════════════
# 2. manifest.json
# ═══════════════════════════════════════════════════════════════════════════
print()
print("=" * 60)
print("2. Generando manifest.json")
print("=" * 60)

available = [vid for vid in bd_col_map if (OUT / f"{vid}.json").exists()]

manifest = {
    "updated_at": TODAY,
    "variables": available,
    "metadata": {vid: bd_metadata[vid] for vid in available},
}
(OUT / "manifest.json").write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
)
print(f"  OK manifest.json  ({len(available)} variables: {available})")

# ═══════════════════════════════════════════════════════════════════════════
# 3. Actualizar combined.json con valores del último año disponible
#    (no modifica catálogo — las variables deben importarse con import_variable.py)
# ═══════════════════════════════════════════════════════════════════════════
print()
print("=" * 60)
print("3. Actualizando combined.json")
print("=" * 60)

COMBINED_PATH = ROOT / "public" / "data" / "state_dashboard.combined.json"
combined = json.loads(COMBINED_PATH.read_text(encoding="utf-8"))

# Insertar valores del año más reciente disponible por variable
metrics_updated = 0
for vid, col in bd_col_map.items():
    last_year = int(df_bd["Anio"].max())
    df_last = df_bd[df_bd["Anio"] == last_year].set_index("state_code")
    for record in combined.get("records", []):
        sc = record.get("state_code", "")
        if sc not in df_last.index:
            continue
        val = df_last.loc[sc].get(col)
        if val is not None and not (isinstance(val, float) and pd.isna(val)):
            record.setdefault("metrics", {})[vid] = round(float(val), 4)
            metrics_updated += 1

if metrics_updated:
    from datetime import date as _date
    combined["updated_at"] = _date.today().isoformat()
    COMBINED_PATH.write_text(json.dumps(combined, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  OK combined.json: {metrics_updated} valores actualizados")
else:
    print("  -- combined.json: sin cambios")

print()
print("=" * 60)
print("OK  TEMPORAL OUTPUTS COMPLETADOS")
print("=" * 60)
