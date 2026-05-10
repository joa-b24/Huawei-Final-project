import { MoveDownRight, MoveUpRight } from "lucide-react";
import type { VariableCatalogEntry, CategoryId } from "../../types/dataStandard";

const CATEGORY_LABELS: Record<CategoryId, string> = {
  infraestructura_digital: "Infraestructura digital",
  cobertura_red: "Cobertura de red",
  bienestar_social: "Bienestar social",
  economia: "Economía",
  industria: "Industria",
  contexto_territorial: "Contexto territorial",
  demografia: "Demografía",
};


type Props = {
  variable: VariableCatalogEntry;
  statesWithData: number;
  totalStates: number;
  onUpdateData: () => void;
  lastYearWithData: number | null;
  onBack: () => void;
};

export default function VariablePanel({ variable: v, statesWithData, lastYearWithData, totalStates, onUpdateData, onBack }: Props) {
  return (
    <div className="var-panel">
      <button className="btn-ghost wizard-back-link" onClick={onBack} type="button">
        ← Volver al catálogo
      </button>

      <div className="var-panel__header">
        <div>
          <h2 className="var-panel__name">{v.nombre}</h2>
          <span className="catalog-var-id">{v.variable_id}</span>
        </div>
        <div className="var-panel__actions">
          <button className="btn-ghost" type="button" disabled title="Próximamente">
            Editar metadatos
          </button>
          <button className="btn-primary" type="button" onClick={onUpdateData}>
            Actualizar datos
          </button>
        </div>
      </div>

      {v.descripcion && (
        <p className="var-panel__desc">{v.descripcion}</p>
      )}

      <div className="var-panel__meta">
        <div className="var-panel__meta-item">
          <span className="var-panel__meta-label">Categoría</span>
          <span className="var-panel__meta-value">{CATEGORY_LABELS[v.categoria_id] ?? v.categoria_id}</span>
        </div>
        <div className="var-panel__meta-item">
          <span className="var-panel__meta-label">Unidad</span>
          <span className="var-panel__meta-value">{v.unidad_base || "—"}</span>
        </div>
        <div className="var-panel__meta-item">
          <span className="var-panel__meta-label">Dirección</span>
          <span className="var-panel__meta-value">
            {v.direction === "higher_better" && (
              <span className="catalog-direction catalog-direction--up"><MoveUpRight size={14} /></span>
            )}
            {v.direction === "lower_better" && (
              <span className="catalog-direction catalog-direction--down"><MoveDownRight size={14} /></span>
            )}
            {!v.direction && "—"}
          </span>
        </div>
        <div className="var-panel__meta-item">
          <span className="var-panel__meta-label">Fuente</span>
          <span className="var-panel__meta-value">{v.fuente_sugerida || "—"}</span>
        </div>
        <div className="var-panel__meta-item">
          <span className="var-panel__meta-label">Tipo</span>
          <span className="var-panel__meta-value">{v.tipo_valor}</span>
        </div>
        <div className="var-panel__meta-item">
          <span className="var-panel__meta-label">Agregación</span>
          <span className="var-panel__meta-value">{v.agregacion_default}</span>
        </div>
      </div>

      <div className="var-panel__coverage">
        <span className="var-panel__meta-label">Cobertura estatal ({lastYearWithData})</span>
        <div className="var-panel__coverage-bar">
          <div
            className="var-panel__coverage-fill"
            style={{ width: totalStates > 0 ? `${(statesWithData / totalStates) * 100}%` : "0%" }}
          />
        </div>
        <span className="var-panel__coverage-text">
          {statesWithData} / {totalStates} estados
        </span>
      </div>
    </div>
  );
}
