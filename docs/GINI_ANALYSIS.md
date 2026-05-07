# Coeficiente de Gini y curva de Lorenz en este proyecto

## Qué mide el Gini aquí

Cuantificamos qué tan **desigual** está repartida la **cobertura 4G poblacional** (`pob_pct_4g_garantizada`) entre los **municipios** de una entidad, **ponderando cada municipio por su población** (`pobtot_iter`). Valores cercanos a 0 indican un reparto más parejo; valores altos, mayor concentración.

## Cómo se calcula (alineado con el pipeline Python)

1. Se consideran solo municipios con población y cobertura válidas.
2. Se **ordenan** los municipios de menor a mayor cobertura.
3. Se construye la **curva de Lorenz**: en el eje horizontal va la fracción acumulada de población; en el vertical, la fracción acumulada de (cobertura × población) respecto al total estatal o nacional.
4. El **Gini** es \(1 - 2 \times\) el área bajo la curva de Lorenz (integral trapezoidal), igual que en `scripts/build_municipal_analytics.py` (`weighted_gini`).

En el dashboard, la curva se **recalcula en el navegador** para el estado seleccionado y debe coincidir con el valor guardado en `state_analytics_dashboard.json` (salvo redondeo mínimo).

## Cómo explicarlo en la exposición (frase corta)

> *“El Gini resume, con un solo número, qué tan desigual está la cobertura 4G entre municipios del estado, dando más peso a los municipios más poblados. La curva de Lorenz enseña lo mismo en forma gráfica.”*

## Relación con Spearman

**Gini** describe **una** variable (cobertura). **Spearman** cruza **dos** variables (por ejemplo escolaridad vs cobertura) en los municipios del estado: mide si, al subir una, la otra tiende a subir o bajar (monotonía), **sin** afirmar causalidad.

## Lectura honesta

Si el Gini nacional sobre cobertura 4G poblacional es **bajo**, puede deberse a que la variable está **casi saturada** (mucha población ya bajo 4G). Por eso conviene complementar con cobertura **territorial** (`loc_pct_4g`) o brechas `pob_pct − loc_pct`; el pipeline y los JSON ya incluyen esas columnas para análisis adicionales.
