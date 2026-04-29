# Guía para la exposición — Dashboard territorial y brecha digital (México)

Documento para **presentar el proyecto con claridad**: qué problema atiende, qué datos usan, qué métodos de ciencia de datos aplican, cómo correr la demo y cómo usar **Git LFS** al subir el repo.

---

## 1. Elevator pitch (30 segundos)

Este proyecto es un **dashboard web** que permite comparar **estados** y **municipios** de México en **conectividad móvil** (3G/4G/5G) y en **educación y rezago social**, usando **fuentes oficiales** (principalmente INEGI y CONEVAL).  
La capa de **ciencia de datos** incluye: construcción de un **dataset maestro municipal**, **estandarización** de variables, **clustering** (`KMeans` con elección de \(k\) por **silhouette**), **Gini** y **Theil L** ponderados por población, y correlación **Spearman** entre escolaridad y cobertura — siempre como análisis **descriptivo y asociativo**, **no causal**.

---

## 2. Pregunta guía (objetivo del análisis)

> **¿Cómo se distribuye la cobertura móvil entre municipios mexicanos, qué tan desigual es esa distribución (dentro y entre estados), y qué perfiles socioeducativos acompañan esas brechas?**

Si te preguntan por **causalidad**, responde con honestidad: *con datos transversales y agregados territoriales no se identifican efectos causales; lo que sí mostramos son patrones, desigualdad y priorización.*

---

## 3. Fuentes de datos (verificables)

| Tema | Institución / producto | Referencia en el repo |
|------|------------------------|------------------------|
| Educación y población por municipio | INEGI — Censo de Población y Vivienda 2020 (ITER) | `data/raw/conjunto_de_datos_iter_00CSV20.csv` |
| Índice de rezago social y carencias municipales | CONEVAL — IRS 2020 | `data/raw/IRS_entidades_mpios_2020.xlsx` |
| Conectividad por localidad (3G/4G/5G, movil) | Conjunto de localidades (año 2024 en `ANIO`) | `data/raw/loc_tipo_conectividad.csv`, `data/raw/localidades_conectividad.csv` |
| Métricas Ookla agregadas | Salida procesada del proyecto | `data/processed/cobertura_red_por_municipio_2025.json` |
| Uso de TIC en hogares | INEGI — ENDUTIH 2024 | `data/raw/tr_endutih_*.csv` → `public/data/endutih_2024_state_dashboard.wide.json` |
| Contexto social estatal | CONEVAL, PIB, demografía | `data/processed/context_variables_state_dashboard.wide.json` |
| Mapas (polígonos) | GeoJSON derivado de capas compatibles con Marco Geoestadístico | `public/data/geo/*.geojson` |

Catálogo extendido: **`data/SOURCES.md`**.

---

## 4. El “dashboard” en dos capas

1. **Aplicación React + Vite**  
   Explora indicadores **estatales** (ENDUTIH, teledensidad, brechas de cobertura, etc.). Dataset típico: `public/data/endutih_2024_state_dashboard.wide.json`.

2. **Capa analítica municipal (pipeline Python)**  
   Genera:
   - **`public/data/municipios_master_analytics.json`** — una entrada por municipio: coberturas, educación, IRS, brechas `población − localidades`, `cluster_id`, etiqueta de cluster, z-scores, Ookla donde aplique.
   - **`public/data/state_analytics_dashboard.json`** — por estado: Gini y Theil sobre cobertura 4G (poblacional), percentiles, Spearman, conteo de municipios con Ookla, etc.  
   Ideal para **texto dinámico** (merge fields) al lado del mapa.

En la expo: *“El front ya consume datos estatales; la salida municipal está reproducible con un comando y lista para enchufarse al UI.”*

---

## 5. Pipeline paso a paso (qué cuentas si preguntan por “la mate”)

**Comando:** `npm run data:build:analytics`  
o: `.venv-pipeline/bin/python scripts/build_municipal_analytics.py`  
**Dependencias:** `requirements-pipeline.txt` (crear venv recomendado).

| Paso | Acción | Por qué cuenta como ciencia de datos |
|------|--------|--------------------------------------|
| 1 | **Maestro municipal**: join por `cvegeo` (ITER + IRS + agregación de localidades 2024 + Ookla). | Base **territorial fina** y trazable. |
| 2 | **Features**: % educación, brechas 3G/4G, edades, índice IRS. | Variables **interpretables**. |
| 3 | **Estandarización**: `StandardScaler` solo para las columnas del clustering. | Comparabilidad de escales en **KMeans**. |
| 4 | **Clustering**: `KMeans`, \(k \in [2,7]\), se elige \(k\) por **silhouette** máximo. | **Tipologías** (perfiles), no solo ranking. |
| 5 | **Desigualdad**: **Gini** y **Theil L** **ponderados por población municipal** sobre cobertura 4G (y 3G de referencia). | Medidas clásicas de **dispersión** territorial. |
| 6 | **Asociación**: **Spearman** entre `graproes` y cobertura 4G (nacional y por estado). | Relación **monótona** sin asumir linealidad fuerte. |
| 7 | **Salida**: CSV + JSON en `data/processed/` y copia en `public/data/`. | Reproducible y lista para el front. |

Detalle técnico y troubleshooting (“si se traba”): **`docs/PIPELINE_ANALYTICS.md`**.

---

## 6. Demo en vivo (checklist)

1. `npm install`  
2. `python3 -m venv .venv-pipeline && .venv-pipeline/bin/pip install -r requirements-pipeline.txt`  
3. `npm run data:build:analytics`  
4. `npm run dev`  
5. Mostrar en el navegador el dashboard; en paralelo abrir `state_analytics_dashboard.json` y señalar **Gini nacional**, **silhouette**, **Spearman**.  
6. Opcional: una fila de `municipios_master_analytics.json` con `cluster_label` y `brecha_4g_pp`.

**Cierre sugerido:** *“Integramos fuentes oficiales, cuantificamos desigualdad y perfiles territoriales; el dashboard comunica prioridades. El análisis es asociativo y con límites temporales explícitos.”*

---

## 7. Limitaciones (decir una verdad, suma credibilidad)

- **Temporal**: se mezclan años (p. ej. Censo/IRS 2020, conectividad 2024, Ookla 2025) → retrato **transversal aproximado**, no panel.  
- **Construcción**: cobertura por localidad no equivale a experiencia de usuario, ni precio, ni calidad percibida.  
- **Ookla**: no todos los municipios tienen medición → campo `ookla_cubierto`.  
- **Clustering**: **KMeans** no es modelo espacial explícito; los grupos son **perfiles multivariados**, no necesariamente regiones contiguas.

---

## 8. Git LFS — subir archivos grandes al remoto sin romper el push

Algunos artefactos son **de varios MB** (maestro municipal JSON, CSV, GeoJSON municipal). Para que **GitHub** (u otro host con LFS) los maneje bien, el repo define patrones en **`.gitattributes`**.

### Primera vez en tu computadora

```bash
git lfs install
```

### En este repo, antes del primer commit que incluya esos archivos

```bash
git add .gitattributes
git add data/processed/municipios_master_analytics.json
git add data/processed/municipios_master_analytics.csv
git add public/data/municipios_master_analytics.json
git add public/data/geo/mexico_municipios.geojson
git add README-EXPOSICION.md README.md docs/ scripts/build_municipal_analytics.py requirements-pipeline.txt package.json
# … resto de cambios
git commit -m "docs: guía de exposición; Git LFS para maestro municipal y geo"
git push
```

### Si clonas el repo en otra máquina

```bash
git clone <url>
cd Huawei-Final-project
git lfs install
git lfs pull
```

### Si GitHub rechaza el push por tamaño

- Confirma que **Git LFS** está instalado (`git lfs version`).  
- Asegúrate de que **`.gitattributes` esté commiteado antes** o **en el mismo commit** que los archivos grandes.  
- Si accidentalmente ya subiste un blob enorme **sin** LFS, hace falta migrar con `git lfs migrate import` (mejor hacerlo una vez con cuidado); si los archivos aún **no** están en `main`, basta con corregir y volver a commitear.

---

## 9. Archivos clave para la expo

```text
README-EXPOSICION.md          ← esta guía
README.md                     ← índice del proyecto + LFS
docs/PIPELINE_ANALYTICS.md    ← pipeline detallado
data/SOURCES.md               ← catálogo de fuentes
scripts/build_municipal_analytics.py
requirements-pipeline.txt
public/data/state_analytics_dashboard.json
public/data/municipios_master_analytics.json   (LFS)
public/data/geo/
```

---

## 10. Referencias metodológicas breves

Desigualdad: coeficiente de **Gini**, índice **Theil** (L).  
Agrupamiento: **KMeans**, **coeficiente de silueta**.  
Asociación: correlación de **Spearman**.  
Fuentes: **INEGI**, **CONEVAL**; **Ookla** donde se indique en procesados.

---

*Éxito en la expo: problema → datos → método → demo → una limitación honesta.*
