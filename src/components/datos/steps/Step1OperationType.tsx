import type { OperationType } from "../../../lib/dataStorage";

const MAIN_OPTIONS: { id: OperationType; label: string; desc: string }[] = [
  { id: "nueva_variable", label: "Nueva variable", desc: "Añade un indicador completamente nuevo al catálogo con sus datos estatales." },
  { id: "historico", label: "Datos históricos", desc: "Incorpora datos de años anteriores para una variable existente." },
  { id: "municipal", label: "Granularidad municipal", desc: "Agrega datos a nivel municipio para una variable existente." },
];

const UPDATE_OPTIONS: { id: OperationType; label: string; desc: string }[] = [
  { id: "completar", label: "Completar faltantes", desc: "Llena valores null sin sobreescribir los existentes." },
  { id: "modificar", label: "Modificar datos", desc: "Sobreescribe valores por mejor fuente, corrección o recálculo." },
  { id: "actualizar", label: "Datos más recientes", desc: "Reemplaza con datos de un periodo más reciente." },
];

type Props = {
  selected: OperationType | null;
  onChange: (op: OperationType) => void;
  onNext: () => void;
  disableNew?: boolean;
};

export default function Step1OperationType({ selected, onChange, onNext, disableNew }: Props) {
  const isUpdate = selected === "completar" || selected === "modificar" || selected === "actualizar";

  return (
    <div className="wizard-step-body">
      <p className="wizard-step-title">¿Qué quieres hacer?</p>
      <div className="op-type-grid">
        {MAIN_OPTIONS.map((op) => {
          const disabled = disableNew && op.id === "nueva_variable";
          return (
            <button
              key={op.id}
              className={`op-type-card${selected === op.id ? " selected" : ""}${disabled ? " disabled" : ""}`}
              onClick={() => { if (!disabled) onChange(op.id); }}
              type="button"
              title={disabled ? "No aplica cuando se selecciona una variable existente" : undefined}
            >
              <span className="op-type-card__label">{op.label}</span>
              <span className="op-type-card__desc">{op.desc}</span>
            </button>
          );
        })}
        <div className={`op-type-card op-type-group${isUpdate ? " selected" : ""}`}>
          <span className="op-type-card__label">Actualizar datos</span>
          <span className="op-type-card__desc">Incorpora o corrige datos de una variable existente.</span>
          <div className="op-type-subgrid">
            {UPDATE_OPTIONS.map((op) => (
              <button
                key={op.id}
                className={`op-type-subcard${selected === op.id ? " selected" : ""}`}
                onClick={() => onChange(op.id)}
                type="button"
              >
                <span className="op-type-subcard__label">{op.label}</span>
                <span className="op-type-subcard__desc">{op.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="wizard-nav">
        <button className="btn-primary" disabled={!selected} onClick={onNext} type="button">
          Siguiente →
        </button>
      </div>
    </div>
  );
}
