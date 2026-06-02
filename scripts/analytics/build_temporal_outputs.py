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


def fit_scurve(years: np.ndarray, values: np.ndarray, last_year: int
               ) -> dict | None:
    """Ajusta curva logística S. Requiere ≥6 puntos y varianza suficiente."""
    if len(years) < 6:
        return None
    x = (years - years[0]).astype(float)
    y = values.astype(float)
    if y.max() - y.min() < 5:
        return None
    try:
        p0 = [max(y.max(), 90.0), 0.5, float(len(x) / 2)]
        bounds = ([y.max(), 0.001, 0], [100.0, 3.0, len(x) * 2])
        params, _ = curve_fit(logistic, x, y, p0=p0, bounds=bounds, maxfev=5000)
        L, k, x0 = params
        inflection_year = int(years[0] + x0)
        gap = float(L - y[-1])
        if k > 0.6:
            velocity = "Acelerada"
            velocity_label = "Crecimiento explosivo en cortos periodos"
        elif k > 0.3:
            velocity = "Moderada"
            velocity_label = "Crecimiento constante y estable"
        else:
            velocity = "Lenta"
            velocity_label = "Adopción paulatina prolongada"
        # Proyección hasta last_year+3
        proj_years = list(range(int(years[0]), last_year + 4))
        proj_x = np.array(proj_years) - years[0]
        proj_vals = [round(float(logistic(np.array([xi]), L, k, x0)[0]), 3)
                     for xi in proj_x]
        passed_inflection = int(years[-1]) >= inflection_year
        return {
            "ceiling": round(float(L), 2),
            "gap": round(gap, 2),
            "inflection_year": inflection_year,
            "passed_inflection": passed_inflection,
            "velocity": velocity,
            "velocity_label": velocity_label,
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
                   value_col: str = "value") -> list[dict]:
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
        scurve = fit_scurve(years, values, last_year)

        states_forecast[str(code)] = {
            "ols":     ols,
            "holt":    holt,
            "logistic": scurve,
        }

    save_temporal_json(var_id, records)
    save_forecast_json(var_id, states_forecast)
    print(f"  OK {var_id}.json  ({len(records)} registros)")
    return records


# ═══════════════════════════════════════════════════════════════════════════
# 1. BD_consts.csv — 3 variables × 10 años
# ═══════════════════════════════════════════════════════════════════════════
print("=" * 60)
print("1. BD_consts.csv (ENDUTIH histórico 2015-2024)")
print("=" * 60)

alias_map = build_alias_map(CATALOGS / "states.master.json")

bd_path = TEST_DATA / "BD_consts.csv"
df_bd = pd.read_csv(bd_path, encoding="utf-8-sig")
df_bd.columns = [c.strip() for c in df_bd.columns]

# Mapear nombres → state_code, descartar nacional
df_bd["state_code"] = df_bd["Entidad Federativa"].apply(lambda x: map_state(str(x), alias_map))
df_bd = df_bd.dropna(subset=["state_code"])  # excluye "Estados Unidos Mexicanos" y no mapeados

BD_VARS = {
    "hogares_con_internet_pct":    ("Pct_Hogares_Internet",  "%", "Hogares con acceso a internet"),
    "uso_internet_educacion_pct":  ("Pct_Uso_Educacion",     "%", "Uso de internet para educación"),
    "uso_internet_gobierno_pct":   ("Pct_Uso_Gobierno",      "%", "Uso de internet para trámites gubernamentales"),
}

bd_metadata: dict[str, dict] = {}
for var_id, (col, unit, label) in BD_VARS.items():
    long = df_bd[["state_code", "Anio", col]].rename(
        columns={"Anio": "year", col: "value"}
    ).dropna(subset=["value"])
    process_series(var_id, long)
    bd_metadata[var_id] = {"label": label, "unit": unit, "source": "INEGI ENDUTIH 2015-2024"}

# ═══════════════════════════════════════════════════════════════════════════
# 2. manifest.json
# ═══════════════════════════════════════════════════════════════════════════
print()
print("=" * 60)
print("2. Generando manifest.json")
print("=" * 60)

all_vars = list(BD_VARS.keys())
all_meta = {**bd_metadata}

# Solo incluir vars que realmente tienen archivo
available = [v for v in all_vars if (OUT / f"{v}.json").exists()]

manifest = {
    "updated_at": TODAY,
    "variables": available,
    "metadata": all_meta,
}
(OUT / "manifest.json").write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
)
print(f"  OK manifest.json  ({len(available)} variables: {available})")

# ═══════════════════════════════════════════════════════════════════════════
# 3. Registrar en combined.json + variables.catalog.json
#    Para que aparezcan en el sidebar con badge HIST
# ═══════════════════════════════════════════════════════════════════════════
print()
print("=" * 60)
print("3. Registrando en catálogos y combined.json")
print("=" * 60)

BD_CATALOG_ENTRIES = {
    "hogares_con_internet_pct": {
        "variable_id": "hogares_con_internet_pct",
        "nombre": "Hogares con acceso a internet",
        "label": "Hogares con internet",
        "descripcion": "Porcentaje de hogares con acceso a internet (ENDUTIH 2015-2024).",
        "unidad_base": "%",
        "unidad": "%",
        "categoria_id": "infraestructura_digital",
        "tipo_valor": "number",
        "agregacion_default": "avg",
        "fuente_sugerida": "INEGI ENDUTIH 2015-2024",
        "sinonimos": ["Pct_Hogares_Internet"],
    },
    "uso_internet_educacion_pct": {
        "variable_id": "uso_internet_educacion_pct",
        "nombre": "Uso de internet para educación",
        "label": "Internet: educación",
        "descripcion": "Porcentaje de usuarios de internet que lo usan para actividades educativas (ENDUTIH 2015-2024).",
        "unidad_base": "%",
        "unidad": "%",
        "categoria_id": "infraestructura_digital",
        "tipo_valor": "number",
        "agregacion_default": "avg",
        "fuente_sugerida": "INEGI ENDUTIH 2015-2024",
        "sinonimos": ["Pct_Uso_Educacion"],
    },
    "uso_internet_gobierno_pct": {
        "variable_id": "uso_internet_gobierno_pct",
        "nombre": "Uso de internet para trámites gubernamentales",
        "label": "Internet: gobierno",
        "descripcion": "Porcentaje de usuarios de internet que realizan trámites gubernamentales en línea (ENDUTIH 2015-2024).",
        "unidad_base": "%",
        "unidad": "%",
        "categoria_id": "infraestructura_digital",
        "tipo_valor": "number",
        "agregacion_default": "avg",
        "fuente_sugerida": "INEGI ENDUTIH 2015-2024",
        "sinonimos": ["Pct_Uso_Gobierno"],
    },
}

# — variables.catalog.json (public y data/catalogs) —
for cat_path in [ROOT / "public" / "data" / "variables.catalog.json",
                 CATALOGS / "variables.catalog.json"]:
    if not cat_path.exists():
        continue
    cat_data = json.loads(cat_path.read_text(encoding="utf-8"))
    existing_ids = {v["variable_id"] for v in cat_data.get("variables", [])}
    added = 0
    for vid, entry in BD_CATALOG_ENTRIES.items():
        if vid not in existing_ids:
            cat_data.setdefault("variables", []).append(entry)
            added += 1
    if added:
        cat_path.write_text(json.dumps(cat_data, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"  OK {cat_path.name}: +{added} variables")
    else:
        print(f"  -- {cat_path.name}: ya estaban registradas")

# — state_dashboard.combined.json (metric_catalog + valores 2024) —
COMBINED_PATH = ROOT / "public" / "data" / "state_dashboard.combined.json"
combined = json.loads(COMBINED_PATH.read_text(encoding="utf-8"))
existing_metric_ids = {m["variable_id"] for m in combined.get("metric_catalog", [])}
cat_added = 0
for vid, entry in BD_CATALOG_ENTRIES.items():
    if vid not in existing_metric_ids:
        combined.setdefault("metric_catalog", []).append({
            "variable_id": vid,
            "anio": 2024,
            "categoria_id": entry["categoria_id"],
            "label": entry["label"],
            "unidad": entry["unidad"],
        })
        cat_added += 1

# Insertar valores del año 2024 en cada registro estatal
df_2024 = df_bd[df_bd["Anio"] == 2024].set_index("state_code")
metrics_updated = 0
for record in combined.get("records", []):
    sc = record.get("state_code", "")
    if sc not in df_2024.index:
        continue
    row = df_2024.loc[sc]
    for vid, (col, *_) in BD_VARS.items():
        val = row.get(col)
        if val is not None and not (isinstance(val, float) and pd.isna(val)):
            record.setdefault("metrics", {})[vid] = round(float(val), 4)
            metrics_updated += 1

if cat_added or metrics_updated:
    from datetime import date as _date
    combined["updated_at"] = _date.today().isoformat()
    COMBINED_PATH.write_text(json.dumps(combined, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  OK combined.json: +{cat_added} metric_catalog, {metrics_updated} valores 2024")
else:
    print("  -- combined.json: sin cambios")

print()
print("=" * 60)
print("OK  TEMPORAL OUTPUTS COMPLETADOS")
print("=" * 60)
