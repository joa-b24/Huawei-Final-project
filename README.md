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
|-- package.json
|-- tsconfig.json
|-- vite.config.ts
|-- public/
|   `-- data/
|       `-- states.metrics.json
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
|   |   `-- dataset.ts
|   `-- utils/
|       |-- insights.ts
|       `-- metrics.ts
`-- data/
    |-- processed/
    `-- raw/
```

## Como correrlo

1. Instala dependencias:

```bash
npm install
```

2. Levanta la app:

```bash
npm run dev
```

3. Abre la URL local que imprima Vite, normalmente `http://localhost:5173`.

