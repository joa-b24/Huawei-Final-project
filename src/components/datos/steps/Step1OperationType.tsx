export type Granularity = "state" | "historico" | "municipal";

const OPTIONS: { id: Granularity; label: string; desc: string }[] = [
  {
    id: "state",
    label: "Estatal",
    desc: "Un valor por estado para un año. Ej: % usuarios internet 2024.",
  },
  {
    id: "historico",
    label: "Histórico",
    desc: "Serie temporal por estado: múltiples años para la misma variable.",
  },
  {
    id: "municipal",
    label: "Municipal",
    desc: "Un valor por municipio. Ej: cobertura 4G por municipio en 2024.",
  },
];

type Props = {
  selected: Granularity | null;
  onChange: (g: Granularity) => void;
  onNext: () => void;
};

export default function Step1Granularity({ selected, onChange, onNext }: Props) {
  return (
    <div className="wizard-step-body">
      <p className="wizard-step-title">¿Qué tipo de datos tienes?</p>
      <div className="op-type-grid">
        {OPTIONS.map((opt) => (
          <button
            key={opt.id}
            className={`op-type-card${selected === opt.id ? " selected" : ""}`}
            onClick={() => onChange(opt.id)}
            type="button"
          >
            <span className="op-type-card__label">{opt.label}</span>
            <span className="op-type-card__desc">{opt.desc}</span>
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
