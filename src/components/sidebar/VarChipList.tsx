const CATEGORY_COLORS: Record<string, string> = {
  infraestructura_digital: "#1d4ed8",
  cobertura_red: "#0891b2",
  bienestar_social: "#065f46",
  economia: "#d97706",
  industria: "#7c3aed",
  contexto_territorial: "#c2410c",
  demografia: "#be185d",
};

type VarItem = { id: string; label: string; category?: string; role?: string };

type Props = {
  vars: VarItem[];
  activeIds: string[];
  maxActive?: number;
  onToggle: (id: string) => void;
};

export default function VarChipList({ vars, activeIds, maxActive = 5, onToggle }: Props) {
  const atLimit = activeIds.length >= maxActive;

  return (
    <div className="var-chip-list">
      {vars.map(({ id, label, category, role }) => {
        const isActive = activeIds.includes(id);
        const isDisabled = !isActive && atLimit;
        const isContext = role === "context";
        const dotColor = category ? (CATEGORY_COLORS[category] ?? "#6b7280") : "#6b7280";
        const titleText = isDisabled
          ? `Máximo ${maxActive} variables activas`
          : isContext
          ? `${label} — variable contextual (referencia, no análisis primario)`
          : label;
        return (
          <button
            key={id}
            type="button"
            className={`var-chip${isActive ? " active" : ""}${isDisabled ? " disabled" : ""}${isContext ? " var-chip--context" : ""}`}
            onClick={() => { if (!isDisabled) onToggle(id); }}
            aria-pressed={isActive}
            title={titleText}
          >
            <span
              className="var-chip__dot"
              aria-hidden="true"
              style={{ background: dotColor }}
            />
            {label}
            {isContext && <span className="var-chip__role-tag">ctx</span>}
          </button>
        );
      })}
    </div>
  );
}
