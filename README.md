# Huawei Territorial Dashboard

> **Documentación técnica:**
> - [docs/data-methodology.md](./docs/data-methodology.md) — fuentes, ETL y fórmulas de cálculo
> - [docs/data-standard.md](./docs/data-standard.md) — esquemas JSON y convenciones de datos
> - [docs/PIPELINE_ANALYTICS.md](./docs/PIPELINE_ANALYTICS.md) — flujo completo del pipeline
> - [docs/ui-ux-specs.md](./docs/ui-ux-specs.md) — especificaciones de componentes y diseño
> - [docs/GINI_ANALYSIS.md](./docs/GINI_ANALYSIS.md) — análisis Gini/Lorenz municipal
> - [README-EXPOSICION.md](./README-EXPOSICION.md) — narrativa y guía de demo para la expo
>
> **Archivos grandes:** el repo usa [Git LFS](https://git-lfs.com). Tras clonar: `git lfs install && git lfs pull`. Patrones en [`.gitattributes`](./.gitattributes).

Aplicación web local para explorar indicadores territoriales de México a nivel estatal.  
Combina datos de conectividad digital, cobertura de red, contexto socioeconómico y polígonos geográficos en un dashboard interactivo con análisis comparativo por entidad.

---

## Stack

- **Frontend:** React 18 + TypeScript + Vite
- **Visualización:** Recharts, react-simple-maps
- **Pipeline:** Python 3 (pandas, numpy, pyshp, pyproj, scikit-learn, scipy)

---

## Fuentes integradas

| Fuente | Año | Granularidad | Variables principales |
|--------|-----|--------------|----------------------|
| INEGI ENDUTIH | 2024 | Persona (microdato → estatal) | Internet, dispositivos, banca móvil, redes sociales |
| IFT Teledensidad | 2024 | Estatal | `teledensidad_internet_movil` |
| BIT / IFT Localidades | 2024 | Localidad → municipal/estatal | Cobertura 4G garantizada, población con cobertura, brecha 4G |
| Ookla Open Datasets | 2025 | Hexágono → municipal/estatal | Velocidad de descarga media, cobertura 4G estimada |
| CONEVAL IRS | 2020 | Municipal → estatal | IRS, vivienda sin agua/drenaje/luz, sin derechohabiencia |
| CONEVAL | 2022 | Estatal | Pobreza, carencias sociales, rezago educativo |
| INEGI PIBE | 2024 | Estatal | PIB total, PIB per cápita (k MXN) |
| INEGI ITER | 2020 | Municipal → estatal | Población, analfabetismo, escolaridad, demografía por edad |
| INEGI Marco Geoestadístico | 2020 | Estatal y municipal (polígonos) | Fronteras estatales y municipales |

---

## Estructura del proyecto

```text
.
├── package.json
├── requirements-pipeline.txt
├── data/
│   ├── raw/                        ← fuentes crudas (no modificar)
│   ├── catalogs/
│   │   ├── states.master.json      ← 32 estados: state_code, cve_ent, región, aliases
│   │   └── variables.catalog.json  ← catálogo de variables: label, unidad, direction
│   └── processed/                  ← outputs del pipeline (staging)
│       └── municipios_master_analytics.json  ← dataset maestro municipal (LFS)
├── public/
│   └── data/                       ← serving layer: lo que lee el frontend
│       ├── outputs/
│       │   └── municipal/          ← un .json combinado por estado (23 variables + analytics)
│       ├── geo/
│       │   └── municipios/         ← GeoJSONs de polígonos municipales + bboxes.json
│       └── municipal_manifest.json ← índice: qué variables existen por estado
├── scripts/
│   ├── etl/
│   │   ├── build_endutih_2024.py
│   │   ├── build_context_variables.py
│   │   ├── build_cobertura_red.py
│   │   └── build_geojson.py
│   ├── analytics/
│   │   ├── layer1_descriptive.py   ← analytics estatal (distribuciones, correlaciones)
│   │   └── layer1_municipal.py     ← analytics municipal (stats, rankings, outliers por estado)
│   ├── export_municipal_from_analytics.py  ← extrae 23 variables del maestro municipal → combined
│   ├── build_municipal_geojsons.py         ← genera GeoJSONs de municipios (geometría pura)
│   ├── import_variable.py                  ← wizard: importa variables nuevas al combined
│   └── publish.py
├── docs/
│   ├── data-methodology.md
│   ├── data-standard.md
│   ├── PIPELINE_ANALYTICS.md
│   └── ui-ux-specs.md
└── src/
    ├── app/
    ├── components/
    │   └── charts/
    │       ├── MunicipalModeView.tsx     ← orquesta la vista municipal
    │       ├── MunicipioDistPanel.tsx    ← histograma de distribución municipal
    │       ├── MunicipioMapPanel.tsx     ← mapa coroplético municipal
    │       └── MunicipioRankingPanel.tsx ← ranking de municipios
    ├── context/
    ├── lib/
    ├── services/
    ├── styles/
    ├── types/
    └── views/
```

---

## Flujo de datos

```
data/raw/  →  scripts/etl/*.py  →  data/processed/  →  scripts/analytics/layer1_descriptive.py
                                                     →  scripts/publish.py  →  public/data/  →  React app

                                    ↕ municipios
data/processed/municipios_master_analytics.json
    →  scripts/export_municipal_from_analytics.py  →  public/data/outputs/municipal/{estado}.json
    →  scripts/build_municipal_geojsons.py         →  public/data/geo/municipios/{estado}.geojson
    →  scripts/analytics/layer1_municipal.py       →  analytics embebidos en el combined por estado
```

El único punto de contacto entre el pipeline y el frontend es `public/data/`.  
**Nunca escribir directamente en `public/data/`** — siempre pasar por el pipeline.

Para importar variables nuevas sin regenerar todo:

```bash
python scripts/import_variable.py data/processed/imports/mi_variable.json
```

---

## Cómo correrlo

### 1. Instalar dependencias

```bash
npm install
pip install -r requirements-pipeline.txt
```

### 2. Correr el pipeline

```bash
# ETL estatal — fuentes digitales
npm run data:build:endutih

# ETL estatal — variables de contexto (CONEVAL + PIBE + ITER)
npm run data:build:context

# ETL estatal — GeoJSON estatal para mapa coroplético
npm run data:build:geojson

# Analytics Layer 1 estatal — distribuciones, correlaciones, rankings, outliers
npm run data:build:analytics

# Publish — copia processed/ → public/data/
npm run data:publish

# Pipeline municipal (una vez generado el maestro municipal)
python scripts/build_municipal_geojsons.py              # GeoJSONs municipales (geometría pura)
python scripts/export_municipal_from_analytics.py       # combined por estado + manifest
python scripts/analytics/layer1_municipal.py            # stats/rankings/outliers por estado
```

### 3. Levantar la aplicación

```bash
npm run dev
```

### 4. Build de validación TypeScript

```bash
npm run build
```

---

## Proceso de ciencia de datos

El pipeline deja evidencia explícita de trabajo analítico:

- Uso de factores de expansión `FAC_PER` (ENDUTIH) para agregar microdatos a nivel estatal
- Cruce territorial por `cve_ent` usando `states.master.json` como fuente de verdad de nombres
- PIB per cápita calculado como `(pib_total_MDP × 1,000) / poblacion_total` → unidad: k MXN
- Histogramas, correlaciones Pearson/Spearman, outliers IQR.
- Reproyección cartográfica LCC ITRF2008 → WGS84 y simplificación de polígonos para el mapa

---

## Regla para agregar una fuente nueva

### Fuente estatal
1. Guardar el archivo original en `data/raw/`
2. Crear o reusar un script en `scripts/etl/`
3. Registrar las variables nuevas en `data/catalogs/variables.catalog.json`
4. Añadir la salida al `PUBLISH_MAP` en `scripts/publish.py`
5. Correr `python3 scripts/publish.py`

### Fuente municipal (vía wizard de importación)
1. Preparar un JSON de importación en `data/processed/imports/` con la estructura:
   ```json
   { "variable_id": "mi_variable", "granularity": "municipal", "operation": "nueva_variable",
     "catalog_entry": { ... }, "records": [{ "cve_mun": "14039", "metrics": { "mi_variable": 42.1 } }] }
   ```
2. Correr `python scripts/import_variable.py` — escribe al combined por estado, actualiza el manifest y regenera analytics automáticamente.
