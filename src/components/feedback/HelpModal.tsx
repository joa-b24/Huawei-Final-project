import { useState } from "react";
import { createPortal } from "react-dom";
import { X, BookOpen, PlayCircle, BarChart2, Map, Network, ChevronDown, ChevronUp, Database, Layers } from "lucide-react";

type Props = { onClose: () => void; currentContext?: string };

type Section = {
  id: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  content?: React.ReactNode;
};

function DiagnosticoContent() {
  return (
    <div className="help-section-body">
      <p className="help-section-intro">
        El tab <strong>Diagnóstico</strong> presenta el perfil de un estado frente al conjunto nacional y a los grupos de comparación seleccionados.
      </p>
      <ul className="help-section-list">
        <li>
          <strong>KPIs</strong> — cada tarjeta muestra el valor del estado y su delta respecto a la media nacional (verde = favorable, rojo = desfavorable). El signo depende de la polaridad de la variable: en variables como pobreza, un valor menor es positivo.
        </li>
        <li>
          <strong>Grupos de comparación</strong> — activa Nacional, región geográfica, grupo estructural (cluster) o un estado específico. Con "Mostrar en gráficas" los grupos aparecen superpuestos en el histograma, boxplot, mapa y KPIs, con el mismo color que en el radar.
        </li>
        <li>
          <strong>Radar / Barras</strong> — escala de percentil 0–100 sobre los 32 estados; 100 = mayor ventaja relativa. Las variables de polaridad negativa (ej. pobreza, carencia) están invertidas: percentil alto = buen desempeño.
        </li>
        <li>
          <strong>Histograma y boxplot</strong> — 10 intervalos pre-calculados de igual amplitud. La barra azul es el estado seleccionado. La caja cubre el 50 % central de estados (Q₁–Q₃); los puntos naranjas más allá de los bigotes son atípicos (criterio IQR × 1.5).
        </li>
        <li>
          <strong>Ranking</strong> — ordenado de mejor a peor según la polaridad de cada variable. El percentil de posición aparece en la narrativa superior.
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
          <strong>Matriz de correlaciones</strong> — coeficiente de Pearson (lineal) y Spearman (rango). ≥ 0.7 = fuerte · 0.4–0.7 = moderada · 0.2–0.4 = débil · &lt; 0.2 = muy débil. Un valor negativo indica relación inversa.
        </li>
        <li>
          <strong>Diagrama de dispersión</strong> — cada punto es un estado. La línea de tendencia es la recta OLS. Identifica outliers que se alejan de la nube: pueden indicar condiciones estructurales diferenciadas.
        </li>
        <li>
          <strong>Regresión OLS</strong> — la pendiente (β) indica el cambio esperado en Y por unidad de X. R² es la proporción de varianza explicada: 1.0 = ajuste perfecto, 0 = sin poder explicativo.
        </li>
        <li>
          <strong>Correlación ≠ causalidad</strong> — dos variables pueden correlacionar por un factor común (ej. nivel de desarrollo general). Usa las correlaciones para generar hipótesis, no para inferir causalidad directa.
        </li>
        <li>
          <strong>Variables de contexto (ctx)</strong> — útiles como X explicativa, pero evita interpretarlas como objetivo directo de política. Están marcadas en el panel de variables del sidebar.
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
          <strong>Curva de Lorenz</strong> — el eje X acumula la población (municipios ordenados de menor a mayor cobertura 4G garantizada) y el eje Y acumula la cobertura. La diagonal de 45° representa igualdad perfecta; mayor separación equivale a mayor desigualdad territorial. El coeficiente de Gini resume esa brecha en un número entre 0 (igualdad) y 1 (desigualdad máxima).
        </li>
        <li>
          <strong>Correlaciones de rango (Spearman)</strong> — mide la asociación monotónica entre variables municipales (cobertura 4G, escolaridad, % adultos mayores, etc.). El heatmap muestra los coeficientes: azul intenso = fuerte positiva, rojo intenso = fuerte negativa, blanco = sin relación.
        </li>
        <li>
          <strong>Explorador de dispersión municipal</strong> — selecciona cualquier par de métricas para visualizar la relación a nivel municipio. Cada punto es un municipio; el tamaño puede representar población. Identifica municipios atípicos que se alejan de la tendencia estatal.
        </li>
        <li>
          <strong>Tabla de municipios</strong> — listado con cobertura 4G, población, escolaridad y otras métricas. Ordena por cualquier columna para identificar los municipios con mayor o menor cobertura.
        </li>
        <li>
          <strong>Diagnóstico por Random Forest</strong> — importancia de características: qué variables municipales predicen mejor la cobertura 4G. Barras más largas = mayor poder explicativo. Complementa el análisis de Spearman con relaciones no lineales.
        </li>
      </ul>
    </div>
  );
}

function EstructuraContent() {
  return (
    <div className="help-section-body">
      <p className="help-section-intro">
        La vista <strong>Estructura</strong> reduce la dimensionalidad del conjunto de variables a componentes principales (PCA) y agrupa estados con perfiles similares.
      </p>
      <ul className="help-section-list">
        <li>
          <strong>Índice Digital-Territorial</strong> — puntuación compuesta derivada del primer componente principal (PC1), que concentra la mayor varianza del sistema. Un valor alto indica ventaja en el conjunto de indicadores; uno bajo, rezago relativo. No es un índice normativo: describe posición relativa, no metas.
        </li>
        <li>
          <strong>Espacio de componentes (biplot)</strong> — los ejes son PC1 y PC2. Cada punto es un estado. Los vectores de carga (loadings) muestran qué variables "jalan" en cada dirección: estados cercanos a un vector tienen valores altos en esa variable. La distancia entre estados refleja similitud multivariada.
        </li>
        <li>
          <strong>Grupos estructurales (clusters)</strong> — formados por k-means sobre las puntuaciones de los primeros componentes. Los estados de un mismo cluster comparten un perfil similar en el espacio de variables. Úsalos como grupo de comparación en el tab Diagnóstico para evaluar brechas dentro de pares estructuralmente parecidos.
        </li>
        <li>
          <strong>Varianza explicada</strong> — indica qué proporción de la información total captura cada componente. Si PC1+PC2 explican ≥ 60 % de la varianza, el biplot es una representación fiel del espacio original.
        </li>
      </ul>
    </div>
  );
}

function EvolucionContent() {
  return (
    <div className="help-section-body">
      <p className="help-section-intro">
        El tab <strong>Evolución</strong> muestra cómo cambian las variables a lo largo del tiempo para el estado seleccionado y sus grupos de comparación.
      </p>
      <ul className="help-section-list">
        <li>
          <strong>Series de tiempo</strong> — cada línea es un estado o grupo. El eje X es el año; el eje Y, el valor de la variable activa. Pasa el cursor sobre cualquier punto para ver el valor exacto. Si el estado no tiene dato en un año, la línea se interrumpe.
        </li>
        <li>
          <strong>Tendencia</strong> — la línea punteada superpuesta es la tendencia lineal OLS. Una pendiente positiva indica mejora sostenida; negativa, deterioro. No predice el futuro: extrapola la trayectoria histórica disponible.
        </li>
        <li>
          <strong>Importar datos históricos</strong> — en el tab <em>Datos</em> puedes subir un CSV con columnas <code>estado</code>, <code>año</code> y el nombre de la variable. Los registros se integran al catálogo y aparecen automáticamente en la serie de tiempo.
        </li>
        <li>
          <strong>Cobertura temporal</strong> — el número de años disponibles varía por variable. Las variables de cobertura digital típicamente tienen 2–4 años; variables socioeconómicas pueden tener series más largas de encuestas o censos.
        </li>
      </ul>
    </div>
  );
}

function DatosContent() {
  return (
    <div className="help-section-body">
      <p className="help-section-intro">
        El tab <strong>Datos</strong> permite gestionar el catálogo de variables, importar nuevas fuentes y administrar la visibilidad de indicadores.
      </p>
      <ul className="help-section-list">
        <li>
          <strong>Importar variables</strong> — sube un CSV con columna <code>estado</code> y una o más columnas de variables numéricas. El sistema detecta los nombres de columna, los agrega al catálogo y los hace disponibles en el sidebar. Los datos persisten en el navegador (localStorage).
        </li>
        <li>
          <strong>Datos históricos</strong> — para series de tiempo, el CSV debe incluir una columna <code>año</code> (o <code>year</code>). El panel de Evolución mostrará la nueva variable automáticamente.
        </li>
        <li>
          <strong>Visibilidad de variables</strong> — oculta variables que no son relevantes para tu análisis sin eliminarlas del catálogo. Puedes restaurarlas en cualquier momento. Las variables ocultas no aparecen en el selector del sidebar ni en los gráficos.
        </li>
        <li>
          <strong>Rol de variables</strong> — las variables marcadas como <em>contexto (ctx)</em> están disponibles para correlaciones y regresiones, pero se distinguen visualmente del resto para recordar que no son objetivos directos de política.
        </li>
        <li>
          <strong>Metadatos</strong> — cada variable puede tener etiqueta, unidad, categoría y polaridad (si un valor mayor es favorable o desfavorable). Estos metadatos determinan el color de los deltas en KPIs y la orientación del ranking.
        </li>
      </ul>
    </div>
  );
}

const SECTIONS: Section[] = [
  {
    id: "diagnostico",
    icon: <BarChart2 size={18} />,
    title: "Diagnóstico estatal",
    desc: "KPIs, radar/barras, histograma, boxplot y ranking por variable.",
    content: <DiagnosticoContent />,
  },
  {
    id: "relaciones",
    icon: <Network size={18} />,
    title: "Impacto y correlaciones",
    desc: "Pearson, Spearman, diagrama de dispersión y regresión OLS.",
    content: <ImpactoContent />,
  },
  {
    id: "temporal",
    icon: <PlayCircle size={18} />,
    title: "Evolución temporal",
    desc: "Series de tiempo por estado: tendencias e importación de datos históricos.",
    content: <EvolucionContent />,
  },
  {
    id: "territorial",
    icon: <Map size={18} />,
    title: "Análisis territorial",
    desc: "Lorenz, Gini, Spearman municipal, dispersión y Random Forest.",
    content: <TerritorialContent />,
  },
  {
    id: "estructura",
    icon: <Layers size={18} />,
    title: "Estructura y PCA",
    desc: "Índice Digital-Territorial, espacio de componentes y grupos estructurales.",
    content: <EstructuraContent />,
  },
  {
    id: "datos",
    icon: <Database size={18} />,
    title: "Gestión de datos",
    desc: "Importar variables, series históricas, visibilidad y metadatos.",
    content: <DatosContent />,
  },
];

function contextToIndex(ctx?: string): number {
  if (!ctx) return 0;
  const idx = SECTIONS.findIndex((s) => s.id === ctx);
  return idx >= 0 ? idx : 0;
}

export default function HelpModal({ onClose, currentContext }: Props) {
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
              Ayuda y tutoriales
            </h2>
          </div>
          <button type="button" className="help-modal__close" onClick={onClose} aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>

        <div className="help-modal__list">
          {SECTIONS.map((s, i) => {
            const isOpen = openIdx === i;
            return (
              <div key={s.id} className={`help-modal__item${isOpen ? " help-modal__item--open" : ""}`}>
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
