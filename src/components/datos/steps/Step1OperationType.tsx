import type { OperationType } from "../../../lib/dataStorage";

const OPTIONS: { id: OperationType; label: string; desc: string }[] = [
  { id: "nueva_variable", label: "Nueva variable", desc: "Añade un indicador completamente nuevo al catálogo con sus datos estatales." },
  { id: "historico", label: "Datos históricos", desc: "Agrega series de tiempo (múltiples años) para una variable existente." },
  { id: "municipal", label: "Granularidad municipal", desc: "Sube datos a nivel municipio para desagregar un indicador estatal." },
  { id: "actualizar", label: "Actualizar datos", desc: "Reemplaza los valores actuales de una variable con datos más recientes." },
  { id: "completar", label: "Completar datos", desc: "Llena valores faltantes (nulls) sin sobreescribir los que ya existen." },
];

type Props = {
  selected: OperationType | null;
  onChange: (op: OperationType) => void;
  onNext: () => void;
};

export default function Step1OperationType({ selected, onChange, onNext }: Props) {
  return (
    <div className="wizard-step-body">
      <p className="wizard-step-title">¿Qué quieres hacer?</p>
      <div className="op-type-grid">
        {OPTIONS.map((op) => (
          <button
            key={op.id}
            className={`op-type-card${selected === op.id ? " selected" : ""}`}
            onClick={() => onChange(op.id)}
            type="button"
          >
            <span className="op-type-card__label">{op.label}</span>
            <span className="op-type-card__desc">{op.desc}</span>
          </button>
        ))}
      </div>
      <div className="wizard-nav">
        <button className="btn-primary" disabled={!selected} onClick={onNext} type="button">
          Siguiente →
        </button>
      </div>
    </div>
  );
}
