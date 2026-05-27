"""
Análisis de Conectividad Digital y Prospectiva Tecnológica
Este script consolida la limpieza de datos, modelos de series de tiempo, 
regresión múltiple y curvas de adopción en un flujo estructurado.
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import pmdarima as pm
from statsmodels.tsa.holtwinters import Holt
import statsmodels.api as sm
from scipy.optimize import curve_fit
import warnings
import sys
import codecs

sys.stdout.reconfigure(encoding='utf-8')

# Apagar alertas técnicas para una consola más limpia
warnings.filterwarnings("ignore")

# ==========================================
# 1. PREPARACIÓN DE DATOS
# ==========================================
def cargar_y_limpiar_datos(ruta_archivo, estado_buscado):
    print(f"\n[{estado_buscado}] -> Iniciando extracción y limpieza de datos...")
    df = pd.read_csv(ruta_archivo, encoding='latin1')
    
    col_estado = df.columns[0]
    col_anio = df.columns[1]
    col_valor = df.columns[2]
    col_educacion = df.columns[3]
    col_gobierno = df.columns[4]
    
    df_estado = df[df[col_estado] == estado_buscado].sort_values(by=col_anio, ascending=True)
    
    df_limpio = df_estado.dropna(subset=[col_valor, col_anio, col_educacion, col_gobierno])
    
    return df_limpio, col_anio, col_valor, col_educacion, col_gobierno


# ==========================================
# 2. MODELOS DE SERIES DE TIEMPO
# ==========================================
def modelo_auto_arima(df, col_anio, col_valor, estado, pasos_futuro=1):
    print(f"\n--- Ejecutando Auto-ARIMA para {estado} ---")
    serie_tiempo = df[col_valor].values
    anios = df[col_anio].values
    ultimo_anio = int(anios[-1])
    
    # parametros
    modelo_auto = pm.auto_arima(
        serie_tiempo, start_p=0, max_p=3, start_q=0, max_q=3,
        d=None, test='adf', seasonal=False, trace=False, 
        error_action='ignore', suppress_warnings=True, stepwise=True
    )
    
    predicciones, intervalos = modelo_auto.predict(n_periods=pasos_futuro, return_conf_int=True)
    anios_futuros = np.arange(ultimo_anio + 1, ultimo_anio + 1 + pasos_futuro)
    
    # grap
    plt.figure(figsize=(10, 5))
    plt.plot(anios, serie_tiempo, marker='o', color='orange', linewidth=2, label='Histórico')
    plt.plot(anios_futuros, predicciones, marker='s', color='red', linestyle='--', linewidth=2, label='Auto-ARIMA')
    plt.fill_between(anios_futuros, intervalos[:, 0], intervalos[:, 1], color='red', alpha=0.1, label='Intervalo Confianza (95%)')
    
    plt.title(f'Pronóstico Estadístico (Auto-ARIMA) - {estado}')
    plt.xlabel('Año')
    plt.ylabel('% de Penetración')
    plt.legend()
    plt.grid(True, linestyle='--')
    plt.xticks(np.concatenate((anios, anios_futuros)).astype(int))
    plt.tight_layout()
    plt.show()

def modelo_holt(df, col_anio, col_valor, estado, pasos_futuro=1):
    print(f"\n--- Ejecutando Holt (Amortiguado) para {estado} ---")
    serie_tiempo = df[col_valor].values
    anios = df[col_anio].values
    ultimo_anio = int(anios[-1])
    
    modelo = Holt(serie_tiempo, initialization_method="estimated", damped_trend=True).fit()
    predicciones = modelo.forecast(pasos_futuro)
    anios_futuros = np.arange(ultimo_anio + 1, ultimo_anio + 1 + pasos_futuro)
    
    # grap
    plt.figure(figsize=(10, 5))
    plt.plot(anios, serie_tiempo, marker='o', color='orange', linewidth=2, label='Histórico')
    plt.plot(anios_futuros, predicciones, marker='s', color='purple', linestyle='--', linewidth=2, label='Holt (Amortiguado)')
    
    plt.title(f'Pronóstico de Suavizado Exponencial (Holt) - {estado}')
    plt.xlabel('Año')
    plt.ylabel('% de Penetración')
    plt.legend()
    plt.grid(True, linestyle='--')
    plt.xticks(np.concatenate((anios, anios_futuros)).astype(int))
    plt.tight_layout()
    plt.show()


# ==========================================
# 3. ANÁLISIS CAUSAL (REGRESIÓN MÚLTIPLE)
# ==========================================
def modelo_regresion_multiple(df, col_anio, col_valor, col_educacion, col_gobierno, estado):
    print(f"\n--- Ejecutando Regresión Lineal Múltiple para {estado} ---")
    Y = df[col_valor]
    X = df[[col_anio, col_educacion, col_gobierno]]
    X_const = sm.add_constant(X) # OLS
    
    modelo_rlm = sm.OLS(Y, X_const).fit()
    print(modelo_rlm.summary()) # tabla
    
    # 
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))
    
    # grap 1 presicion
    ax1.scatter(Y, modelo_rlm.fittedvalues, color='blue', s=100, edgecolor='white', zorder=3)
    min_val = min(Y.min(), modelo_rlm.fittedvalues.min()) - 2
    max_val = max(Y.max(), modelo_rlm.fittedvalues.max()) + 2
    ax1.plot([min_val, max_val], [min_val, max_val], color='red', linestyle='--', linewidth=2, label='Precisión Perfecta', zorder=2)
    ax1.set_title('Precisión del Modelo (Real vs Estimado)')
    ax1.set_xlabel('Penetración Real (%)')
    ax1.set_ylabel('Cálculo del Modelo (%)')
    ax1.legend()
    ax1.grid(True, linestyle='--', alpha=0.7)
    
    # grap 2 motor
    ax2.scatter(df[col_educacion], Y, color='green', s=100, edgecolor='white', zorder=3)
    z = np.polyfit(df[col_educacion], Y, 1)
    p = np.poly1d(z)
    ax2.plot(df[col_educacion], p(df[col_educacion]), color='orange', linestyle='-', linewidth=2, zorder=2)
    ax2.set_title('Impacto de la Educación en la Conectividad')
    ax2.set_xlabel('Uso de internet para Educación (%)')
    ax2.set_ylabel('Penetración en Hogares (%)')
    ax2.grid(True, linestyle='--', alpha=0.7)
    
    plt.tight_layout()
    plt.show()


# ==========================================
# 4. CICLO DE VIDA (CURVA LOGÍSTICA S)
# ==========================================
def ecuacion_logistica(x, L, k, x0):
    return L / (1 + np.exp(-k * (x - x0))) 

def modelo_curva_s_integrada(df, col_anio, col_valor, estado, pasos_futuro=1):
    print(f"\n--- Análisis de Curva S y Brecha de Mercado: {estado} ---")
    anios = df[col_anio].values
    serie_tiempo = df[col_valor].values
    anio_inicio = anios[0]
    
    x_data = anios - anio_inicio
    y_data = serie_tiempo
    
    p0 = [100, 0.5, len(anios)/2] 
    limites = ([max(y_data), 0, 0], [100, 2, 20])
    
    parametros_optimos, _ = curve_fit(ecuacion_logistica, x_data, y_data, p0=p0, bounds=limites)
    L_opt, k_opt, x0_opt = parametros_optimos
    
    anios_proyeccion = np.arange(anios[0], anios[-1] + pasos_futuro + 1)
    x_proyeccion = anios_proyeccion - anio_inicio
    y_proyeccion = ecuacion_logistica(x_proyeccion, L_opt, k_opt, x0_opt)
    
    plt.figure(figsize=(12, 7))
    plt.fill_between(anios_proyeccion, 0, y_proyeccion, color='#3498db', alpha=0.3, label='Mercado Conquistado (Adopción)')
    plt.fill_between(anios_proyeccion, y_proyeccion, L_opt, color='#e74c3c', alpha=0.3, label='Brecha Restante (Mercado Potencial)')
    plt.plot(anios_proyeccion, y_proyeccion, '-', color='#2980b9', linewidth=3, zorder=3)
    plt.plot(anios, serie_tiempo, 'o', color='orange', markersize=8, markeredgecolor='black', zorder=4, label='Histórico Real')
    plt.axhline(y=L_opt, color='black', linestyle='--', linewidth=2, alpha=0.8, zorder=2, label=f'Techo Máximo Calculado ({L_opt:.1f}%)')
    
    plt.title(f'Ciclo de Adopción Unificado y Brecha de Mercado en {estado}', fontsize=14, pad=15)
    plt.xlabel('Año', fontsize=12)
    plt.ylabel('% de Penetración de Internet', fontsize=12)
    plt.legend(loc='lower right', framealpha=0.9)
    plt.grid(True, linestyle='--', alpha=0.5)
    plt.xticks(anios_proyeccion, rotation=45)
    
    plt.ylim(0, L_opt + 5)
    plt.tight_layout()
    plt.show()
    
    ultimo_anio_real = anios[-1]
    penetracion_actual = y_data[-1]
    anio_inflexion = int(anio_inicio + x0_opt)
    brecha_actual = L_opt - penetracion_actual
    
    estado_inflexion = "ya superó" if anios[-1] >= anio_inflexion else "aún no alcanza"
    
    if k_opt > 0.6:
        velocidad = "Acelerada (Crecimiento explosivo en cortos periodos)"
    elif k_opt > 0.3:
        velocidad = "Moderada (Crecimiento constante y estable)"
    else:
        velocidad = "Lenta (Adopción paulatina prolongada)"

    print("\n" + "="*50)
    print(" INSIGHTS DE CONECTIVIDAD")
    print("="*50)
    
    print("\n  ESTADO ACTUAL Y SATURACIÓN:")
    print(f"- Al cierre de {ultimo_anio_real}, {estado} registró una penetración real del {penetracion_actual:.1f}%.")
    print(f"- El modelo logístico estima que, bajo las condiciones actuales, el techo natural de adopción (saturación) se estabilizará cerca del {L_opt:.1f}%.")
    
    print("\n  BRECHA DIGITAL RESTANTE:")
    print(f"- Existe una brecha de mercado del {brecha_actual:.1f}% entre la penetración actual y el máximo proyectado.")
    print(f"- Para el año proyectado ({anios_proyeccion[-1]}), se espera que la penetración alcance un {y_proyeccion[-1]:.1f}%, reduciendo la brecha a {(L_opt - y_proyeccion[-1]):.1f}%.")
    
    print("\n  DINÁMICA DE ADOPCIÓN:")
    print(f"- Ritmo de adopción histórico: {velocidad}.")
    print(f"- Punto de inflexión: El modelo identifica el año {anio_inflexion} como el momento de mayor aceleración en la incorporación de usuarios.")
    print(f"- Fase del ciclo: El estado {estado_inflexion} su fase de adopción más agresiva y se encamina hacia la {'saturación' if anios[-1] >= anio_inflexion else 'masificación'}.")
    print("="*50 + "\n")
    

# ==========================================
# 5. EJECUCIÓN PRINCIPAL (MAIN)
# ==========================================
if __name__ == "__main__":
    
    # --- CONFIGURACIÓN DE PARÁMETROS ---
    RUTA_ARCHIVO = '../Huawei-Final-project/data/processed/BD_const.csv'
    ESTADO_ANALISIS = 'Sonora'  #estados
    
    # 1. Cargamos datos
    df_analisis, c_anio, c_valor, c_edu, c_gob = cargar_y_limpiar_datos(RUTA_ARCHIVO, ESTADO_ANALISIS)
    
    # 2. Despliegue de Modelos (Puedes comentar/descomentar los que quieras ejecutar)
    
    modelo_auto_arima(df_analisis, c_anio, c_valor, ESTADO_ANALISIS, pasos_futuro=1)
    modelo_holt(df_analisis, c_anio, c_valor, ESTADO_ANALISIS, pasos_futuro=1)
    modelo_regresion_multiple(df_analisis, c_anio, c_valor, c_edu, c_gob, ESTADO_ANALISIS)
    modelo_curva_s_integrada(df_analisis, c_anio, c_valor, ESTADO_ANALISIS, pasos_futuro=1)