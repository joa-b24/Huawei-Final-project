# Reporte de calidad y transformacion de datos

Actualizado: 2026-04-19

## Resumen

- archivos crudos perfilados: 5
- registros en formato largo: 704
- entidades en formato ancho: 32
- metricas en catalogo: 22

## Logica de transformacion

- estimador ENDUTIH: porcentaje = (sumatoria de FAC_PER para respuestas positivas / sumatoria total de FAC_PER por entidad) * 100
- estimador territorial: porcentaje = (sumatoria ponderada por poblacion, hogares o localidades con condicion positiva / sumatoria total del denominador por entidad) * 100

Pasos principales:
- se filtran registros sin CVE_ENT o sin FAC_PER en ENDUTIH
- se normaliza la clave estatal con dos digitos para el cruce con el maestro de estados
- se filtran los datos de brecha digital al anio 2024
- se integran solo entidades con catalogo maestro valido
- se redondean indicadores finales a dos decimales

## Validaciones

- state_coverage: passed | El dataset ancho contiene 32 entidades.
- metric_coverage: passed | Metricas con cobertura incompleta: ninguna.
- expected_long_records: passed | Registros largos observados: 704. Esperados: 704.
- duplicate_state_variable_pairs: passed | Pares entidad-variable duplicados: 0.
- percentage_ranges: passed | Registros porcentuales fuera de rango: 0.
- null_metric_values: passed | No se detectaron valores nulos en el dataset ancho.

## Perfil de metricas

- personas_usuarias_computadora_pct: min 23.5, max 52.76, media 36.53, desv_est 6.28
- personas_usuarias_internet_pct: min 64.92, max 91.34, media 83.71, desv_est 5.66
- personas_conexion_internet_movil_pct: min 33.3, max 67.11, media 50.15, desv_est 7.79
- personas_usan_redes_sociales_pct: min 57.44, max 86.45, media 75.87, desv_est 5.9
- personas_compras_internet_pct: min 14.85, max 40.01, media 30.78, desv_est 6.73
- personas_pagos_internet_pct: min 13.64, max 39.68, media 27.89, desv_est 6.44
- personas_banca_electronica_pct: min 4.5, max 29.2, media 14.62, desv_est 6.39
- personas_con_celular_pct: min 63.09, max 92.24, media 83.53, desv_est 5.89
- personas_usuarias_celular_pct: min 73.17, max 93.08, media 87.37, desv_est 4.11
- personas_con_smartphone_pct: min 68.04, max 91.05, media 84.42, desv_est 4.57
- personas_conexion_datos_celular_pct: min 46.84, max 81.24, media 66.25, desv_est 7.09
- personas_usan_apps_redes_sociales_pct: min 47.01, max 77.88, media 64.55, desv_est 6.18
- personas_usan_banca_movil_pct: min 15.52, max 40.84, media 27.77, desv_est 6.89
- teledensidad_internet_movil: min 70.0, max 128.0, media 103.66, desv_est 11.77
- localidades_con_cobertura_movil_pct: min 51.83, max 99.83, media 86.85, desv_est 11.89
- poblacion_en_localidades_con_cobertura_movil_pct: min 91.97, max 100.0, media 97.9, desv_est 2.4
- localidades_con_4g_garantizada_pct: min 42.46, max 98.61, media 79.64, desv_est 14.91
- poblacion_en_localidades_con_4g_garantizada_pct: min 89.89, max 100.0, media 96.85, desv_est 3.08
- localidades_con_5g_garantizada_pct: min 0.07, max 14.44, media 4.94, desv_est 3.49
- poblacion_en_localidades_con_5g_garantizada_pct: min 19.95, max 92.84, media 55.89, desv_est 20.77
- hogares_en_localidades_con_internet_pct: min 56.2, max 99.9, media 84.92, desv_est 11.95
- poblacion_en_localidades_con_internet_pct: min 53.35, max 99.88, media 83.8, desv_est 12.61

## Fuentes integradas

- BIT brechas digitales 2024: 256 registros
- IFT TD_TELEDENSIDAD_INTMOVIL_ITE_VA: 32 registros
- INEGI ENDUTIH 2024: 416 registros
