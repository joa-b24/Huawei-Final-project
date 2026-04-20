# Huawei Territorial Dashboard

Aplicación local para explorar variables territoriales de México con foco en análisis comparativo por entidad.  
La base actual combina indicadores procesados de ENDUTIH 2024 y una primera capa de servicio móvil.

## Qué contiene 

- una aplicación web local en `React + Vite`
- un flujo de datos con archivos crudos, catálogos y salidas procesadas
- indicadores estatales de ENDUTIH 2024
- una variable estatal adicional de teledensidad de internet móvil

## Estructura general

```text
.
|-- README.md
|-- package.json
|-- scripts/
|   `-- build_endutih_2024.py
|-- data/
|   |-- raw/
|   |   |-- tr_endutih_usuarios_anual_2024.csv
|   |   |-- tr_endutih_usuarios2_anual_2024.csv
|   |   |-- TD_TELEDENSIDAD_INTMOVIL_ITE_VA.csv
|   |   |-- diccionarios
|   |   `-- metadatos
|   |-- catalogs/
|   |   |-- states.master.json
|   |   `-- variables.catalog.json
|   `-- processed/
|       |-- endutih_2024_state_observations.long.json
|       |-- endutih_2024_state_observations.long.csv
|       `-- endutih_2024_state_dashboard.wide.json
|-- public/
|   `-- data/
|       `-- endutih_2024_state_dashboard.wide.json
`-- src/
    |-- app/
    |-- components/
    |-- data/
    |-- styles/
    |-- types/
    `-- utils/
```

## Cómo está organizada la data

### `data/raw`

Aquí van los archivos originales.  
No se editan manualmente.

Ejemplos:
- microdatos `ENDUTIH`
- diccionarios de variables
- metadatos
- archivos externos de servicio móvil como los `TD_*`

### `data/catalogs`

Aquí están los catálogos que ordenan el proyecto:

- `states.master.json`
  - catálogo maestro de entidades
  - incluye `state_code`, `cve_ent`, nombre normalizado y región

- `variables.catalog.json`
  - catálogo de variables analíticas
  - define nombre, categoría, unidad y fuente sugerida

### `data/processed`

Aquí quedan las salidas generadas por los scripts.

- `endutih_2024_state_observations.long.json`
  - formato largo
  - una fila por entidad y variable

- `endutih_2024_state_observations.long.csv`
  - misma información en CSV

- `endutih_2024_state_dashboard.wide.json`
  - formato ancho
  - una fila por entidad con las métricas agrupadas
  - este archivo es el que usa el frontend

### `public/data`

Contiene la copia pública del dataset que consume la UI.  
La idea es que `src` no lea directamente desde `data/processed`, sino desde esta carpeta.

## Flujo de trabajo

El flujo actual es simple:

1. se colocan archivos fuente en `data/raw`
2. el script `scripts/build_endutih_2024.py` los transforma
3. las salidas se guardan en `data/processed`
4. el dataset ancho se publica en `public/data`
5. el frontend carga ese JSON y construye los dashboards

## Variables que ya están integradas

Hoy el proyecto ya trae variables reales como:

- personas usuarias de internet
- personas usuarias de computadora
- personas con celular
- personas con smartphone
- personas que usan banca electrónica
- personas que realizan compras por internet
- personas que realizan pagos por internet
- personas que usan apps de banca móvil
- teledensidad de internet móvil

## Cómo correrlo

Instalar dependencias:

```bash
npm install
```

Regenerar los datos procesados:

```bash
npm run data:build:endutih
```

Levantar la aplicación:

```bash
npm run dev
```

Build de validación:

```bash
npm run build
```

## Nota de trabajo

Si entra una fuente nueva, la regla es:

- guardar el archivo original en `data/raw`
- documentar o mapear la variable en `variables.catalog.json`
- transformar con script
- publicar solo la salida procesada que realmente usa la UI
