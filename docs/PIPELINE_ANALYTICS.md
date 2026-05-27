# Pipeline analítico: ETL → analytics → GeoJSON → dashboard

Este documento describe el flujo de datos del pipeline Python hacia el dashboard React.

## Etapas implementadas

1. **ETL por fuente** — Transformación y agregación a nivel estatal: ENDUTIH 2024, variables de contexto (CONEVAL + PIBE + ITER), cobertura de red Ookla/IFT, GeoJSON de polígonos estatales.
2. **Dataset maestro municipal** — Cruce de fuentes oficiales (INEGI ITER 2020, CONEVAL IRS 2020, brechas de conectividad por localidad INEGI/IFT 2024, Ookla 2025 cuando exista observación). Features derivadas: educación, brechas 3G/4G, demografía por sexo.
3. **Exportación municipal** — `export_municipal_from_analytics.py` mapea las 23 variables del maestro al catálogo canónico y escribe un archivo `.json` combinado por estado en `public/data/outputs/municipal/`, más `municipal_manifest.json`.
4. **GeoJSONs municipales** — `build_municipal_geojsons.py` genera polígonos de municipios en WGS84 (geometría pura: solo `cvegeo` y `nom_mun`), más `bboxes.json` para auto-zoom en el mapa.
5. **Analytics Layer 1 estatal** — Estadísticas descriptivas sobre el dataset fusionado: distribuciones, correlaciones Pearson/Spearman, rankings, outliers IQR.
6. **Analytics Layer 1 municipal** — `layer1_municipal.py` lee los combined por estado e incrusta bajo cada variable: `stats` (count, mean, median, std, min, max, q1, q3), `rankings` (lista ordenada según `direction` del catálogo) y `outliers` (método IQR 1.5).
7. **Estandarización + Clustering** — `StandardScaler` + `KMeans` (k=2..7, selección por silhouette score). Perfil de cada cluster por medias de variables clave.
8. **Desigualdad territorial** — **Theil L** ponderado por población municipal. **Gini** por municipio para análisis de exposición.
9. **Publish** — Copia selectiva de `data/processed/` a `public/data/` mediante `scripts/publish.py`.

## Vista web (tab Territorial)

En la app (`npm run dev`), el tab **«Territorial»** permite elegir un estado y muestra Lorenz + Gini, matriz Spearman entre municipios, dispersión configurable y tabla municipal.

## Cómo ejecutarlo

Desde la raíz del repo (requiere `pip install -r requirements-pipeline.txt`):

```bash
# ETL estatal — fuentes digitales y de contexto
npm run data:build:endutih              # ENDUTIH 2024 + cobertura de red (Ookla/IFT)
npm run data:build:context              # CONEVAL + PIBE + ITER

# ETL estatal — GeoJSON para mapa coroplético
npm run data:build:geojson              # 00ent.shp → estados.geojson (requiere pyproj)

# Analytics Layer 1 estatal
npm run data:build:analytics            # distribuciones, correlaciones, rankings, outliers

# Publish al frontend
npm run data:publish                    # copia data/processed/ → public/data/

# Pipeline municipal (requiere municipios_master_analytics.json generado)
python scripts/build_municipal_geojsons.py              # 00mun.shp → geojsons por estado + bboxes
python scripts/export_municipal_from_analytics.py       # combined .json por estado + manifest
python scripts/analytics/layer1_municipal.py            # stats/rankings/outliers embebidos en combined

# Analytics municipal para estados específicos
python scripts/analytics/layer1_municipal.py AGS JAL    # solo Aguascalientes y Jalisco
```

## Archivos que genera

### ETL estatal (`scripts/etl/`)

| Salida | Script | Uso |
|--------|--------|-----|
| `data/processed/endutih_2024_state_dashboard.wide.json` | `build_endutih_2024.py` | Métricas digitales por estado |
| `data/processed/context_variables_state_dashboard.wide.json` | `build_context_variables.py` | CONEVAL + PIB + demografía |
| `data/processed/cobertura_red_por_estado_2025.json` | `build_cobertura_red.py` | Velocidad y cobertura Ookla/IFT estatal |
| `data/processed/cobertura_red_por_municipio_2025.json` | `build_cobertura_red.py` | Ídem a nivel municipal |
| `data/processed/estados.geojson` | `build_geojson.py` | Polígonos WGS84 para mapa coroplético |

### Pipeline municipal

| Salida | Script | Uso |
|--------|--------|-----|
| `public/data/geo/municipios/{estado}.geojson` | `build_municipal_geojsons.py` | Geometría pura (cvegeo + nom_mun) para el mapa del frontend |
| `public/data/geo/municipios/bboxes.json` | `build_municipal_geojsons.py` | Bounding boxes para auto-zoom en el mapa |
| `public/data/outputs/municipal/{estado}.json` | `export_municipal_from_analytics.py` | Combined por estado: 23 variables con registros municipales |
| `public/data/municipal_manifest.json` | `export_municipal_from_analytics.py` | Índice: qué variables existen por estado |

El combined por estado tiene esta estructura:
```json
{
  "state_code": "AGS",
  "updated_at": "2026-05-26",
  "variables": {
    "poblacion_en_localidades_con_4g_garantizada_pct": {
      "year": 2024,
      "records": [{ "cve_mun": "01001", "value": 99.83 }],
      "stats":    { "count": 11, "mean": 98.83, "median": 99.69, "std": 1.76, "min": 94.02, "max": 100.0, "q1": 97.88, "q3": 100.0 },
      "rankings": [{ "rank": 1, "cve_mun": "01004", "value": 100.0 }],
      "outliers": []
    }
  }
}
```

### 23 variables municipales disponibles

| Categoría | Variables |
|-----------|-----------|
| Cobertura BIT (IFT 2024) | `poblacion_en_localidades_con_4g_garantizada_pct`, `localidades_con_4g_garantizada_pct`, `localidades_total`, `brecha_4g_pp` |
| Educación (ITER 2020) | `pct_analfabetismo_15ymas`, `pct_sin_escolaridad_15ymas`, `pct_posbasica_18ymas` |
| Demografía (ITER 2020) | `pob_0_14_pct`, `pob_15_64_pct`, `pob_65_mas_pct` |
| Rezago social (CONEVAL IRS 2020) | `irs_indice`, `viv_sin_agua_pct`, `viv_sin_drenaje_pct`, `viv_sin_luz_pct`, `sin_derechohabiencia_pct` |
| Ookla (2025, parcial) | `ookla_velocidad_avg_mbps`, `ookla_cobertura_4g_pct` |
| BIT completo (ya en catálogo) | `poblacion_en_localidades_con_cobertura_movil_pct`, `localidades_con_cobertura_movil_pct`, `hogares_con_cobertura_movil_pct`, `localidades_con_3g_garantizada_pct`, `localidades_con_5g_garantizada_pct`, `poblacion_en_localidades_con_3g_garantizada_pct` |

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
