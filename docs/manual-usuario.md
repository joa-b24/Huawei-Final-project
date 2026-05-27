# Manual de Usuario - Observatorio de Indicadores Territoriales

**Versión:** 1.2 | **Proyecto:** Huawei México - Dashboard Territorial  
**Última actualización:** Mayo 2026

---

## Tabla de contenidos

- [Manual de Usuario - Observatorio de Indicadores Territoriales](#manual-de-usuario---observatorio-de-indicadores-territoriales)
  - [Tabla de contenidos](#tabla-de-contenidos)
  - [1. Requisitos previos](#1-requisitos-previos)
  - [2. Instalación y primer arranque](#2-instalación-y-primer-arranque)
  - [3. Navegación de la interfaz](#3-navegación-de-la-interfaz)
  - [4. Guía por sección de análisis](#4-guía-por-sección-de-análisis)
    - [4.1 Diagnóstico](#41-diagnóstico)
    - [4.2 Estructura](#42-estructura)
    - [4.3 Impacto](#43-impacto)
    - [4.4 Evolución](#44-evolución)
  - [5. Actualizar o agregar datos](#5-actualizar-o-agregar-datos)
    - [Variables estatales](#variables-estatales)
    - [Variables municipales](#variables-municipales)
    - [Convenciones](#convenciones)
  - [6. Referencia de documentación técnica](#6-referencia-de-documentación-técnica)
  - [7. Solución de problemas frecuentes](#7-solución-de-problemas-frecuentes)

---

## 1. Requisitos previos

| Requisito | Versión mínima | Cómo verificar |
|---|---|---|
| Node.js | 18.x | `node --version` |
| npm | 9.x | `npm --version` |
| Python | 3.9+ | `python3 --version` |
| Git LFS | cualquier reciente | `git lfs --version` |

---

## 2. Instalación y primer arranque

```bash
# 1. Clonar y descargar archivos grandes
git clone https://github.com/joa-b24/Huawei-Final-project.git
cd Huawei-Final-project
git lfs install && git lfs pull

# 2. Instalar dependencias del frontend
npm install

# 3. Levantar la aplicación
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`.

> Los archivos de datos ya están incluidos en el repositorio (`public/data/`). No es necesario ejecutar el pipeline para usar el dashboard.

Si al abrir el dashboard no se ven el mapa, los KPI cards o el sidebar, revisar la [sección de problemas frecuentes](#7-solución-de-problemas-frecuentes).

---

## 3. Navegación de la interfaz

La interfaz se divide en dos áreas:

- **Sidebar:** que permite seleccionar un estado foco y variables.
- **Area de análisis:** 4 pestañas interactivas. Diagnóstico, Impacto, Territorial y Evolución, además de pestañas no interactivas como Estructura, Datos o Ayuda.

**Seleccionar un estado:**  
Escribir en el buscador (acepta texto parcial, ej. `"jal"` para Jalisco) o hacer clic directamente sobre el mapa. El estado seleccionado aparece como etiqueta azul con botón `×` para deseleccionar.

**Seleccionar variables:**  
Las variables disponibles aparecen como chips debajo del buscador. Activar o desactivar con clic. Máximo 5 activas simultáneamente. Las variables activas determinan qué se muestra en todos los gráficos.

**Grupos de comparación:**  
Disponibles en el tab Diagnóstico. Permiten superponer en los gráficos el promedio nacional, el de la región del estado, o un estado específico (hasta 3 grupos).

---

## 4. Guía por sección de análisis

### 4.1 Diagnóstico

Perfil del estado seleccionado y su posición respecto al resto del país. Es la sección principal del dashboard.

---

**KPI Cards**

Cada card muestra el valor del estado para una variable activa y un delta respecto a la media nacional. El color del delta indica si el estado está en ventaja (verde) o desventaja (rojo) según la naturaleza de la variable — para métricas donde más es mejor (ej. cobertura de internet), un valor superior a la media aparece en verde; para métricas donde menos es mejor (ej. pobreza), la lógica se invierte. Un ícono `⚠` y borde ámbar indican un valor atípico.

---

**Perfil comparativo (Radar / Barras)**

Gráfico de araña con las variables activas. El estado seleccionado siempre aparece en azul. Todos los valores están normalizados a escala 0–100 para que variables con unidades distintas sean comparables en el mismo gráfico.

Usar el toggle **Radar | Barras** para cambiar entre representaciones. Los grupos de comparación activos (Nacional, Región, estado individual) aparecen superpuestos en ambas vistas.

---

**Estadísticos de distribución**

Narrativa automática que describe la posición del estado en la distribución nacional: percentil, distancia a la media, forma de la distribución y si el valor es atípico. Se actualiza al cambiar la variable o el estado.

---

**Vista nacional (Distribución + Mapa + Ranking)**

Tres paneles que muestran la misma variable a nivel de los 32 estados. Cuando hay más de una variable activa, cada panel tiene su propio selector independiente.

- **Distribución:** histograma de los 32 estados con el estado seleccionado resaltado y un boxplot debajo para ver cuartiles y atípicos. Pasar el cursor sobre una barra muestra los estados en ese rango.
- **Mapa coroplético:** colorea los estados por valor (azul más intenso = mayor valor). Hacer clic en un estado lo selecciona como estado activo.
- **Ranking:** los 32 estados ordenados por la variable. La fila del estado activo aparece resaltada en azul claro. Toggle **Tabla | Lollipop** para cambiar la visualización.

---

**Vista municipal — "Ver municipios"**

Cuando alguna de las variables activas tiene datos disponibles a nivel municipal para el estado seleccionado, aparece el botón **"Ver municipios →"** debajo de la narrativa de distribución. Al activarlo, los tres paneles nacionales se reemplazan por sus equivalentes municipales; la narrativa de distribución permanece visible.

- **Distribución municipal:** histograma de los municipios del estado para la variable seleccionada, con media y mediana.
- **Mapa municipal:** coroplético con zoom automático al estado seleccionado. Cada municipio se colorea según su valor; el tooltip muestra el nombre y el valor.
- **Ranking municipal:** municipios ordenados de mejor a menor desempeño (top 10 / bottom 10 con toggle). La columna "vs media" muestra la diferencia respecto al promedio estatal.

Cada panel tiene su propio selector de variable, por lo que es posible ver distribución, mapa y ranking de variables distintas al mismo tiempo. Para volver a la vista nacional usar el botón **"← Vista nacional"**.

> Los datos municipales disponibles dependen del estado y de las variables activas. No todas las variables tienen cobertura municipal completa.

---

### 4.2 Estructura

Agrupa los estados según similitud de perfil multidimensional usando clustering (`KMeans`) y análisis de componentes principales (PCA).

**Scatter PCA:** cada punto es un estado. Los ejes corresponden a los dos primeros componentes principales que capturan la mayor variación entre estados. Los puntos están coloreados por cluster; el estado seleccionado aparece resaltado.

**Panel de cluster:** nombre del cluster, lista de estados miembro, características del grupo e implicación estratégica.

**Mapa de clusters:** coroplético coloreado por cluster, mostrando la distribución geográfica de los grupos.

---

### 4.3 Impacto

Analiza relaciones estadísticas entre variables para los 32 estados.

**Correlaciones:** barras horizontales que muestran la correlación de cada variable con una variable objetivo seleccionable. Positivo en verde, negativo en rojo. Las barras con p-value ≥ 0.05 aparecen con menor opacidad.

**Dispersión de par:** al seleccionar una variable correlacionada, muestra el scatter entre las dos variables con línea de tendencia y R².

**Playground de regresión (OLS):** modelo de regresión múltiple interactivo sin código. Seleccionar la variable dependiente (Y) y hasta 4 predictores (X), luego hacer clic en "Calcular modelo". Muestra coeficientes β estandarizados, tabla con p-values, R² y scatter de valores reales vs. predichos.

---

### 4.4 Evolución

Muestra el comportamiento histórico de los indicadores. Esta sección requiere datos de series de tiempo por estado y año; actualmente muestra las series disponibles para las variables que cuentan con histórico importado.

---

## 5. Actualizar o agregar datos

> Esta sección está dirigida a perfiles técnicos.

### Variables estatales

1. Colocar el archivo fuente en `data/raw/`
2. Crear o adaptar un script en `scripts/etl/`
3. Registrar las variables en `data/catalogs/variables.catalog.json` (`label`, `unit`, `direction`)
4. Ejecutar el pipeline y publicar:
   ```bash
   python3 scripts/etl/build_<fuente>.py
   npm run data:build:analytics
   npm run data:publish
   ```

### Variables municipales

Usar el script de importación directa. No requiere regenerar todo el pipeline:

```bash
python scripts/import_variable.py data/processed/imports/mi_variable.json
```

El archivo de importación es un JSON con esta estructura básica:

```json
{
  "variable_id": "mi_variable",
  "granularity": "municipal",
  "operation": "nueva_variable",
  "catalog_entry": { "nombre": "Mi Variable", "unidad_base": "%", "direction": "higher_better" },
  "records": [
    { "cve_mun": "14039", "metrics": { "mi_variable": 42.1 } }
  ]
}
```

El script escribe los datos en el archivo combinado del estado correspondiente, actualiza el índice de variables disponibles y regenera las estadísticas municipales automáticamente.

### Convenciones

- La llave municipal es `cve_mun` (código INEGI de 5 dígitos, ej. `"14039"`)
- La llave estatal es `cve_ent` en formato `"01"`–`"32"` (con cero a la izquierda)
- Las variables de porcentaje van en escala 0–100, no 0–1
- `public/data/` es la capa de distribución — nunca editar a mano

Para el esquema completo de archivos y formatos: [`docs/data-standard.md`](./data-standard.md).

---

## 6. Referencia de documentación técnica

| Documento | Contenido |
|---|---|
| [`README.md`](../README.md) | Stack, fuentes integradas, estructura del proyecto, flujo de datos |
| [`docs/PIPELINE_ANALYTICS.md`](./PIPELINE_ANALYTICS.md) | Pipeline completo, scripts municipales, variables disponibles |
| [`docs/data-methodology.md`](./data-methodology.md) | Fuentes de datos, ETL detallado, fórmulas de cálculo |
| [`docs/data-standard.md`](./data-standard.md) | Esquemas JSON, formatos de archivos, convenciones de nombres |
| [`docs/ui-ux-specs.md`](./ui-ux-specs.md) | Componentes, design system, especificaciones de cada panel |
| [`docs/GINI_ANALYSIS.md`](./GINI_ANALYSIS.md) | Análisis de desigualdad municipal (Gini / Lorenz) |

---

## 7. Solución de problemas frecuentes

**El mapa no carga o aparece vacío**  
Verificar que `public/data/estados.geojson` existe y no es un puntero de texto (problema de Git LFS):
```bash
git lfs install && git lfs pull
```

**Archivos con contenido `version https://git-lfs.github.com/...`**  
Mismo problema de LFS. Ejecutar los comandos anteriores.

**El botón "Ver municipios" no aparece**  
El estado seleccionado puede no tener datos municipales para las variables activas, o el archivo `public/data/municipal_manifest.json` no está presente. Verificar que el pipeline municipal se ejecutó correctamente.

**Los mapas municipales no cargan**  
Verificar que existen los archivos en `public/data/geo/municipios/` y `public/data/outputs/municipal/` para el estado en cuestión.

**El sidebar no muestra variables o aparece vacío**  
`public/data/` puede estar incompleto. Ejecutar `npm run data:publish` para restaurar los archivos desde `data/processed/`.

**Error `ModuleNotFoundError` al ejecutar el pipeline**  
```bash
pip install -r requirements-pipeline.txt
```
Si se usa entorno virtual, verificar que esté activado antes de instalar y de ejecutar los scripts.

**Error `AttributeError: module 'numpy' has no attribute 'trapz'`**  
```bash
pip install --upgrade numpy
```
