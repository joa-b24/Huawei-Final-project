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
| BIT / IFT Localidades | 2024 | Localidad → estatal | Cobertura 3G/4G/5G por localidad y población |
| Ookla Open Datasets | 2025 | Hexágono → municipal/estatal | Velocidad de descarga, tecnología estimada |
| CONEVAL | 2022 | Estatal | Pobreza, carencias sociales, rezago educativo |
| INEGI PIBE | 2024 | Estatal | PIB total, PIB per cápita (k MXN) |
| INEGI ITER | 2020 | Estatal | Población total, PEA, afiliación IMSS |
| INEGI Marco Geoestadístico | 2020 | Estatal (polígonos) | Fronteras estatales para mapa coroplético |

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
├── public/
│   └── data/                       ← serving layer: lo que lee el frontend
├── scripts/
│   ├── etl/
│   │   ├── build_endutih_2024.py
│   │   ├── build_context_variables.py
│   │   ├── build_cobertura_red.py
│   │   └── build_geojson.py
│   ├── analytics/
│   │   └── layer1_descriptive.py
│   └── publish.py
├── docs/
│   ├── data-methodology.md
│   ├── data-standard.md
│   ├── PIPELINE_ANALYTICS.md
│   └── ui-ux-specs.md
└── src/
    ├── app/
    ├── components/
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
```

El único punto de contacto entre el pipeline y el frontend es `public/data/`.  
**Nunca escribir directamente en `public/data/`** — siempre pasar por `publish.py`.

---

## Cómo correrlo

### 1. Instalar dependencias

```bash
npm install
pip install -r requirements-pipeline.txt
```

### 2. Correr el pipeline

```bash
# ETL — fuentes digitales
npm run data:build:endutih

# ETL — variables de contexto (CONEVAL + PIBE + ITER)
npm run data:build:context

# ETL — GeoJSON estatal para mapa coroplético
npm run data:build:geojson

# Analytics Layer 1 — distribuciones, correlaciones, rankings, outliers
npm run data:build:analytics

# Publish — copia processed/ → public/data/
npm run data:publish
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

1. Guardar el archivo original en `data/raw/`
2. Crear o reusar un script en `scripts/etl/`
3. Registrar las variables nuevas en `data/catalogs/variables.catalog.json`
4. Añadir la salida al `PUBLISH_MAP` en `scripts/publish.py`
5. Correr `python3 scripts/publish.py`
