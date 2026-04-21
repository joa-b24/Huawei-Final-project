# Metodología de Transformación y Validación

Este proyecto no usa los archivos fuente de forma directa en la interfaz.  
Antes de llegar al dashboard, los datos pasan por una capa de transformación, estandarización y validación.

## 1. Fuentes integradas

- `tr_endutih_usuarios_anual_2024.csv`
- `tr_endutih_usuarios2_anual_2024.csv`
- `TD_TELEDENSIDAD_INTMOVIL_ITE_VA.csv`
- `loc_tipo_conectividad.csv`
- `localidades_conectividad.csv`

## 2. Estandarización

Las transformaciones principales son:

- normalización de claves estatales con `CVE_ENT` en formato de dos dígitos
- cruce con `states.master.json` para asegurar nombres homogéneos por entidad
- homologación de variables analíticas en `snake_case`
- separación entre `raw`, `catalogs`, `processed` y `public/data`

## 3. Limpieza de microdatos ENDUTIH

Para los archivos de personas usuarias:

- se descartan filas sin `CVE_ENT`
- se descartan filas sin `FAC_PER`
- se agregan respuestas positivas por entidad usando el factor de expansión `FAC_PER`

La estimación aplicada es:

```text
porcentaje = (sumatoria de FAC_PER en respuestas positivas / sumatoria total de FAC_PER por entidad) * 100
```

Esto convierte microdatos individuales en indicadores estatales comparables.

## 4. Agregación territorial de cobertura

Para los archivos de brecha digital por localidad:

- `loc_tipo_conectividad.csv` se filtra al año `2024`
- `localidades_conectividad.csv` aporta `POBLACION`, `TOTHOG` y la clave territorial
- ambas fuentes se unen por `CVEGEO`

Después se calculan porcentajes por entidad usando tres denominadores posibles:

- número de localidades
- población
- hogares

La forma general es:

```text
porcentaje = (sumatoria ponderada con condición positiva / sumatoria total del denominador por entidad) * 100
```

## 5. Salidas analíticas

El pipeline genera dos estructuras principales:

- `endutih_2024_state_observations.long.json`
  - una fila por entidad y variable

- `endutih_2024_state_dashboard.wide.json`
  - una fila por entidad con métricas agrupadas

## 6. Validaciones

El repositorio genera un reporte de calidad con:

- conteo de filas por fuente
- cobertura de métricas por entidad
- detección de duplicados entidad-variable
- verificación de rango para variables porcentuales
- estadísticos descriptivos por métrica

Ese reporte se genera con:

```bash
npm run data:report:endutih
```

o junto con todo el pipeline:

```bash
npm run data:build:all
```

## 7. Lectura metodológica

La intención de este flujo es que el dashboard no se vea solo como una capa visual, sino como el resultado de un proceso reproducible de:

- preparación de datos
- agregación estadística
- validación básica
- estandarización territorial
