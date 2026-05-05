# UI/UX Specifications — Observatorio de Indicadores por Estado
**Versión:** 1.0 | **Fecha:** 2026-05-03

---

## 1. Design System

### 1.1 Tokens de color

| Token | Valor | Uso |
|---|---|---|
| `--blue` | `#1d4ed8` | Primario, activo, links, CTAs |
| `--blue-light` | `#eff6ff` | Fondos de insight, hover states |
| `--blue-mid` | `#bfdbfe` | Bordes de insight, chips activos |
| `--green` | `#065f46` | Valores positivos, mejora |
| `--red` | `#991b1b` | Valores negativos, alerta |
| `--amber` | `#92400e` | Advertencia, valores anómalos |
| `--text-1` | `#111827` | Texto principal, títulos |
| `--text-2` | `#374151` | Texto secundario, cuerpo |
| `--text-3` | `#6b7280` | Texto terciario, labels, placeholders |
| `--border` | `#e5e7eb` | Bordes de cards y contenedores |
| `--bg` | `#f3f4f6` | Fondo de página |
| `--surface` | `#ffffff` | Fondo de cards/panels |

### 1.2 Tipografía

| Elemento | Fuente | Tamaño | Peso |
|---|---|---|---|
| Valores KPI | DM Mono | 28px | 700 |
| Títulos de sección | Inter | 20px | 700 |
| Títulos de card | Inter | 13px | 600 |
| Labels de KPI | Inter | 11px | 600, uppercase |
| Texto de tabla | Inter | 13px | 400 |
| Texto de insight | Inter | 13px | 400 |
| Labels de sidebar | Inter | 10px | 600, uppercase |

### 1.3 Espaciado y radio

- Padding de cards: `20px`
- Gap entre cards: `14px` (KPI), `16px` (charts)
- Radio de contenedores: `8px` (`--radius`)
- Gap sidebar-main: sidebar fija de `256px`

---

## 2. Layout General

```
┌─────────────────────────────────────────────────────┐
│ SIDEBAR (256px fija)      │ MAIN CONTENT             │
│                           │                          │
│ [Logo / Título]           │ [Header]                 │
│                           │ [Tab Bar]                │
│ Seleccionar estado(s)     │ [Tab Content]            │
│ └─ search input           │                          │
│ └─ state list             │                          │
│                           │                          │
│ Comparar con              │                          │
│ └─ select (Nacional /     │                          │
│    Cluster / Región /     |                          |
|    Estado (s)   )         │                          │
│                           │                          │
│ Variables activas         │                          │
│ └─ search input           │                          │
│ └─ var chips (checkboxes) │                          │
└─────────────────────────────────────────────────────┘
```

**Sidebar fija:** `position: fixed`, `height: 100vh`, `overflow-y: auto`  
**Main:** `margin-left: 256px`, `padding: 24px`

---

## 3. Componentes del Sidebar

### 3.1 `StateSearch` + `StateList`
- Input de búsqueda filtra la lista en tiempo real (cliente, sin API calls)
- Lista scrollable con máximo `200px` de altura
- Selección múltiple: click togglea. Estado seleccionado: fondo `--blue`, texto blanco, bold
- Estado no seleccionado: hover `--blue-light`
- **Dato esperado:** array de nombres de estado desde `state_cards.json`.

### 3.2 `ComparisonSelect`
- `<select>` con opciones: Nacional, Cluster, Región (Norte/Centro/Sur)
- **Dato esperado:** el promedio nacional se calcula como media simple de los 32 estados. Los clusters se definen en Fase 2. Por ahora (v.1.0) solo *Nacional"* es funcional.
- Si el usuario elige una opción no disponible aún → mostrar tooltip.

### 3.3 `VarChipList`
- Lista de variables disponibles como chips con checkbox
- Máximo 5 activas simultáneamente (evita sobrecarga visual en charts de araña/radar)
- Variables activas por defecto: las 5 más relevantes según `univariate_stats.csv` (mayor varianza)
- **Dato esperado:** catálogo de `metric_catalog` del dataset activo

---

## 4. Tabs y contenido

### Tab 1 — Diagnóstico

#### 4.1.1 KPI Grid (4 cards)
Cada card muestra:
- **Label:** nombre corto de la métrica (uppercase, 11px)
- **Value:** valor del estado seleccionado (DM Mono, 28px)
- **Compare:** delta vs benchmark (Nacional o Cluster seleccionado)

**Las 4 métricas son configurables** según las variables activas del sidebar.

#### 4.1.2 `ComparisonRadarChart` (estado vs. ...)
- Spider/radar de 5–6 ejes (variables activas)
- Dos áreas: estado seleccionado (azul sólido) + nacional (gris, stroke)
- Si hay múltiples estados seleccionados → un trazo por estado + nacional
- **Dato esperado:** valores normalizados 0–100 por variable (min-max sobre los 32 estados)

#### 4.1.3 `DistributionHistogram`
- Histograma de la variable principal seleccionada para los 32 estados
- Barra del estado seleccionado: resaltada en `--blue`
- Barra de la media nacional: línea vertical punteada en `--text-3`
- **Dato esperado:** `dashboard_data/distributions.json` → `[variable].histogram`

#### 4.1.4 `RankingTable`
- Tabla de los 32 estados, ordenada por la variable seleccionada
- Columnas: `#`, Estado, Valor, Tendencia (si hay datos históricos), Benchmark delta
- Colores de rank: top tercio → `--green`, medio → `--amber`, bajo → `--red`
- Estado seleccionado: fila resaltada con fondo `--blue-light`, borde izquierdo `--blue`
- **Dato esperado:** `dashboard_data/rankings.json` → `[variable][]`

#### 4.1.5 `StateRadarProfile` (Perfil de brechas)
- Radar pequeño (180px) mostrando dimensiones clave del estado
- Identificar automáticamente fortalezas (≥ media + 0.5 SD) y brechas (≤ media − 0.5 SD)
- **Dato esperado:** mismo que ComparisonRadarChart, más `dashboard_data/univariate_stats.csv`

#### 4.1.6 `ChoroplethMap` (mapa de México)
- Mapa coroplético coloreado por la variable seleccionada
- Estado seleccionado: borde `--blue` 2px + tooltip fijo
- Escala de color: 4 rangos (good → critical) según distribución de la variable
- **Fase 1:** placeholder estático o SVG simple. Implementación real en Fase 3.

---

### Tab 2 — Estructura
**Pregunta que responde:**

> Esta tab muestra placeholders con el esqueleto visual. El contenido real se llenará después.
> Se presentan a continuación propuestas de módulos para esta sección.

#### 4.2.1 KPI Grid (3 cards)
| Card | Contenido | Fase 1 |
|---|---|---|
| Cluster asignado | Nombre del cluster | --- |
| PC1 loading | Valor numérico | Placeholder |
| PC2 loading | Valor numérico | Placeholder |

#### 4.2.2 `PcaScatterChart`
- Scatter 2D: PC1 (eje X) vs PC2 (eje Y)
- Puntos coloreados por cluster, estado seleccionado resaltado con halo.

#### 4.2.3 `ClusterInfoPanel`
- Card con: nombre del cluster, lista de estados miembro, características del cluster, implicación estratégica.

#### 4.2.4 `ClusterMap`
- Mapa coroplético coloreado por cluster

---

### Tab 3 — Impacto

#### 4.3.1 `CorrelationBarChart`
- Barras horizontales: variable objetivo (seleccionable) vs. todas las demás
- Orden: mayor correlación absoluta primero
- Colores: positivo → `--green`, negativo → `--red`
- Umbral de significancia: barras con p > 0.05 se muestran con opacidad 40%
- **Dato esperado:** `dashboard_data/correlations.json` → `pearson.matrix` + `pearson.variables`

#### 4.3.2 `PairScatterChart`
- Scatter XY entre la variable objetivo y la variable correlacionada seleccionada
- Incluir línea de tendencia (regresión lineal simple) y valor R²
- Estado seleccionado: punto resaltado con halo + etiqueta
- **Dato esperado:** `state_cards.json` (todos los estados) para el par de variables

#### 4.3.3 `BoxplotPanel`
- Boxplots horizontales para cada variable activa (5 max)
- Valores atípicos marcados como puntos individuales (IQR method)
- Estado seleccionado: marcado en `--blue` sobre cada boxplot
- **Dato esperado:** `dashboard_data/distributions.json` → `[variable].box` + `dashboard_data/outliers_iqr.json`

#### 4.3.4 `CorrelationMatrixTable`
- Tabla de las top 15 correlaciones (pares de variables)
- Columnas: Variable 1, Variable 2, Correlación (r), p-value, Significancia (★★★)
- Colores de correlación según intensidad: `rank-good` / `rank-alert`
- **Dato esperado:** `dashboard_data/correlations.json`

#### 4.3.5 `MultivariateRegressionPlot`

Playground de regresión OLS múltiple calculado en el cliente sobre los 32 estados (n = 32).

**Controles (panel superior):**
- **Variable dependiente (Y):** `<select>` con todas las métricas del catálogo. Default: `personas_usuarias_internet_pct`.
- **Variables independientes (X₁…Xₖ):** chips seleccionables, máximo 4 predictores simultáneos. Al intentar agregar una 5ª variable se muestra tooltip: "Con n = 32 estados, más de 4 predictores genera riesgo de sobreajuste."
- Botón **"Calcular modelo"** (primario, `--blue`): dispara el cálculo OLS. Deshabilitado si no hay al menos 1 predictor seleccionado.
- Botón **"Limpiar"** (secundario, ghost): resetea predictores a vacío.

**Gráfica principal — Coeficientes estandarizados (β):**
- Barras horizontales, una por cada predictor seleccionado, ordenadas por valor absoluto de β (descendente).
- Eje X: coeficiente β estandarizado (variables en unidades de SD); eje Y: nombre corto de la variable.
- Cada barra incluye línea de intervalo de confianza al 95% (whisker).
- Línea vertical en `x = 0` (referencia).

**Colores de barras:**
- β positivo: `--green` (`#065f46`)
- β negativo: `--red` (`#991b1b`)
- p ≥ 0.05 (no significativo): misma barra al 40% de opacidad
- Intervalo de confianza (whisker): mismo color al 30% de opacidad

**Panel de estadísticas (debajo de la gráfica principal):**

| Estadístico | Display |
|---|---|
| R² | `R² = 0.XX` |
| R² ajustada | `R²_adj = 0.XX` |
| Estadístico F y p-value | `F(k, 31−k) = XX.X, p < 0.001` |

Tabla de coeficientes por variable:

| Variable | β (std) | Error estándar | t | p-value | Sig. |
|---|---|---|---|---|---|
| nombre_var | 0.XX | 0.XX | 0.XX | 0.XXX | ★★★ |

Significancia según §6: `< 0.001 → ***`, `< 0.01 → **`, `< 0.05 → *`, `≥ 0.05 → ns`.

**Gráfica secundaria — Valores reales vs. predichos:**
- Scatter XY: eje X = Ŷ (predicho por el modelo), eje Y = Y (real).
- Línea diagonal punteada de referencia (ajuste perfecto, pendiente 1).
- Cada punto = un estado; punto del estado seleccionado resaltado en `--blue` con halo + etiqueta.
- Título: `"Valores reales vs. predichos — R² = 0.XX"`.

**Advertencias y estados especiales:**
- Si k ≥ 5 predictores (no debería ocurrir por límite de UI), mostrar `InsightBox` en `--amber`: "Modelo con riesgo de sobreajuste (n = 32, k ≥ 5)."
- Si R²_adj < 0.10: mostrar nota al pie: "El modelo explica poca variación. Considera agregar otros predictores."
- Si algún predictor tiene VIF > 5: indicar colinealidad junto al nombre de la variable con icono `⚠`.

**Dato esperado:** `state_cards.json` → campo `metrics` de los 32 estados. Cálculo OLS en el cliente (sin dependencia externa); VIF calculado como `1 / (1 − R²_j)` mediante regresiones auxiliares.

---

### Tab 4 — Temporal

> **Nota de datos:** ENDUTIH es anual; actualmente solo hay datos de 2024. Esta tab será funcional cuando se agreguen años anteriores.
> Se proponen las siguientes secciones.

#### 4.4.1 KPI Grid — Cambio temporal (3 cards)
- Cada card: métrica, valor actual, delta vs. año anterior o periodo base.

#### 4.4.2 `TimeSeriesChart`
- Líneas múltiples: histórico (sólido) + proyección (punteado)
- Máximo 3 variables simultáneas
- Eje Y secundario opcional para variables con unidades distintas

#### 4.4.3 `ChangeBarChart`
- Barras de cambio relativo por variable (actual vs. base)
- Colores: positivo → `--green`, negativo → `--red`

---

## 5. Convenciones para valores faltantes y anómalos

### 5.1 Valores faltantes

| Contexto | Display |
|---|---|
| KPI card value | `"N/D"` (texto `--text-3`, no DM Mono) |
| KPI card compare | Ocultar la línea de comparación |
| Punto en scatter | Excluir del chart; agregar nota al pie: "X estados sin dato" |
| Celda en tabla | `—` (guión largo, centrado) |
| Barra en bar chart | Barra gris claro (`#d1d5db`), sin valor en label |
| Eje de radar | Excluir variable del radar si > 20% de estados tienen null |

### 5.2 Valores anómalos (outliers)

Definición: valor fuera de `[Q1 − 1.5×IQR, Q3 + 1.5×IQR]` según `dashboard_data/outliers_iqr.json`.

| Contexto | Display |
|---|---|
| KPI card | Borde izquierdo `3px solid --amber` + icono `⚠` junto al valor |
| Punto en scatter | Forma diferente (triángulo en lugar de círculo) + color `--amber` |
| Celda en tabla | Fondo `#fffbeb` (amber-50) |
| Barra en bar chart | Sin cambio visual (la posición ya indica la anomalía) |
| Tooltip | Siempre mencionar: "Valor atípico según IQR" |

### 5.3 Comparativas (delta vs. benchmark)

- **Metrica "mayor es mejor"** (internet, PIB, cobertura): delta positivo → `--green`, negativo → `--red`
- **Metrica "menor es mejor"** (pobreza, brecha, carencia): delta positivo → `--red`, negativo → `--green`
- El catálogo de métricas debe incluir un campo `direction: "higher_better" | "lower_better"`

---

## 6. Reglas de redondeo

| Tipo de dato | Decimales | Ejemplo |
|---|---|---|
| Porcentajes (`%`) | 1 decimal | `32.4 %` |
| Puntos porcentuales (`pp`) | 1 decimal | `+5.2 pp` |
| Coeficientes de correlación | 2 decimales | `r = 0.84` |
| Scores compuestos | 1 decimal | `67.3 pts` |
| PIB total (millones MXN) | 0 decimales, separador de miles | `$328,088 M` |
| PIB per cápita (normalizado) | 2 decimales | `0.23` |
| Población total | 0 decimales, separador de miles | `1,425,607` |
| Varianza explicada PCA | 1 decimal | `45.2 %` |
| p-values | Notación de significancia: `< 0.001` → `***`, `< 0.01` → `**`, `< 0.05` → `*`, `≥ 0.05` → ns |

---

## 7. Inventario de componentes

### Layout
| Componente | Props clave | Estado |
|---|---|---|
| `AppShell` | `children` | Crear |
| `Sidebar` | `states, selectedStates, onToggleState, comparisonTarget, activeVars` | Crear |
| `MainContent` | `children` | Crear |

### Navegación
| Componente | Props clave | Estado |
|---|---|---|
| `TabBar` | `tabs, activeTab, onTabChange` | Crear |
| `TabPanel` | `id, children` | Crear |

### Sidebar sub-componentes
| Componente | Props clave | Estado |
|---|---|---|
| `StateSearch` | `value, onChange` | Crear |
| `StateList` | `states, selected, onToggle` | Crear |
| `ComparisonSelect` | `value, onChange, options` | Crear |
| `VarChipList` | `vars, activeVars, maxActive, onToggle` | Crear |

### KPI
| Componente | Props clave | Estado |
|---|---|---|
| `KpiCard` | `label, value, compare, delta, direction, isOutlier, isMissing` | Refactor (existe `ExecutiveKpiGrid`) |
| `KpiGrid` | `cards[]` | Refactor |

### Charts
| Componente | Props clave | Fuente de datos | Estado |
|---|---|---|---|
| `ComparisonRadarChart` | `stateValues, nationalValues, variables` | `state_cards.json` normalizado | Crear |
| `DistributionHistogram` | `bins, counts, highlightState, nationalMean` | `distributions.json` | Crear |
| `RankingTable` | `rows[], highlightState, metric` | `rankings.json` | Crear |
| `CorrelationBarChart` | `correlations[], targetVariable, threshold` | `correlations.json` | Crear |
| `PairScatterChart` | `data[], xVar, yVar, highlightState` | `state_cards.json` | Refactor (existe `CorrelationScatter`) |
| `BoxplotPanel` | `distributions[], variables, highlightState` | `distributions.json` + `outliers_iqr.json` | Crear |
| `CorrelationMatrixTable` | `pairs[]` | `correlations.json` | Crear |
| `TimeSeriesChart` | `series[], variables` | Datos históricos (Fase 4) | Placeholder |
| `ChoroplethMap` | `states[], variable, selectedState` | `state_cards.json` | Placeholder (Fase 3) |
| `PcaScatterChart` | `points[], clusters` | Output Fase 2 | Placeholder |
| `ComparisonBarChart` | Existente | Existente | Mantener |
| `DumbbellComparisonChart` | Existente | Existente | Mantener |
| `MetricHeatmapChart` | Existente | Existente | Mantener |

### Feedback
| Componente | Props clave | Estado |
|---|---|---|
| `InsightBox` | `title, children` | Refactor (existe `ExecutiveInsightList`) |
| `EmptyState` | `title, description` | Mantener |
| `PhasePlaceholder` | `message, availableIn` | Crear |
| `MissingDataNote` | `count, total` | Crear |

---

## 8. Notas de accesibilidad

- Todos los charts deben tener un `aria-label` descriptivo
- Colores de estado (green/red) nunca deben ser la única señal → acompañar con icono (▲ ▼) o texto
- Contraste mínimo 4.5:1 para texto sobre fondos de color
- Focus visible en todos los elementos interactivos del sidebar

---
