# UI/UX Specifications — Observatorio de Indicadores por Estado
**Versión:** 2.1 | **Actualizado:** 2026-05-06

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
│ Estado principal          │ [Tab Content]            │
│ └─ typeahead (1 estado)   │                          │
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

### 3.1 `StateTypeahead`
- Input de búsqueda filtra sugerencias en tiempo real (máx. 8 resultados).
- Selección de un único estado primario (`primaryState`). El estado seleccionado aparece como badge azul con botón `×` para deseleccionar.
- **Dato esperado:** array de nombres de estado desde `state_cards.json`.

### 3.2 `VarChipList`
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

#### 4.1.2 `ComparisonRadarChart` (estado vs. grupos)
- Spider/radar de N ejes (variables activas), con toggle **Radar | Barras**.
- El estado primario siempre aparece en azul. El usuario configura hasta 3 grupos de comparación adicionales: **Nacional** (media de 32 estados), **Región** (media de estados de la misma región), o **estados individuales** (chips seleccionables con dropdown).
- La selección de grupos se resetea automáticamente al cambiar de estado primario.
- **Dato esperado:** valores normalizados 0–100 por variable via `normalizeForRadar()` (min-max sobre los 32 estados); promedios de región calculados en cliente.

#### 4.1.3 `DistributionHistogram`
- Histograma de la variable seleccionada para los 32 estados. Cuando hay más de una variable activa, se muestra un `<select>` para elegir cuál visualizar.
- Barra del estado seleccionado: resaltada en `--blue`
- Barra de la media nacional: línea vertical punteada en `--text-3`
- Tooltip por bin: rango, conteo de estados y lista de nombres; el estado primario aparece en **negrita**.
- **Dato esperado:** `distributions.json` → `[variable].histogram`; asignación de estados a bins calculada en cliente.

#### 4.1.4 `RankingTable`
- Tabla de los 32 estados ordenada por la variable seleccionada. Cuando hay más de una variable activa, se muestra un `<select>` para elegir cuál rankear. Toggle **Tabla | Barras**.
- Columnas: `#`, Estado, Valor, delta vs. media nacional
- Delta coloreado según `direction`: `higher_better` → positivo verde / negativo rojo; `lower_better` → invertido.
- Estado primario: fila resaltada con fondo `--blue-light`, borde izquierdo `--blue`
- **Dato esperado:** `rankings.json` → `[variable][]`; fallback calculado en cliente si el archivo no incluye la variable.

#### 4.1.5 `ChoroplethMap` (mapa de México)
- Mapa coroplético coloreado por la variable activa (selector cuando hay más de una).
- Escala de color continua azul min→max; respeta `direction` de la métrica.
- Estado primario: borde `--blue` 2px. Click en cualquier estado lo selecciona como primario.
- Tooltip flotante: nombre del estado + valor + unidad.
- **Dato esperado:** `public/data/estados.geojson` (polígonos) + valores de `dataset.records`; join por `cve_ent`.

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

#### 4.3.3 `MultivariateRegressionPlot`

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
| PIB per cápita (k MXN) | 1 decimal | `356.4 k MXN` |
| Población total | 0 decimales, separador de miles | `1,425,607` |
| Varianza explicada PCA | 1 decimal | `45.2 %` |
| p-values | Notación de significancia: `< 0.001` → `***`, `< 0.01` → `**`, `< 0.05` → `*`, `≥ 0.05` → ns |

---

## 7. Inventario de componentes

### Layout
| Componente | Props clave | Estado |
|---|---|---|
| `Sidebar` | `states, primaryState, onSelectState, vars, activeVarIds, onToggleVar` | Implementado |
| `App` | orquesta contexto y tabs | Implementado |

### Navegación
| Componente | Props clave | Estado |
|---|---|---|
| `TabBar` | `tabs, activeTab, onTabChange` | Implementado |

### Sidebar sub-componentes
| Componente | Props clave | Estado |
|---|---|---|
| `StateTypeahead` | typeahead de estado único con badge | Implementado (inline en Sidebar) |
| `VarChipList` | `vars, activeVarIds, onToggle` | Implementado |
| `ComparisonSelect` | — | Eliminado (comparación vive en `ComparisonRadarChart`) |

### KPI
| Componente | Props clave | Estado |
|---|---|---|
| `KpiCard` | `label, value, unit, delta, direction, isOutlier` | Implementado |
| `KpiGrid` | `cards[]` | Implementado |

### Charts
| Componente | Props clave | Fuente de datos | Estado |
|---|---|---|---|
| `ComparisonRadarChart` | `primaryState, stateRegion, variables, normalizedMap, nationalValues, stateRegionMap, allStateNames` | `normalizeForRadar()` en cliente | Implementado |
| `DistributionHistogram` | `histogram, highlightValue, nationalMean, label, binStates` | `distributions.json` + cálculo en cliente | Implementado |
| `RankingTable` | `rows[], highlightState, metricLabel, unit, view, direction` | `rankings.json` + fallback en cliente | Implementado |
| `CorrelationBarChart` | `correlations[], targetVariable, threshold` | `correlations.json` | Implementado |
| `PairScatterChart` | `data[], xVar, yVar, highlightState` | `state_cards.json` | Implementado |
| `ChoroplethMap` | `appData` | `estados.geojson` + `dataset.records` | Implementado |
| `BoxplotPanel` | — | — | Eliminado |
| `CorrelationMatrixTable` | — | — | Eliminado |
| `TimeSeriesChart` | `series[], variables` | Datos históricos (pendiente) | Placeholder |
| `PcaScatterChart` | `points[], clusters` | Output clustering (pendiente) | Placeholder |

### Feedback
| Componente | Props clave | Estado |
|---|---|---|
| `InsightBox` | `title, children` | Implementado |
| `EmptyState` | `title, description` | Implementado |
| `PhasePlaceholder` | `message` | Implementado |

---

## 8. Notas de accesibilidad

- Todos los charts deben tener un `aria-label` descriptivo
- Colores de estado (green/red) nunca deben ser la única señal → acompañar con icono (▲ ▼) o texto
- Contraste mínimo 4.5:1 para texto sobre fondos de color
- Focus visible en todos los elementos interactivos del sidebar

---
