# Pipeline analítico: ETL → analytics → GeoJSON → dashboard

Este documento describe el flujo de datos del pipeline Python hacia el dashboard React.

## Etapas implementadas

1. **ETL por fuente** — Transformación y agregación a nivel estatal: ENDUTIH 2024, variables de contexto (CONEVAL + PIBE + ITER), cobertura de red Ookla/IFT, GeoJSON de polígonos estatales.
2. **Dataset maestro municipal** — Cruce de fuentes oficiales (INEGI ITER 2020, CONEVAL IRS 2020, brechas de conectividad por localidad INEGI/IFT 2024, Ookla 2025 cuando exista observación). Features derivadas: educación, brechas 3G/4G, demografía por sexo.
3. **Analytics Layer 1** — Estadísticas descriptivas sobre el dataset fusionado: distribuciones, correlaciones Pearson/Spearman, rankings, outliers IQR.
4. **Estandarización + Clustering** — `StandardScaler` + `KMeans` (k=2..7, selección por silhouette score). Perfil de cada cluster por medias de variables clave.
5. **Desigualdad territorial** — **Theil L** ponderado por población municipal. **Gini** por municipio para análisis de exposición.
6. **Publish** — Copia selectiva de `data/processed/` a `public/data/` mediante `scripts/publish.py`.

## Vista web (tab Territorial)

En la app (`npm run dev`), el tab **«Territorial»** permite elegir un estado y muestra Lorenz + Gini, matriz Spearman entre municipios, dispersión configurable y tabla municipal.

## Cómo ejecutarlo

Desde la raíz del repo (requiere `pip install -r requirements-pipeline.txt`):

```bash
# ETL — fuentes digitales y de contexto
npm run data:build:endutih              # ENDUTIH 2024 + cobertura de red (Ookla/IFT)
npm run data:build:context              # CONEVAL + PIBE + ITER

# ETL — GeoJSON para mapa coroplético
npm run data:build:geojson              # 00ent.shp → estados.geojson (requiere pyproj)

# Analytics Layer 1
npm run data:build:analytics            # distribuciones, correlaciones, rankings, outliers

# Publish al frontend
npm run data:publish                    # copia data/processed/ → public/data/
```

## Archivos que genera

### ETL (`scripts/etl/`)

| Salida | Script | Uso |
|--------|--------|-----|
| `data/processed/endutih_2024_state_dashboard.wide.json` | `build_endutih_2024.py` | Métricas digitales por estado |
| `data/processed/context_variables_state_dashboard.wide.json` | `build_context_variables.py` | CONEVAL + PIB + demografía |
| `data/processed/cobertura_red_por_estado_2025.json` | `build_cobertura_red.py` | Velocidad y cobertura Ookla/IFT estatal |
| `data/processed/cobertura_red_por_municipio_2025.json` | `build_cobertura_red.py` | Ídem a nivel municipal |
| `data/processed/estados.geojson` | `build_geojson.py` | Polígonos WGS84 para mapa coroplético |

### Variables del dataset municipal (`scripts/build_municipal_analytics.py`)

- **Educación (ITER)**: `graproes`, `pct_sin_escolaridad_15ymas`, `pct_posbasica_18ymas`, `pct_analfabetismo_15ymas`.
- **Población por sexo (ITER)**: `pct_mujeres`, `pct_hombres`, `indice_masculinidad`.
- **Rezago / carencias (CONEVAL IRS 2020)**: índice y componentes (`pct_*` IRS).
- **Conectividad (localidades 2024)**: `loc_pct_4g_garantizada`, `pob_pct_4g_garantizada`, `brecha_4g_pp`, `brecha_3g_pp`.
- **Ookla (2025, parcial)**: velocidad y cobertura donde `id_cvegeo` coincide; resto `null`.

### Analytics Layer 1 (`scripts/analytics/layer1_descriptive.py`)

| Salida | Contenido |
|--------|-----------|
| `data/processed/distributions.json` | Histogramas (10 bins) + Shapiro-Wilk por variable |
| `data/processed/correlations.json` | Matrices Pearson y Spearman (32 estados × ~36 variables) |
| `data/processed/rankings.json` | Ranking de estados por variable + delta vs. media |
| `data/processed/outliers_iqr.json` | Valores atípicos por método IQR |
| `data/processed/state_cards.json` | Perfil completo por estado (métricas fusionadas) |
| `data/processed/univariate_stats.csv` | Estadísticos descriptivos (mean, std, quartiles, skewness) |
| `data/processed/combined_data.csv` | DataFrame fusionado completo |

## Variables principales por capa

### Digital (ENDUTIH 2024 + IFT)
- `personas_usuarias_internet_pct`, `personas_con_smartphone_pct`, `personas_usan_redes_sociales_pct`, `teledensidad_internet_movil`
- `localidades_con_4g_garantizada_pct`, `poblacion_en_localidades_con_4g_garantizada_pct`

### Contexto (CONEVAL 2022 + INEGI)
- `pobreza_pct`, `pobreza_extrema_pct`, `rezago_educativo_pct`, `carencia_salud_pct`
- `pib_per_capita` (k MXN = MDP × 1,000 / población), `pib_total`
- `poblacion_economicamente_activa_pct`, `poblacion_afiliada_imss_pct`

### GeoJSON (`build_geojson.py`)
- Fuente: `data/raw/00ent.shp` — INEGI Marco Geoestadístico Nacional.
- Proyección original: LCC ITRF2008 (metros). Se reproyecta a WGS84 lon/lat con `pyproj`.
- Join key: `CVEGEO` (shapefile) ↔ `cve_ent` (dataset), formato `"01"`…`"32"`.
- Simplificación: distancia radial + Douglas-Peucker (`tol = 0.001°`); islas con bbox < `0.05°` descartadas.

## Notas de ejecución

- El CSV del ITER completo pesa ~150 MB; `build_context_variables.py` filtra solo filas con `MUN = 0` y `LOC = 0` (totales estatales) para no cargar el archivo completo en memoria.
- En NumPy 2+ ya no existe `trapz`; `layer1_descriptive.py` usa `trapezoid` con fallback.
- `build_geojson.py` requiere `pyproj` (además de `pyshp`); ambos están en `requirements-pipeline.txt`.

## Limitaciones declaradas

- **Capas temporales distintas** (Censo 2020, IRS 2020, conectividad 2024, Ookla 2025): análisis **transversal aproximado**, no panel longitudinal.
- **Clustering no espacial** (`KMeans` no modela vecindad geográfica); los clusters son **perfiles multidimensionales**.
- **KMeans** sensible a escala y outliers; por eso se estandariza y se acota el rango de \(k\).
- **Inferencia**: correlaciones y desigualdad son **descriptivas**; no se afirma causalidad entre educación y cobertura.

Si quieres apuntes que no subas a Git, usa `docs/PIPELINE.local.md` (patrón ignorado en `.gitignore`).
