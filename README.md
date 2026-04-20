# Huawei Territorial Dashboard MVP

MVP local para analizar variables territoriales de Mexico con dashboards interactivos orientados a comparacion de estados y apoyo a decisiones estrategicas.

## Arquitectura propuesta

Se prioriza una arquitectura simple:

1. `Frontend SPA` en React + TypeScript con Vite.
2. `Datos procesados` en archivos JSON locales servidos desde `public/data`.
3. `Scripts locales` para transformar fuentes crudas en datasets homogeneos.
4. `Utilidades de analisis` en frontend para generar insights automatizados sin backend.

## Por que esta arquitectura

- Evita un backend innecesario para el MVP.
- Permite iterar rapido sobre visualizaciones y logica analitica.
- Separa claramente `fuentes crudas`, `datos procesados` y `presentacion`.
- Facilita evolucion futura hacia API o base de datos si el producto crece.

## Stack minimo viable recomendado

- `Vite`
- `React`
- `TypeScript`
- `Recharts`
- `CSS` plano con variables para mantener claridad
- `Node.js` para scripts de procesamiento locales

## Estructura del proyecto

```text
.
|-- .gitignore
|-- docs/
|   `-- data-standard.md
|-- package.json
|-- tsconfig.json
|-- vite.config.ts
|-- public/
|   `-- data/
|       `-- endutih_2024_state_dashboard.wide.json
|-- data/
|   |-- catalogs/
|   |   |-- states.master.json
|   |   `-- variables.catalog.json
|   |-- processed/
|   |   |-- endutih_2024_state_dashboard.wide.json
|   |   |-- endutih_2024_state_observations.long.csv
|   |   `-- endutih_2024_state_observations.long.json
|   `-- raw/
|       |-- tr_endutih_usuarios_anual_2024.csv
|       |-- tr_endutih_usuarios2_anual_2024.csv
|       |-- diccionario_de_datos_tr_endutih_usuarios_anual_2024.csv
|       |-- diccionario_de_datos_tr_endutih_usuarios2_anual_2024.csv
|       `-- metadatos_endutih_anual_2024.txt
|-- scripts/
|   `-- build_endutih_2024.py
|-- src/
|   |-- app/
|   |   |-- App.tsx
|   |   `-- main.tsx
|   |-- components/
|   |   |-- DashboardHeader.tsx
|   |   |-- InsightPanel.tsx
|   |   |-- KPIGrid.tsx
|   |   |-- MetricSelector.tsx
|   |   `-- charts/
|   |       |-- ComparisonBarChart.tsx
|   |       `-- CorrelationScatter.tsx
|   |-- data/
|   |   `-- loadDataset.ts
|   |-- styles/
|   |   `-- global.css
|   |-- types/
|   |   |-- dataStandard.ts
|   |   `-- dataset.ts
|   `-- utils/
|       |-- insights.ts
|       |-- metrics.ts
|       `-- normalization.ts
```

## Como correrlo

1. Instala dependencias:

```bash
npm install
```

2. Si quieres regenerar los indicadores estatales de ENDUTIH 2024:

```bash
npm run data:build:endutih
```

3. Levanta la app:

```bash
npm run dev
```

4. Abre la URL local que imprima Vite, normalmente `http://localhost:5173`.

## Que incluye este scaffolding

- Una sola pagina con `header`, filtros, KPIs, dashboards comparativos e insights.
- Datos crudos reales de ENDUTIH 2024 en `data/raw`.
- Un ETL en Python que agrega indicadores por entidad usando `FAC_PER` y `CVE_ENT`.
- Componentes desacoplados para crecer sin meter backend antes de tiempo.
- Un estandar de datos documentado en `docs/data-standard.md`.
- Catalogos y datasets procesados listos para comparar estados con nombres consistentes.
