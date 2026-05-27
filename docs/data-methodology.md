# Metodología de Transformación y Validación
**Versión:** 2.1 | **Actualizado:** 2026-05-06

Este proyecto no usa los archivos fuente de forma directa en la interfaz.
Antes de llegar al dashboard, los datos pasan por tres capas: ETL, Analytics y Publish.

---

## 1. Fuentes integradas

| Archivo | Fuente | Año | Granularidad |
|---|---|---|---|
| `tr_endutih_usuarios_anual_2024.csv` | INEGI ENDUTIH | 2024 | Persona (microdato) |
| `tr_endutih_usuarios2_anual_2024.csv` | INEGI ENDUTIH | 2024 | Persona (microdato) |
| `TD_TELEDENSIDAD_INTMOVIL_ITE_VA.csv` | IFT | 2024 | Estatal |
| `loc_tipo_conectividad.csv` | BIT / IFT | 2024 | Localidad |
| `localidades_conectividad.csv` | INEGI | 2020 | Localidad |
| `Anexo estadístico entidades 2022.xlsx` | CONEVAL | 2022 | Estatal |
| `PIBE_2.xlsx` | INEGI PIBE | 2024 | Estatal |
| `conjunto_de_datos_iter_00CSV20.csv` | INEGI ITER | 2020 | Estatal |
| `gps_mobile_tiles.shp` | Ookla Open Datasets | 2025 | Hexágono (geodato) |
| `00mun.shp` | INEGI Marco Geoestadístico | 2020 | Municipal (polígono) |

---

## 2. Arquitectura del pipeline

```
data/raw/                        ← fuentes crudas (no modificar)
    ↓
scripts/etl/*.py                ← transformación y agregación por fuente
    ↓
data/processed/                  ← staging: outputs estandarizados
    ↓
scripts/analytics/layer1_*.py   ← estadísticas descriptivas sobre processed/
    ↓
data/processed/                  ← outputs analíticos (correlaciones, rankings, etc.)
    ↓
scripts/publish.py              ← copia a public/data/ (serving layer)
    ↓
public/data/                     ← lo que lee el frontend React
```

---

## 3. ETL por fuente

### 3.1 ENDUTIH 2024 — `scripts/etl/build_endutih_2024.py`

Microdatos de personas usuarias de internet y dispositivos.

- Se descartarán filas sin `CVE_ENT` o sin `FAC_PER`.
- Se agregan respuestas positivas por entidad usando el factor de expansión `FAC_PER`:

```
porcentaje = (Σ FAC_PER en respuestas positivas por entidad) / (Σ FAC_PER total por entidad) × 100
```

- La teledensidad (`teledensidad_internet_movil`) se toma directamente de la tabla IFT sin factor de expansión.
- Las métricas de localidades (`localidades_con_cobertura_movil_pct`, etc.) usan tres denominadores: localidades, población, hogares.

**Outputs:** `data/processed/endutih_2024_state_dashboard.wide.json` + `.long.json`

### 3.2 Variables de contexto — `scripts/etl/build_context_variables.py`

Fusiona CONEVAL 2022, INEGI PIBE e INEGI ITER 2020.

- Normalización de nombres de estados con `states.master.json` usando la función `normalize()` (elimina acentos, lowercase).
- `pib_per_capita` se calcula como `(pib_total × 1,000) / poblacion_total`. El factor 1,000 convierte de MDP (millones de pesos) a miles de pesos por persona, dando la unidad final **k MXN**.
- Los porcentajes de población (edad laboral, PEA, IMSS) se calculan sobre `poblacion_total`.

**Outputs:** `data/processed/context_variables_state_dashboard.wide.json` + `.long.json`

### 3.3 GeoJSON estatal — `scripts/etl/build_geojson.py`

Convierte el shapefile `data/raw/00ent.shp` (INEGI Marco Geoestadístico Nacional, proyección LCC ITRF2008) a GeoJSON en WGS84 listo para el mapa coroplético del frontend.

- Reproyección de LCC metros a lon/lat (EPSG:4326) con `pyproj`.
- Simplificación de geometría en dos pasos: filtro de distancia radial + Douglas-Peucker, con tolerancia `0.001°` (~100 m). Reduce el tamaño del archivo sin pérdida visual apreciable a escala estatal.
- Anillos con bounding box menor a `0.05°` en ambas dimensiones se descartan (islas pequeñas irrelevantes).
- Join key: campo `CVEGEO` del shapefile ↔ `cve_ent` del dataset (`"01"` … `"32"`).

**Output:** `data/processed/estados.geojson`

---

## 4. Analytics — Layer 1

**Script:** `scripts/analytics/layer1_descriptive.py`

Opera sobre los outputs de ETL ya fusionados (contexto + digital). Genera:

| Output | Método |
|---|---|
| `distributions.json` | Histogramas (10 bins) + test Shapiro-Wilk de normalidad |
| `correlations.json` | Matrices Pearson y Spearman (32 estados × ~36 variables) |
| `outliers_iqr.json` | Método IQR: `[Q1 − 1.5×IQR, Q3 + 1.5×IQR]` |
| `rankings.json` | Ranking ascendente de estados por variable + delta vs. media |
| `state_cards.json` | Perfil por estado: métricas fusionadas + overall_score (min-max normalizado) |
| `univariate_stats.csv` | Estadísticos descriptivos (mean, std, quartiles, skewness, kurtosis) |
| `combined_data.csv` | DataFrame fusionado completo |

Todos los outputs se escriben en `data/processed/`.

---

## 5. Publish

**Script:** `scripts/publish.py`

Copia de `data/processed/` a `public/data/` exactamente los archivos que el frontend necesita.
Es el único punto de contacto explícito entre el pipeline y la app React.

Para agregar un nuevo dataset al frontend: añadir una línea en `PUBLISH_MAP` dentro de `publish.py`.

---

## 6. Estandarización de claves

- Clave estatal: `cve_ent` en formato de dos dígitos (`"01"`, `"09"`, etc.).
- Cruce siempre con `states.master.json` para obtener `state_code` canónico.
- Variables en `snake_case` canónico — el catálogo en `variables.catalog.json` es la fuente de verdad.

---

## 7. Validación de calidad

Generada por `scripts/etl/build_data_quality_report.py`:

- Conteo de filas por fuente.
- Cobertura de métricas por entidad (cuántas variables tiene cada estado).
- Detección de duplicados entidad-variable.
- Verificación de rango para variables porcentuales (esperado `[0, 100]`).
- Estadísticos descriptivos por métrica.

```bash
npm run pipeline:quality
```

---

## 8. Cómo correr el pipeline completo

```bash
# ETL por fuente
npm run data:build:endutih      # ENDUTIH 2024 + cobertura de red
npm run data:build:context      # Variables de contexto (CONEVAL + PIBE + ITER)
npm run data:build:geojson      # GeoJSON estatal (requiere pyproj instalado)
npm run data:build:analytics    # distribuciones, correlaciones, rankings, outliers
npm run data:publish            # copia data/processed/ → public/data/

# Reporte de calidad
npm run data:report:endutih
```

Los archivos intermedios quedan en `data/processed/`. Solo `public/data/` alimenta el frontend.
