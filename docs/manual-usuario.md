# Manual de Usuario - Observatorio de Indicadores Territoriales

**Versión:** 1.4 | **Proyecto:** Huawei México - Dashboard Territorial  
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

Las siguientes herramientas deben estar instaladas en el sistema. Son dependencias del entorno — no se instalan con `npm install` ni con `pip`.

| Requisito | Versión mínima | Cómo verificar | Descarga |
|---|---|---|---|
| Node.js | 18.x | `node --version` | [nodejs.org](https://nodejs.org) |
| npm | 9.x | `npm --version` | incluido con Node.js |
| Python | 3.9+ | `python3 --version` | [python.org/downloads](https://www.python.org/downloads/) |
| Git | cualquier reciente | `git --version` | [git-scm.com](https://git-scm.com) |
| Git LFS | cualquier reciente | `git lfs --version` | [git-lfs.com](https://git-lfs.com) |

> **¿No tienes alguna herramienta instalada?**  
> Instalar Node.js desde [nodejs.org](https://nodejs.org) (incluye npm automáticamente). Para Python, descargar el instalador desde [python.org](https://www.python.org/downloads/) — marcar la casilla **"Add Python to PATH"** durante la instalación en Windows. Git LFS: una vez instalado Git, ejecutar `git lfs install` una sola vez.

### Alternativa: GitHub Codespaces (sin instalación local)

Si no es posible instalar las herramientas localmente, el repositorio puede ejecutarse directamente en el navegador usando GitHub Codespaces:

1. Abrir [github.com/joa-b24/Huawei-Final-project](https://github.com/joa-b24/Huawei-Final-project)
2. Hacer clic en **Code → Codespaces → Create codespace on main**
3. Esperar a que el entorno cargue (~1-2 min), luego ejecutar `npm install && npm run dev` en la terminal integrada
4. Codespaces abrirá automáticamente una URL pública para acceder al dashboard

> Codespaces tiene un límite de horas gratuitas por mes en cuentas GitHub gratuitas. Para uso prolongado se recomienda la instalación local.

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

<!-- SCREENSHOT: Vista inicial del dashboard al cargar — mapa de México coloreado, sidebar con chips de variables, KPI cards en la parte superior -->
> 📸 *[Imagen: Vista inicial del dashboard]*

Si al abrir el dashboard no se ven el mapa, los KPI cards o el sidebar, revisar la [sección de problemas frecuentes](#7-solución-de-problemas-frecuentes).

---

## 3. Navegación de la interfaz

La interfaz se divide en dos áreas:

- **Sidebar:** que permite seleccionar un estado foco y variables.
- **Area de análisis:** 4 pestañas interactivas. Diagnóstico, Impacto, Territorial y Evolución, además de pestañas no interactivas como Estructura, Datos o Ayuda.

**Seleccionar un estado:**  
Escribir en el buscador (acepta texto parcial, ej. `"jal"` para Jalisco) o hacer clic directamente sobre el mapa. El estado seleccionado aparece como etiqueta azul con botón `×` para deseleccionar.

<!-- SCREENSHOT: Sidebar con un estado seleccionado (etiqueta azul) y varios chips de variables activos con badges MUN/HIST -->
> 📸 *[Imagen: Sidebar con estado y variables seleccionados]*

**Seleccionar variables:**  
Las variables disponibles aparecen como chips debajo del buscador. Activar o desactivar con clic. Máximo 5 activas simultáneamente.

Cada chip puede mostrar una o dos insignias que indican qué tipo de datos extra están disponibles para esa variable:

| Insignia | Color | Significado |
|---|---|---|
| **MUN** | Azul | La variable tiene datos a nivel municipal |
| **HIST** | Verde | La variable tiene datos históricos (series de tiempo) |

Usar los filtros **Todas / Municipal / Histórica** sobre los chips para mostrar únicamente las variables con esa cobertura.

Las variables activas determinan qué se muestra en todos los gráficos. La variable que se visualiza en los paneles de distribución, mapa y ranking se selecciona de forma unificada desde la sección **"Análisis de variable"** — cambiarla ahí sincroniza todos los paneles automáticamente.

> El sidebar se oculta automáticamente al abrir las pestañas **Datos** y **Estructura** para aprovechar el ancho completo de pantalla. Vuelve a aparecer al regresar a Diagnóstico, Impacto o Evolución.

---

## 4. Guía por sección de análisis

### 4.1 Diagnóstico

Perfil del estado seleccionado y su posición respecto al resto del país. Es la sección principal del dashboard.

---

**KPI Cards**

Cada card muestra el valor del estado para una variable activa y un delta respecto a la media nacional. El color del delta indica si el estado está en ventaja (verde) o desventaja (rojo) según la naturaleza de la variable — para métricas donde más es mejor (ej. cobertura de internet), un valor superior a la media aparece en verde; para métricas donde menos es mejor (ej. pobreza), la lógica se invierte. Un ícono `⚠` y borde ámbar indican un valor atípico.

Las cards muestran un distintivo **MUN** cuando la variable tiene datos municipales disponibles para el estado actualmente seleccionado.

<!-- SCREENSHOT: Fila de KPI cards mostrando deltas en verde/rojo, al menos una con ícono de atípico y una con badge MUN -->
> 📸 *[Imagen: KPI cards con deltas, marcador de atípico y badge MUN]*

---

**Perfil comparativo (Radar / Barras)**

Gráfico de araña con las variables activas. El estado seleccionado siempre aparece en azul. Todos los valores están normalizados a escala 0–100 para que variables con unidades distintas sean comparables en el mismo gráfico.

Usar el toggle **Radar | Barras** para cambiar entre representaciones. Los grupos de comparación activos (Nacional, Región, estado individual) aparecen superpuestos en ambas vistas.

<!-- SCREENSHOT: Gráfico de radar con el estado en azul y comparación nacional superpuesta -->
> 📸 *[Imagen: Radar comparativo con grupos de comparación]*

---

**Análisis de variable**

Panel central del tab Diagnóstico. Contiene un selector de variable único que sincroniza los tres paneles inferiores — cambiar la variable aquí actualiza simultáneamente la distribución, el mapa y el ranking sin necesidad de seleccionarla por separado en cada panel.

Debajo del selector, una narrativa automática describe la posición del estado en la distribución nacional: percentil, distancia a la media, forma de la distribución y si el valor es atípico. Se actualiza al cambiar la variable o el estado. En modo municipal, el panel se renombra a **"Vista municipal"** y la narrativa describe la posición relativa dentro del estado.

---

**Vista nacional (Distribución + Mapa + Ranking)**

Tres paneles que muestran la variable seleccionada en "Análisis de variable" para los 32 estados. Todos se sincronizan con el mismo selector.

- **Distribución:** histograma con el estado seleccionado resaltado, boxplot inferior para ver cuartiles y atípicos. Pasar el cursor sobre una barra muestra los estados en ese rango. Incluye la posición en ranking del estado.
- **Mapa coroplético:** colorea los estados por valor (azul más intenso = mayor valor). Hacer clic en un estado lo selecciona como estado activo.
- **Ranking:** los 32 estados ordenados por la variable, fila del estado activo resaltada en azul claro. Toggle **Tabla | Lollipop** para cambiar la visualización.

---

**Vista municipal — "Ver municipios"**

El botón **"Ver municipios →"** aparece debajo de "Análisis de variable" únicamente cuando la variable actualmente seleccionada en ese panel tiene datos municipales disponibles para el estado activo (indicado también por el badge **MUN** en la KPI card correspondiente). Al activarlo, los tres paneles nacionales se reemplazan por sus equivalentes municipales.

- **Distribución municipal:** histograma de los municipios del estado para la variable seleccionada, con media y mediana.
- **Mapa municipal:** coroplético con zoom automático al estado seleccionado. Cada municipio se colorea según su valor; el tooltip muestra el nombre y el valor.
- **Ranking municipal:** municipios ordenados de mejor a menor desempeño (top 10 / bottom 10 con toggle). La columna "vs media" muestra la diferencia respecto al promedio estatal.

Cada panel tiene su propio selector de variable, por lo que es posible ver distribución, mapa y ranking de variables distintas al mismo tiempo. Para volver a la vista nacional usar el botón **"← Vista nacional"**.

<!-- SCREENSHOT: Vista municipal activa — mapa con zoom al estado, histograma de municipios y ranking municipal -->
> 📸 *[Imagen: Vista municipal con mapa con zoom y ranking de municipios]*

> Los datos municipales disponibles dependen del estado y de las variables activas. No todas las variables tienen cobertura municipal completa.

---

### 4.2 Estructura

Agrupa los estados según similitud de perfil multidimensional usando clustering (K-Means) y análisis de componentes principales (PCA). El sidebar se oculta en esta sección para aprovechar el ancho completo.

**Nota metodológica:** la parte superior de la sección muestra una explicación integrada del método: qué captura cada componente principal (PC1, PC2) con sus porcentajes reales de varianza explicada, cómo se calculó el índice compuesto de madurez digital, y el criterio de agrupamiento K-Means con los nombres reales de cada cluster.

**Scatter PCA:** cada punto es un estado. Los ejes corresponden a PC1 y PC2. Los puntos están coloreados por cluster; el estado seleccionado aparece resaltado con un halo.

**Panel de cluster:** nombre del cluster, lista de estados miembro, características del grupo e implicación estratégica.

**Mapa de clusters:** coroplético coloreado por cluster, mostrando la distribución geográfica de los grupos.

<!-- SCREENSHOT: Sección Estructura con scatter PCA y mapa de clusters visibles, nota metodológica en la parte superior -->
> 📸 *[Imagen: Vista completa de Estructura con nota metodológica y scatter PCA]*

---

### 4.3 Impacto

Analiza relaciones estadísticas entre variables para los 32 estados.

**Correlaciones:** barras horizontales que muestran la correlación de cada variable con una variable objetivo seleccionable. Positivo en verde, negativo en rojo. Las barras con p-value ≥ 0.05 aparecen con menor opacidad.

**Dispersión de par:** al seleccionar una variable correlacionada, muestra el scatter entre las dos variables con línea de tendencia y R².

**Playground de regresión (OLS):** modelo de regresión múltiple interactivo sin código. Seleccionar la variable dependiente (Y) y hasta 4 predictores (X), luego hacer clic en "Calcular modelo". Muestra coeficientes β estandarizados, tabla con p-values, R² y scatter de valores reales vs. predichos.

---

### 4.4 Evolución

Muestra el comportamiento histórico de los indicadores del estado seleccionado. Solo están disponibles las variables con badge **HIST** (verde) en el sidebar.

**KPI Cards de cambio temporal:** valor actual de cada métrica con delta respecto al periodo base disponible.

**Gráfico de series de tiempo:** líneas con el histórico en trazo sólido y proyección en trazo punteado (modelos ARIMA / Holt-Winters). Cuando las variables tienen unidades distintas se habilita un eje Y secundario.

**Barras de cambio relativo:** cambio porcentual entre el periodo actual y el periodo base, en verde si es positivo, rojo si es negativo.

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
