# Pipeline analítico: estandarizar → clustering → Gini / Theil → dashboard

Este documento describe el flujo acordado para que el entregable tenga **base explícita de ciencia de datos** además de visualización.

## Orden de las etapas

1. **Dataset maestro municipal** — Cruce de fuentes oficiales (INEGI ITER 2020, CONEVAL IRS 2020, brechas de conectividad por localidad INEGI/IFT 2024, Ookla 2025 cuando exista observación).
2. **Features derivadas** — Porcentajes de educación, brechas población–localidades en 3G/4G, estructura por edad, etc.
3. **Estandarización** — `StandardScaler` (media 0, varianza 1) sobre las columnas usadas en clustering. Los valores crudos se conservan en el dataset; las columnas `_z` son las escaladas.
4. **Clustering** — `KMeans` con \(k = 2..7\), selección de \(k\) por **silhouette score** (máximo en el rango). Perfil de cada cluster: medias de variables clave; etiqueta corta generada por reglas (no LLM).
5. **Desigualdad** — **Gini** y **Theil L** (mean log deviation) **ponderados por población municipal** sobre indicadores de cobertura 4G (y 3G como referencia).
6. **Salida para dashboard** — JSON en `public/data/` listo para `fetch()` desde el front: tabla municipal enriquecida, KPIs nacionales y por estado, correlación Spearman educación–cobertura y con **% mujeres**, **% 65+** y **% 0–14** (asociación, no causalidad).

## Vista web (sección 6)

En la app (`npm run dev`), la tarjeta **«6. Análisis territorial por estado»** carga esos JSON, permite elegir un estado y muestra Lorenz + Gini, matriz Spearman entre municipios del estado, dispersión configurable y tabla municipal.

## Cómo ejecutarlo

Desde la raíz del repo:

```bash
python3 -m venv .venv-pipeline
.venv-pipeline/bin/pip install -r requirements-pipeline.txt
.venv-pipeline/bin/python scripts/build_municipal_analytics.py
```

O vía npm (usa `python3` del PATH; en Windows ajustar):

```bash
npm run data:build:analytics
```

## Archivos que genera

| Salida | Uso |
|--------|-----|
| `data/processed/municipios_master_analytics.csv` | Inspección en Excel / notebook |
| `data/processed/municipios_master_analytics.json` | Misma información en JSON (Git) |
| `data/processed/state_analytics_dashboard.json` | KPIs estatales + nacional, merges para texto dinámico |
| `public/data/municipios_master_analytics.json` | Copia para el front (mapas / detalle) |
| `public/data/state_analytics_dashboard.json` | Copia para KPIs y párrafos dinámicos |

## Variables principales (municipio)

- **Educación (ITER)**: `graproes`, `pct_sin_escolaridad_15ymas`, `pct_posbasica_18ymas`, `pct_analfabetismo_15ymas`.
- **Población por sexo (ITER, `POBFEM` / `POBMAS`)**: `pct_mujeres`, `pct_hombres`, `indice_masculinidad` (hombres por cada 100 mujeres).
- **Rezago / carencias (CONEVAL IRS 2020)**: índice y componentes (`pct_*` IRS).
- **Conectividad (localidades 2024)**: `loc_pct_4g_garantizada`, `pob_pct_4g_garantizada`, `loc_pct_3g_garantizada`, `pob_pct_3g_garantizada`, `brecha_4g_pp`, `brecha_3g_pp`.
- **Ookla (2025, parcial)**: velocidad y `%` 3G/4G/5G donde `id_cvegeo` coincide; resto `null` + bandera `ookla_cubierto`.

## Si parece trabado o tarda mucho

- **No uses `pd.read_csv` sobre el ITER completo** en laptops modestas: el archivo pesa ~150 MB.  
  Este script **lee en streaming** solo filas con `LOC = 0000` (total municipal).
- En **NumPy 2+** ya no existe `trapz`; el script usa `trapezoid` con fallback.
- Filas vacías al final del Excel de CONEVAL IRS pueden traer `NaN` en clave municipio; se descartan antes del join.

## Limitaciones declaradas

- **Capas temporales distintas** (Censo 2020, IRS 2020, conectividad 2024, Ookla 2025): análisis **transversal aproximado**, no panel longitudinal.
- **Clustering no espacial** (`KMeans` no modela vecindad geográfica); los clusters son **perfiles multidimensionales**.
- **KMeans** sensible a escala y outliers; por eso se estandariza y se acota el rango de \(k\).
- **Inferencia**: correlaciones y desigualdad son **descriptivas**; no se afirma causalidad entre educación y cobertura.

Si quieres apuntes que no subas a Git, usa `docs/PIPELINE.local.md` (patrón ignorado en `.gitignore`).
