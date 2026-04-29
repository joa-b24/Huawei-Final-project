# Geometrias para el dashboard

Capas geograficas usadas por el dashboard interactivo. Las geometrias provienen
de proyectos publicos de codigo abierto que envuelven el Marco Geoestadistico
de INEGI; **los datos numericos del dashboard nunca provienen de aqui**, solo
las formas vectoriales.

## Archivos

### `mexico_states.geojson`

- **Origen**: https://github.com/strotgen/mexico-leaflet (`states.geojson`).
- **Atribucion**: Marco Geoestadistico, INEGI.
- **Features**: 32 entidades federativas.
- **Propiedades**:
  - `cve_ent` (string, 2 digitos con cero padding) — clave INEGI de entidad.
  - `nom_ent` (string) — nombre normalizado (Distrito Federal => Ciudad de Mexico).
- **Tamano**: ~310 KB.

### `mexico_municipios.geojson`

- **Origen**: https://github.com/strotgen/mexico-leaflet (`municipalities.geojson`).
- **Atribucion**: Marco Geoestadistico, INEGI.
- **Features**: 2,436 municipios. Mexico tiene ~2,471 municipios oficiales,
  por lo que ~35 municipios creados despues del corte del archivo no estan
  representados en el mapa. Para los KPIs numericos NO se usa esta capa,
  asi que esto solo afecta visualizacion.
- **Propiedades**:
  - `cvegeo` (string, 5 digitos con cero padding) — clave INEGI municipal completa.
  - `cve_ent` (string, 2 digitos con cero padding).
  - `cve_mun` (string, 3 digitos con cero padding).
  - `nom_mun` (string).
- **Tamano**: ~2.5 MB.

## Notas tecnicas

- Las claves `cve_ent` y `cvegeo` ya estan listas para join contra datasets
  de INEGI / CONEVAL / CONAPO (ITER, IRS, pobproy, loc_tipo_conectividad).
- Los nombres de entidad fueron normalizados al esquema de INEGI moderno.
- Si en el futuro se requiere una capa oficial completa con los 2,471
  municipios actualizados, descargar el Marco Geoestadistico oficial:
  https://www.inegi.org.mx/temas/mg/

## Fecha de descarga

2026-04-29.
