# Catalogo de fuentes de datos

Todas las fuentes son **oficiales y verificables**. Nada esta fabricado ni
alterado en su origen. Las transformaciones (joins, agregaciones, derivaciones,
imputaciones, estandarizaciones) se realizan en `scripts/` y se documentan en
los notebooks correspondientes.

## Estatales

| Variable | Fuente | Anio | Archivo |
|---|---|---|---|
| Pobreza, carencias, ingreso, rezago educativo (estatal) | CONEVAL — Anexo estadistico de pobreza | 2022 | `data/raw/Anexo estadístico entidades 2022.xlsx` |
| PIB estatal | INEGI — Banco de Indicadores | 2024 | `data/raw/PIBE_2.xlsx` |
| Teledensidad e indicadores de internet movil | IFT — Banco de informacion estadistica | 2019-2024 | `data/raw/TD_*.csv` |
| ENDUTIH (uso digital, hogares y usuarios) | INEGI — ENDUTIH | 2024 | `data/raw/tr_endutih_*.csv` y `data/raw/tic_2024_*.DBF` |
| ENOE (empleo trimestral) | INEGI — ENOE | 2025-T4 | `data/raw/conjunto_de_datos_sdem_enoe_2025_4t.csv` |
| Inversion Extranjera Directa | Secretaria de Economia | 2010-2024 | `data/raw/ied_entidad_pais_de_origen.csv` |

## Municipales

| Variable | Fuente | Anio | Archivo |
|---|---|---|---|
| Indice de Rezago Social (IRS) y sus componentes | CONEVAL | 2020 | `data/raw/IRS_entidades_mpios_2020.xlsx` |
| Indicadores demograficos (edad, dependencia, RHM) | CONAPO — Proyecciones demograficas | 1990-2050 | `data/raw/pobproy_inddemo.csv` |
| Censo de poblacion (educacion, vivienda, demografia) | INEGI — Censo 2020 / ITER | 2020 | `data/raw/conjunto_de_datos_iter_00CSV20.csv` |

## Localidad

| Variable | Fuente | Anio | Archivo |
|---|---|---|---|
| Tipo de conectividad (movil, internet, CFE) y generaciones (2G/3G/4G/5G garantizadas) | INEGI / IFT | 2022 | `data/raw/loc_tipo_conectividad.csv` |
| Localidades con coordenadas y grado de marginacion | CONAPO + INEGI | 2020 | `data/raw/localidades_conectividad.csv` |
| Suscripciones por tecnologia | IFT | 2022 | `data/raw/tec_conectividad.csv` |

## Procesados (derivados de los anteriores)

| Archivo | Descripcion |
|---|---|
| `data/processed/endutih_2024_state_dashboard.wide.json` | KPIs estatales ENDUTIH + cobertura listos para el dashboard. |
| `data/processed/context_variables_state_dashboard.wide.json` | Variables de contexto estatales (CONEVAL/PIB/Demografia). |
| `data/processed/cobertura_red_por_municipio_2025.json` | Indicador de velocidad y cobertura tecnologica por municipio (Ookla 2025). |
| `data/processed/cobertura_red_por_estado_2025.json` | Mismo agregado a estado. |

## Geometrias

Ver `public/data/geo/SOURCES.md`.

## Disclaimer metodologico

- Las distintas fuentes corresponden a anios diferentes (2020-2025). El analisis
  se realiza como **retrato transversal aproximado**, no como panel longitudinal,
  y asi se documenta en el reporte.
- Las variables que requieren imputacion por faltantes se marcan con bandera
  `source_type` = `imputed` y se documentan en el notebook de calidad.
- Cualquier dato sintetico (escenarios contrafactuales, datos para pruebas
  de pipeline) se marca con `source_type` = `synthetic` y NUNCA se atribuye
  a una fuente oficial.
