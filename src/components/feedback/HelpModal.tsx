import { createPortal } from "react-dom";
import { X, BookOpen, PlayCircle, BarChart2, Map, Network } from "lucide-react";

type Props = { onClose: () => void };

const SECTIONS = [
  {
    icon: <BarChart2 size={18} />,
    title: "Diagnóstico estatal",
    desc: "Cómo leer los KPIs, el perfil radar/barras, el histograma y el ranking por variable.",
    tag: "Próximamente",
  },
  {
    icon: <Network size={18} />,
    title: "Impacto y correlaciones",
    desc: "Interpretación del coeficiente de Pearson, el diagrama de dispersión y la regresión OLS.",
    tag: "Próximamente",
  },
  {
    icon: <Map size={18} />,
    title: "Estructura y PCA",
    desc: "Qué es el índice Digital-Territorial, cómo leer el espacio de componentes y los grupos estructurales.",
    tag: "Próximamente",
  },
  {
    icon: <PlayCircle size={18} />,
    title: "Evolución temporal",
    desc: "Series de tiempo por estado: tendencias, cómo importar datos históricos con el wizard.",
    tag: "Próximamente",
  },
  {
    icon: <BookOpen size={18} />,
    title: "Gestión de datos (Wizard)",
    desc: "Importar y actualizar variables, agregar datos municipales y gestionar el catálogo.",
    tag: "Próximamente",
  },
];

export default function HelpModal({ onClose }: Props) {
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

        <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--text-3)", lineHeight: 1.6 }}>
          Guías de uso para cada sección del dashboard. Haz clic en una sección para ver el tutorial correspondiente.
        </p>

        <div className="help-modal__list">
          {SECTIONS.map((s) => (
            <button
              key={s.title}
              type="button"
              className="help-modal__item"
              disabled
              title="Contenido en preparación"
            >
              <span className="help-modal__item-icon">{s.icon}</span>
              <div className="help-modal__item-body">
                <span className="help-modal__item-title">{s.title}</span>
                <span className="help-modal__item-desc">{s.desc}</span>
              </div>
              <span className="help-modal__item-tag">{s.tag}</span>
            </button>
          ))}
        </div>

        <p style={{ marginTop: 20, fontSize: 12, color: "var(--text-3)", textAlign: "center" }}>
          El manual de usuario completo estará disponible en la siguiente versión del dashboard.
        </p>
      </div>
    </div>,
    document.body
  );
}
