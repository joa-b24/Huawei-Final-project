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
|       `-- states.metrics.json
|-- data/
|   |-- catalogs/
|   |   |-- states.master.json
|   |   `-- variables.catalog.json
|   |-- processed/
|   |   |-- territorial_dashboard.wide.json
|   |   |-- territorial_observations.long.csv
|   |   `-- territorial_observations.long.json
|   `-- raw/
|       |-- states.metrics.source.json
|       `-- states.metrics.source.csv
|-- scripts/
|   `-- build-processed-data.mjs
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

2. Si quieres regenerar el dataset publico desde la fuente local:

```bash
npm run data:build
```

3. Levanta la app:

```bash
npm run dev
```

4. Abre la URL local que imprima Vite, normalmente `http://localhost:5173`.

## Que incluye este scaffolding

- Una sola pagina con `header`, filtros, KPIs, dashboards comparativos e insights.
- Datos mock minimos para validar la UI desde archivos locales.
- Un script base para mover datos procesados hacia la carpeta publica.
- Componentes desacoplados para crecer sin meter backend antes de tiempo.
- Un estandar de datos documentado en `docs/data-standard.md`.
- Catalogos y ejemplos procesados para comparar estados con nombres consistentes.

