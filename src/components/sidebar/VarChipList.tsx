const CATEGORY_COLORS: Record<string, string> = {
  infraestructura_digital: "#1d4ed8",
  cobertura_red: "#0891b2",
  bienestar_social: "#065f46",
  economia: "#d97706",
  industria: "#7c3aed",
  contexto_territorial: "#c2410c",
  demografia: "#be185d",
};

type VarItem = { id: string; label: string; category?: string };

type Props = {
  vars: VarItem[];
  activeIds: string[];
  maxActive?: number;
  onToggle: (id: string) => void;
  onClearAll?: () => void;
};

export default function VarChipList({ vars, activeIds, maxActive = 5, onToggle, onClearAll }: Props) {
  const atLimit = activeIds.length >= maxActive;

  return (
    <div className="var-chip-list">
      {activeIds.length > 0 && onClearAll && (
        <button type="button" className="var-chip-clear" onClick={onClearAll}>
          Limpiar selección
        </button>
      )}
      {vars.map(({ id, label, category }) => {
        const isActive = activeIds.includes(id);
        const isDisabled = !isActive && atLimit;
        const dotColor = category ? (CATEGORY_COLORS[category] ?? "#6b7280") : "#6b7280";
        return (
          <button
            key={id}
            type="button"
            className={`var-chip${isActive ? " active" : ""}${isDisabled ? " disabled" : ""}`}
            onClick={() => { if (!isDisabled) onToggle(id); }}
            aria-pressed={isActive}
            title={isDisabled ? `Máximo ${maxActive} variables activas` : label}
          >
            <span
              className="var-chip__dot"
              aria-hidden="true"
              style={{ background: dotColor }}
            />
            {label}
          </button>
        );
      })}
    </div>
  );
}
