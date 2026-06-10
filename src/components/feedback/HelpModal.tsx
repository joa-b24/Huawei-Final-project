import { useState } from "react";
import { createPortal } from "react-dom";
import {
  X, BookOpen, PlayCircle, BarChart2, Map, Network,
  ChevronDown, ChevronUp, Database, Layers,
  PanelLeft, Download, Compass, Terminal,
} from "lucide-react";

type Props = { onClose: () => void; currentContext?: string };

type Section = {
  id: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  content?: React.ReactNode;
};

// ─── Section components ───────────────────────────────────────────────────────

function NavegacionContent() {
  return (
    <div className="help-section-body">
      <p className="help-section-intro">
        La aplicación está organizada en <strong>seis pestañas</strong> accesibles desde la barra superior. El estado principal y las variables activas se mantienen sincronizados entre pestañas.
      </p>
      <ul className="help-section-list">
        <li>
          <strong>Diagnóstico</strong> — perfil comparativo del estado seleccionado: KPIs con delta respecto a la media nacional, radar de percentiles, histograma, mapa coroplético y ranking. Si la variable tiene datos municipales, se puede alternar a vista municipal con un botón.
        </li>
        <li>
          <strong>Impacto</strong> — análisis de asociaciones entre variables a nivel estatal: correlaciones Pearson/Spearman, diagrama de dispersión y regresión OLS multivariada.
        </li>
        <li>
          <strong>Evolución</strong> — series de tiempo históricas del estado seleccionado, tendencia lineal OLS, proyección Holt-Winters y comparativa con grupos de comparación o media nacional.
        </li>
        <li>
          <strong>Territorial</strong> — análisis intra-estatal a nivel municipio: curva de Lorenz con índice Gini, municipios extremos, dispersión municipal ponderada y correlaciones Spearman entre métricas municipales.
        </li>
        <li>
          <strong>Estructura</strong> — reducción dimensional (PCA) sobre el conjunto de variables: índice Digital-Territorial, biplot, cargas y grupos estructurales (clusters) k-means.
        </li>
        <li>
          <strong>Datos</strong> — catálogo de variables, importación de nuevas fuentes CSV, gestión de roles, metadatos y visibilidad de indicadores.
        </li>
      </ul>
      <p style={{ marginTop: 10, fontSize: 12, color: "var(--text-3)", lineHeight: 1.6 }}>
        Tip: el botón <strong>Imprimir / PDF</strong> en la barra superior genera un reporte del estado actual de todos los paneles visibles.
      </p>
    </div>
  );
}

function SidebarContent() {
  return (
    <div className="help-section-body">
      <p className="help-section-intro">
        El <strong>panel lateral izquierdo</strong> controla los parámetros globales de análisis que aplican a todas las pestañas simultáneamente.
      </p>
      <ul className="help-section-list">
        <li>
          <strong>Estado principal</strong> — selecciona el estado que se analiza en detalle. Afecta KPIs, radar, histograma, mapa, series de tiempo y análisis territorial. También puedes hacer clic directamente sobre un estado en el mapa coroplético para cambiarlo.
        </li>
        <li>
          <strong>Variables activas</strong> — marca o desmarca las variables que quieres analizar. Cada variable activada aparece en el sidebar con su nombre, categoría y unidad. El número máximo de variables activas simultáneas está limitado (por defecto 6–8) para mantener la legibilidad de los gráficos; si llegas al tope, desactiva alguna antes de activar otra.
        </li>
        <li>
          <strong>Filtro de búsqueda</strong> — escribe en el campo de búsqueda del sidebar para filtrar variables por nombre o categoría. Útil cuando el catálogo es extenso. El filtro no afecta las variables ya activas.
        </li>
        <li>
          <strong>Grupos de comparación</strong> — añade contexto comparativo al estado principal. Puedes activar: <em>Nacional</em> (media de todos los estados), una <em>región geográfica</em> (norte, centro, sur), un <em>grupo estructural</em> (cluster del análisis PCA) o un <em>estado específico</em>. Los grupos activos aparecen superpuestos en los gráficos de Diagnóstico, Impacto y Evolución con colores diferenciados.
        </li>
        <li>
          <strong>Grupos activos entre pestañas</strong> — los grupos configurados en el sidebar persisten al cambiar de pestaña. Así puedes configurarlos una vez y explorar su efecto en Diagnóstico (radar/histograma), Impacto (dispersión) y Evolución (series de tiempo) sin reconfigurarlo.
        </li>
      </ul>
    </div>
  );
}

function DiagnosticoContent() {
  return (
    <div className="help-section-body">
      <p className="help-section-intro">
        El tab <strong>Diagnóstico</strong> presenta el perfil de un estado frente al conjunto nacional en la variable seleccionada. Cada variable activa tiene su propio panel expandible.
      </p>
      <ul className="help-section-list">
        <li>
          <strong>KPIs</strong> — cada tarjeta muestra el valor actual del estado (y año), el delta respecto a la media nacional (verde = favorable, rojo = desfavorable) y el percentil de posición entre los 32 estados. El signo del delta respeta la polaridad de la variable: en variables como pobreza, estar por debajo de la media es positivo.
        </li>
        <li>
          <strong>Radar / Barras</strong> — escala de percentil 0–100 calculada sobre los 32 estados; percentil 100 = mayor ventaja relativa. Las variables de polaridad negativa (rezago, pobreza, carencia) están invertidas: percentil alto = buen desempeño. Cambia entre vista radar y barras con el selector en la esquina superior derecha del panel.
        </li>
        <li>
          <strong>Histograma y boxplot</strong> — distribución de los 32 estados en 10 intervalos de igual amplitud. La barra azul indica el rango donde cae el estado seleccionado. La caja cubre el 50 % central (Q₁–Q₃); los puntos naranjas más allá de los bigotes son atípicos (criterio IQR × 1.5). Pasa el cursor sobre las barras para ver el rango exacto y los estados en ese intervalo.
        </li>
        <li>
          <strong>Mapa coroplético</strong> — visualiza la distribución geográfica de la variable entre los 32 estados con una escala de color graduada. El estado principal se resalta con borde azul. Haz clic en cualquier estado del mapa para seleccionarlo como estado principal. El gradiente va de claro (valor bajo) a azul intenso (valor alto).
        </li>
        <li>
          <strong>Vista municipal</strong> — cuando la variable seleccionada tiene datos a nivel municipio, aparece el botón <strong>«Ver municipios →»</strong>. Al activarlo, el histograma, mapa y ranking cambian a escala municipal mostrando la distribución interna del estado: qué municipios están más y menos cubiertos. El mapa pasa de estatal a coroplético municipal. Usa <strong>«← Vista nacional»</strong> para volver.
        </li>
        <li>
          <strong>Ranking nacional</strong> — lista de todos los estados ordenada de mejor a peor según la polaridad de la variable. El percentil de posición del estado seleccionado aparece en la narrativa superior del panel.
        </li>
      </ul>
    </div>
  );
}

function ImpactoContent() {
  return (
    <div className="help-section-body">
      <p className="help-section-intro">
        El tab <strong>Impacto</strong> analiza las asociaciones entre variables a nivel estatal mediante correlaciones y regresión OLS.
      </p>
      <ul className="help-section-list">
        <li>
          <strong>Matriz de correlaciones</strong> — coeficiente de Pearson (lineal) y Spearman (rango). ≥ 0.7 = fuerte · 0.4–0.7 = moderada · 0.2–0.4 = débil · &lt; 0.2 = muy débil. Un valor negativo indica relación inversa. Haz clic en una celda para ver el diagrama de dispersión de ese par.
        </li>
        <li>
          <strong>Diagrama de dispersión</strong> — cada punto es un estado. La línea de tendencia es la recta OLS del par. El estado principal se resalta con un punto de color. Identifica outliers que se alejan de la nube: pueden indicar condiciones estructurales diferenciadas. Selecciona el par desde la matriz o desde los selectores de eje X/Y.
        </li>
        <li>
          <strong>Regresión OLS multivariada</strong> — permite incluir varias variables predictoras simultáneamente. La pendiente β indica el cambio esperado en Y por unidad de X, controlando las demás variables. R² es la proporción de varianza explicada: 1.0 = ajuste perfecto, 0 = sin poder explicativo.
        </li>
        <li>
          <strong>Correlación ≠ causalidad</strong> — dos variables pueden correlacionar por un factor común (p. ej. nivel de desarrollo general). Usa las correlaciones para generar hipótesis, no para inferir causalidad directa.
        </li>
        <li>
          <strong>Roles de variables</strong> — en el tab <em>Datos</em> puedes asignar roles a cada variable (objetivo, predictor, contexto). Las variables de contexto aparecen marcadas visualmente en los selectores para recordar que no son objetivos directos de política.
        </li>
      </ul>
    </div>
  );
}

function TerritorialContent() {
  return (
    <div className="help-section-body">
      <p className="help-section-intro">
        El tab <strong>Territorial</strong> examina la distribución interna de cobertura digital dentro del estado seleccionado, a nivel municipio.
      </p>
      <ul className="help-section-list">
        <li>
          <strong>Variable de análisis</strong> — usa el selector en la parte superior para cambiar la variable territorial activa. Solo aparecen las variables que tienen datos municipales disponibles para el estado seleccionado. El análisis completo (Lorenz, scatter, extremos) se recalcula al cambiar.
        </li>
        <li>
          <strong>Curva de Lorenz y coeficiente de Gini</strong> — el eje X acumula la población (o localidades) de municipios ordenados de menor a mayor cobertura; el eje Y acumula la cobertura. La diagonal de 45° representa igualdad perfecta; mayor brecha = mayor desigualdad interna. El Gini resume esa brecha: 0 = igualdad total, 1 = desigualdad máxima. Se incluye comparativa con el Gini nacional para la misma variable.
        </li>
        <li>
          <strong>Municipios extremos</strong> — tarjetas con los municipios de mayor y menor cobertura según la variable activa. Muestra el valor, nombre y peso (población o localidades, según el tipo de variable). Útil para identificar brechas concretas dentro del estado.
        </li>
        <li>
          <strong>Gráfico de dispersión municipal</strong> — cada punto es un municipio; el tamaño refleja la población (o número de localidades). Selecciona libremente las métricas en eje X para explorar relaciones entre escolaridad, rezago social, cobertura 4G u otras variables. El eje Y está fijado a la variable de análisis activa. La correlación Spearman entre los ejes se muestra automáticamente.
        </li>
        <li>
          <strong>Correlaciones Spearman entre métricas municipales</strong> — vector de correlaciones de la variable activa con el resto de indicadores municipales disponibles. Identifica qué factores socioeconómicos o de infraestructura se asocian más con la cobertura dentro del estado.
        </li>
      </ul>
    </div>
  );
}

function EstructuraContent() {
  return (
    <div className="help-section-body">
      <p className="help-section-intro">
        La vista <strong>Estructura</strong> reduce la dimensionalidad del conjunto de variables a componentes principales (PCA) y agrupa estados con perfiles similares mediante clustering.
      </p>
      <ul className="help-section-list">
        <li>
          <strong>Índice Digital-Territorial</strong> — puntuación compuesta derivada del primer componente principal (PC1), que concentra la mayor varianza del sistema. Un valor alto indica ventaja en el conjunto de indicadores; uno bajo, rezago relativo. No es un índice normativo: describe posición relativa, no metas absolutas.
        </li>
        <li>
          <strong>Espacio de componentes (biplot)</strong> — los ejes son PC1 y PC2. Cada punto es un estado. Los vectores de carga (loadings) muestran qué variables "jalan" en cada dirección: estados cercanos a un vector tienen valores altos en esa variable. La distancia entre estados refleja similitud multivariada.
        </li>
        <li>
          <strong>Cargas PC1</strong> — ranking de influencia de cada variable en el índice. Valores absolutos mayores = más influyentes. Azul = relación positiva (sube con el índice), rojo = relación inversa (rezago o carencia).
        </li>
        <li>
          <strong>Grupos estructurales (clusters)</strong> — formados por k-means sobre las puntuaciones de componentes principales. Los estados de un mismo cluster comparten perfil similar. Actívalos como grupo de comparación en el panel lateral para evaluar brechas entre pares estructuralmente parecidos.
        </li>
        <li>
          <strong>Varianza explicada</strong> — indica qué proporción de la información total captura cada componente. Si PC1 + PC2 explican ≥ 60 % de la varianza, el biplot es una representación fiel del espacio original.
        </li>
      </ul>
    </div>
  );
}

function EvolucionContent() {
  return (
    <div className="help-section-body">
      <p className="help-section-intro">
        El tab <strong>Evolución</strong> muestra cómo cambian las variables a lo largo del tiempo para el estado seleccionado, con proyecciones y comparativas históricas.
      </p>
      <ul className="help-section-list">
        <li>
          <strong>Series de tiempo</strong> — cada línea gris es un estado; la línea azul sólida es el estado principal. Si hay grupos de comparación activos en el sidebar, sus estados aparecen en colores diferenciados. El eje X es el año; el eje Y, el valor de la variable. Si un estado no tiene dato en un año, la línea se interrumpe.
        </li>
        <li>
          <strong>Tendencia OLS</strong> — línea azul punteada superpuesta al estado principal. Representa la regresión lineal sobre el período histórico completo. La pendiente (pp/año) indica la velocidad de cambio promedio; R² indica qué tan lineal es esa trayectoria.
        </li>
        <li>
          <strong>Proyección Holt-Winters</strong> — puntos morados a la derecha del último dato histórico. Estimación del valor en los años siguientes extrapolando la tendencia reciente con suavizado exponencial. No es una predicción normativa.
        </li>
        <li>
          <strong>KPIs de serie</strong> — último valor disponible, variación acumulada desde el primer año de la serie y pendiente OLS con R². Aparecen sobre el gráfico cuando hay datos del estado principal.
        </li>
        <li>
          <strong>Velocidad de cambio por estado</strong> — panel inferior con ranking de pendiente OLS para todos los estados: verde = crecimiento positivo, rojo = tendencia a la baja, azul = estado principal.
        </li>
        <li>
          <strong>Datos históricos</strong> — solo aparecen variables con badge <strong>HIST</strong> en el sidebar. Para añadir series históricas ve al tab <em>Datos</em> e importa un CSV con columna <code>año</code>.
        </li>
      </ul>
    </div>
  );
}

function DatosContent() {
  return (
    <div className="help-section-body">
      <p className="help-section-intro">
        El tab <strong>Datos</strong> gestiona el catálogo de variables, permite importar nuevas fuentes y configura metadatos y roles de cada indicador.
      </p>
      <ul className="help-section-list">
        <li>
          <strong>Importar variables</strong> — sube un CSV con columna <code>estado</code> y una o más columnas de variables numéricas. El sistema detecta los nombres, los agrega al catálogo y los hace disponibles en el sidebar. Los datos se almacenan en el navegador.
        </li>
        <li>
          <strong>Datos históricos</strong> — para series de tiempo, el CSV debe incluir columna <code>año</code> (o <code>year</code>). El tab Evolución mostrará la nueva variable automáticamente con badge <strong>HIST</strong>.
        </li>
        <li>
          <strong>Roles de variables</strong> — cada variable puede tener rol <em>objetivo</em>, <em>predictor</em> o <em>contexto</em>. Las de contexto (ctx) son útiles como explicativas en correlaciones/regresiones pero se distinguen visualmente para recordar que no son metas de política. Asigna o modifica roles desde la tabla del catálogo.
        </li>
        <li>
          <strong>Metadatos</strong> — etiqueta, unidad, categoría y polaridad (si un valor mayor es favorable o desfavorable). La polaridad determina el color de deltas en KPIs y la orientación del ranking en Diagnóstico.
        </li>
        <li>
          <strong>Visibilidad</strong> — oculta variables que no son relevantes sin eliminarlas del catálogo. Las variables ocultas no aparecen en el selector del sidebar. Puedes restaurarlas en cualquier momento desde esta vista.
        </li>
      </ul>
    </div>
  );
}

function ExtrasContent() {
  return (
    <div className="help-section-body">
      <p className="help-section-intro">
        Cada gráfico en la plataforma dispone de herramientas de exportación y exploración accesibles desde su barra superior derecha.
      </p>
      <ul className="help-section-list">
        <li>
          <strong>Descarga de imagen (PNG)</strong> — el ícono <strong>↓</strong> en la esquina superior derecha de cada gráfico genera una imagen PNG de alta resolución (escala 3×). La imagen incluye título, descripción y leyenda, sin los controles de interfaz. Algunos gráficos con tabla adjunta la incluyen debajo de la visualización.
        </li>
        <li>
          <strong>Descarga de datos (CSV)</strong> — cuando el gráfico tiene una tabla de datos asociada con un formato estándar de filas/columnas (p. ej. ranking, tabla comparativa), el botón <strong>↓</strong> descarga un CSV en lugar de imagen. Los gráficos que muestran los datos directamente como barras o líneas descargan imagen.
        </li>
        <li>
          <strong>Pantalla completa</strong> — el ícono <strong>⤢</strong> abre el gráfico en un modal que ocupa casi toda la pantalla, con mayor espacio para el área del gráfico. Útil para series de tiempo, scatter y análisis de correlaciones con muchas variables. Cierra con la <strong>×</strong> o haciendo clic fuera del modal.
        </li>
        <li>
          <strong>Tooltips informativos</strong> — el ícono <strong>ⓘ</strong> en la barra de cada gráfico abre una descripción técnica de qué representa, cómo leerlo y advertencias de interpretación. Los gráficos también tienen tooltip de hover al pasar el cursor sobre puntos, barras o líneas para ver valores exactos.
        </li>
        <li>
          <strong>Hover interactivo</strong> — en gráficos de líneas, scatter y mapas, posiciona el cursor sobre cualquier elemento para ver el nombre del estado o municipio, el valor exacto y contexto comparativo. En el mapa coroplético, el hover muestra estado y valor; el clic cambia el estado principal.
        </li>
        <li>
          <strong>Impresión / PDF</strong> — el botón <strong>Imprimir</strong> en la barra superior genera un reporte imprimible de la vista actual. Los controles de interfaz se ocultan; solo se muestran gráficos y datos. Usa «Guardar como PDF» desde el diálogo de impresión del navegador para guardar el reporte.
        </li>
      </ul>
    </div>
  );
}

function DevContent() {
  return (
    <div className="help-section-body">
      <p className="help-section-intro">
        Esta sección solo es visible en <strong>modo desarrollo</strong>. Describe cómo cargar datos locales y guardar cambios mediante commits de git.
      </p>
      <ul className="help-section-list">
        <li>
          <strong>Carga de datos locales</strong> — las variables se gestionan directamente desde el tab <strong>Datos</strong> de la aplicación: usa el wizard de importación para subir un CSV y el sistema actualiza los archivos en <code>public/data/</code> automáticamente.
        </li>
        <li>
          <strong>Verificar cambios antes de guardar</strong> — revisa qué archivos han cambiado con:
          <pre style={{ margin: "6px 0 0", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, padding: "8px 10px", fontSize: 11, color: "var(--text-1)", overflowX: "auto" }}>git status{"\n"}git diff</pre>
        </li>
        <li>
          <strong>Guardar cambios (commit)</strong> — agrega los archivos modificados y crea un commit descriptivo:
          <pre style={{ margin: "6px 0 0", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, padding: "8px 10px", fontSize: 11, color: "var(--text-1)", overflowX: "auto" }}>git add src/ public/data/{"\n"}git commit -m "descripción del cambio"</pre>
          Usa mensajes en español que describan qué se modificó, sin prefijos como <code>feat:</code> o <code>chore:</code>.
        </li>
        <li>
          <strong>Subir cambios al repositorio</strong> — después de hacer commit, sube la rama activa:
          <pre style={{ margin: "6px 0 0", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, padding: "8px 10px", fontSize: 11, color: "var(--text-1)", overflowX: "auto" }}>git push origin dev</pre>
          Los cambios en <code>main</code> se integran mediante PR desde <code>dev</code>.
        </li>
        <li>
          <strong>Servidor de desarrollo</strong> — para iniciar la app en local:
          <pre style={{ margin: "6px 0 0", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, padding: "8px 10px", fontSize: 11, color: "var(--text-1)", overflowX: "auto" }}>npm run dev</pre>
          Los cambios en código se reflejan automáticamente sin reiniciar. Cambios en <code>public/data/</code> requieren recargar la página.
        </li>
      </ul>
    </div>
  );
}

// ─── Sections registry ────────────────────────────────────────────────────────

const SECTIONS: Section[] = [
  {
    id: "navegacion",
    icon: <Compass size={18} />,
    title: "Navegación general",
    desc: "Descripción de cada pestaña y cómo moverse entre ellas.",
    content: <NavegacionContent />,
  },
  {
    id: "sidebar",
    icon: <PanelLeft size={18} />,
    title: "Panel lateral (sidebar)",
    desc: "Estado principal, variables activas, grupos de comparación y filtro.",
    content: <SidebarContent />,
  },
  {
    id: "diagnostico",
    icon: <BarChart2 size={18} />,
    title: "Diagnóstico estatal",
    desc: "KPIs, radar/barras, histograma, mapa coroplético, vista municipal y ranking.",
    content: <DiagnosticoContent />,
  },
  {
    id: "territorial",
    icon: <Map size={18} />,
    title: "Análisis territorial",
    desc: "Lorenz/Gini, municipios extremos, dispersión municipal y correlaciones Spearman.",
    content: <TerritorialContent />,
  },
  {
    id: "relaciones",
    icon: <Network size={18} />,
    title: "Impacto y correlaciones",
    desc: "Pearson, Spearman, diagrama de dispersión, regresión OLS y roles de variables.",
    content: <ImpactoContent />,
  },
  {
    id: "temporal",
    icon: <PlayCircle size={18} />,
    title: "Evolución temporal",
    desc: "Series de tiempo, tendencia OLS, proyección Holt-Winters y velocidad de cambio.",
    content: <EvolucionContent />,
  },
  {
    id: "estructura",
    icon: <Layers size={18} />,
    title: "Estructura y PCA",
    desc: "Índice Digital-Territorial, biplot, cargas PC1 y grupos estructurales.",
    content: <EstructuraContent />,
  },
  {
    id: "datos",
    icon: <Database size={18} />,
    title: "Gestión de datos",
    desc: "Importar variables, series históricas, roles, metadatos y visibilidad.",
    content: <DatosContent />,
  },
  {
    id: "extras",
    icon: <Download size={18} />,
    title: "Exportación y funciones extras",
    desc: "Descargar imágenes/CSV, pantalla completa, tooltips, hover e impresión.",
    content: <ExtrasContent />,
  },
];

function contextToIndex(ctx?: string): number {
  if (!ctx) return 0;
  const idx = SECTIONS.findIndex((s) => s.id === ctx);
  return idx >= 0 ? idx : 0;
}

const DEV_SECTION: Section = {
  id: "dev",
  icon: <Terminal size={18} />,
  title: "Carga de datos y commits (dev)",
  desc: "Cómo actualizar datos locales, hacer commits y subir cambios al repositorio.",
  content: <DevContent />,
};

export default function HelpModal({ onClose, currentContext }: Props) {
  const isDev = import.meta.env.DEV;
  const allSections = isDev ? [...SECTIONS, DEV_SECTION] : SECTIONS;
  const [openIdx, setOpenIdx] = useState<number | null>(contextToIndex(currentContext));

  return createPortal(
    <div
      className="help-modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="help-modal">
        <div className="help-modal__header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <BookOpen size={20} style={{ color: "var(--blue)" }} />
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--text-1)" }}>
              Ayuda y guía de uso
            </h2>
          </div>
          <button type="button" className="help-modal__close" onClick={onClose} aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>

        <div className="help-modal__list">
          {allSections.map((s, i) => {
            const isOpen = openIdx === i;
            return (
              <div key={s.id} className={`help-modal__item${isOpen ? " help-modal__item--open" : ""}${s.id === "dev" ? " help-modal__item--dev" : ""}`}>
                <button
                  type="button"
                  className="help-modal__item-header"
                  onClick={() => setOpenIdx(isOpen ? null : i)}
                  aria-expanded={isOpen}
                >
                  <span className="help-modal__item-icon">{s.icon}</span>
                  <div className="help-modal__item-body">
                    <span className="help-modal__item-title">{s.title}</span>
                    <span className="help-modal__item-desc">{s.desc}</span>
                  </div>
                  <span className="help-modal__item-chevron">
                    {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </span>
                </button>
                {isOpen && s.content}
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
