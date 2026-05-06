# Estándar de datos territoriales
**Versión:** 2.1 | **Actualizado:** 2026-05-06

## Objetivo

Definir un esquema consistente para ingestar, transformar y exponer datos territoriales en el dashboard, manteniendo separadas cuatro piezas:

1. **Catálogo de variables** — qué significa cada indicador.
2. **Maestro de estados** — nombres canónicos y metadatos territoriales.
3. **Datasets procesados** — observaciones estandarizadas listas para análisis.
4. **Serving layer** — los archivos que el frontend realmente carga.

---

## 1. Catálogo de variables

**Archivo:** `data/catalogs/variables.catalog.json`

Cada variable tiene los campos obligatorios:

| Campo | Tipo | Descripción |
|---|---|---|
| `variable_id` | string | Nombre canónico en `snake_case` |
| `categoria_id` | CategoryId | Ver categorías abajo |
| `nombre` | string | Label legible para UI |
| `descripcion` | string | Descripción completa |
| `unidad_base` | string | `%`, `MDP`, `personas`, etc. |
| `tipo_valor` | string | `percentage` / `number` / `integer` / `currency` |
| `agregacion_default` | string | `avg` / `sum` / `latest` |
| `direction` | string | `higher_better` / `lower_better` |
| `fuente_sugerida` | string | Fuente de origen |
| `sinonimos` | string[] | Aliases para ingesta |

El campo `direction` determina si un delta positivo se colorea en verde o rojo en la UI.

### Categorías disponibles

| categoria_id | Nombre | Descripción |
|---|---|---|
| `infraestructura_digital` | Infraestructura digital | Acceso y uso de dispositivos e internet |
| `cobertura_red` | Cobertura de red | Disponibilidad y penetración de redes móviles |
| `industria` | Industria | Actividad económica e indicadores industriales |
| `contexto_territorial` | Contexto territorial | Condiciones demográficas y territoriales |
| `bienestar_social` | Bienestar social | Pobreza, carencias y bienestar (CONEVAL) |
| `economia` | Economía | PIB y actividad económica estatal |
| `demografia` | Demografía | Estructura poblacional (INEGI ITER) |

---

## 2. Maestro de estados

**Archivo:** `data/catalogs/states.master.json`

Cada entrada tiene:

| Campo | Descripción |
|---|---|
| `state_code` | Clave corta canónica (ej. `JAL`, `CMX`) |
| `cve_ent` | Clave INEGI de dos dígitos (ej. `"09"`) |
| `estado` | Nombre oficial normalizado sin acentos |
| `aliases` | Variantes aceptadas para ingesta |
| `region` | Región geográfica |
| `capital` | Capital del estado |

La normalización en el frontend (`src/utils/normalization.ts`) cubre todos los aliases del maestro.

---

## 3. Formatos de dataset procesado

### 3a. Formato largo (long) — estatal

Un registro por observación: `estado × variable × año`.

```json
{
  "state_code": "JAL",
  "cve_ent": "14",
  "estado": "Jalisco",
  "categoria": "infraestructura_digital",
  "variable": "personas_usuarias_internet_pct",
  "valor": 83.5,
  "anio": 2024,
  "fuente": "INEGI ENDUTIH 2024",
  "unidad": "%"
}
```

### 3b. Formato ancho (wide) — estatal

Un registro por estado con todas las métricas en un objeto `metrics`.

```json
{
  "state_code": "JAL",
  "cve_ent": "14",
  "estado": "Jalisco",
  "region": "Occidente",
  "anio": 2024,
  "metrics": {
    "personas_usuarias_internet_pct": 83.5,
    "localidades_con_4g_garantizada_pct": 74.2
  }
}
```

### 3c. Formato largo (long) — municipal

Un registro por observación: `municipio × variable × año`.

```json
{
  "cve_ent": "14",
  "id_cvegeo": "14039",
  "nom_mun": "Guadalajara",
  "state_code": "JAL",
  "estado": "Jalisco",
  "categoria": "cobertura_red",
  "variable": "int_pct_4g_coverage",
  "valor": 92.3,
  "anio": 2025,
  "fuente": "Ookla Open Datasets",
  "unidad": "%"
}
```

### 3d. Serie temporal

Un punto por año por estado, para habilitar análisis de tendencias.

```json
{
  "state_code": "JAL",
  "estado": "Jalisco",
  "variable": "personas_usuarias_internet_pct",
  "points": [
    { "anio": 2020, "valor": 68.1 },
    { "anio": 2022, "valor": 76.4 },
    { "anio": 2024, "valor": 83.5 }
  ]
}
```

---

## 4. Outputs analíticos (Layer 1)

Generados por `scripts/analytics/layer1_descriptive.py`. Se guardan en `data/processed/`.

| Archivo | Contenido |
|---|---|
| `state_cards.json` | Perfil completo por estado (métricas fusionadas, overall_score) |
| `correlations.json` | Matrices Pearson y Spearman entre todas las variables |
| `distributions.json` | Histogramas + test Shapiro-Wilk por variable |
| `rankings.json` | Ranking de estados por variable |
| `outliers_iqr.json` | Valores atípicos por método IQR |
| `gini.json` | Coeficiente de Gini por variable |
| `univariate_stats.csv` | Estadísticos descriptivos completos |
| `combined_data.csv` | Dataset fusionado (contexto + digital) |
| `estados.geojson` | Polígonos estatales simplificados en WGS84 para el mapa coroplético |

---

## 5. Serving layer

**Directorio:** `public/data/`

Es el único directorio que lee el frontend. Se puebla ejecutando `scripts/publish.py`.
**Nunca escribir directamente en `public/data/`** — siempre pasar por el pipeline.

Archivos presentes en `public/data/` tras un publish completo:

| Archivo | Origen |
|---|---|
| `endutih_2024_state_dashboard.wide.json` | `scripts/etl/build_endutih_2024.py` |
| `context_variables_state_dashboard.wide.json` | `scripts/etl/build_context_variables.py` |
| `cobertura_red_por_estado_2025.json` | `scripts/etl/build_cobertura_red.py` |
| `cobertura_red_por_municipio_2025.json` | `scripts/etl/build_cobertura_red.py` |
| `estados.geojson` | `scripts/etl/build_geojson.py` |
| `state_cards.json` | `scripts/analytics/layer1_descriptive.py` |
| `correlations.json` | `scripts/analytics/layer1_descriptive.py` |
| `distributions.json` | `scripts/analytics/layer1_descriptive.py` |
| `rankings.json` | `scripts/analytics/layer1_descriptive.py` |
| `outliers_iqr.json` | `scripts/analytics/layer1_descriptive.py` |
| `variables.catalog.json` | `data/catalogs/` (copiado directamente) |
| `states.master.json` | `data/catalogs/` (copiado directamente) |

---

## 6. Regla práctica de nombres

- El `catálogo` define el vocabulario — si no está ahí, la variable no existe.
- El `maestro de estados` define las entidades — usar siempre `state_code` o `cve_ent` como llave.
- El `formato largo` es la fuente analítica principal — permite filtrar por año, fuente y categoría.
- El `formato ancho` se genera por conveniencia para la UI — no es fuente de verdad.
- `public/data/` es solo una copia de distribución — no editar a mano.

---

## 7. Convención para datos futuros

| Granularidad | Formato recomendado | Llave principal |
|---|---|---|
| Estatal (actual) | Wide JSON por dataset | `cve_ent` |
| Municipal | Long JSON con `id_cvegeo` | `id_cvegeo` (CVEGEO INEGI) |
| Temporal | Array de `{anio, valor}` por estado+variable | `state_code + variable + anio` |
| Outputs de modelos | JSON con tipo `ClusteringOutput` o `PcaStateResult` | `state_code` |
| Métricas compuestas | Mismo formato ancho, `categoria_id: "modelo"` | `state_code` |
