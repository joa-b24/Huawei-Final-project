const CATEGORY_COLORS: Record<string, string> = {
  infraestructura_digital: "#1d4ed8",
  cobertura_red: "#0891b2",
  bienestar_social: "#065f46",
  economia: "#d97706",
  industria: "#7c3aed",
  contexto_territorial: "#c2410c",
  demografia: "#be185d",
};

type VarItem = { id: string; label: string; category?: string; role?: string; hasMunicipal?: boolean; hasHistorical?: boolean };

type Props = {
  vars: VarItem[];
  activeIds: string[];
  maxActive?: number;
  onToggle: (id: string) => void;
};

function VarRow({
  id,
  label,
  category,
  hasMunicipal,
  hasHistorical,
  isActive,
  isDisabled,
  maxActive,
  onToggle,
}: VarItem & { isActive: boolean; isDisabled: boolean; maxActive: number; onToggle: (id: string) => void }) {
  const dotColor = category ? (CATEGORY_COLORS[category] ?? "#6b7280") : "#6b7280";
  return (
    <div
      className={`va-row${isActive ? " active" : ""}${isDisabled ? " muted" : ""}`}
      onClick={() => !isDisabled && onToggle(id)}
      role="button"
      tabIndex={isDisabled ? -1 : 0}
      onKeyDown={(e) => { if (e.key === "Enter" && !isDisabled) onToggle(id); }}
      title={isDisabled ? `Máximo ${maxActive} variables activas` : label}
    >
      <span className="va-dot" style={{ background: dotColor }} />
      <span className="va-name">{label}</span>
      {hasMunicipal && <span className="va-tag">MUN</span>}
      {hasHistorical && <span className="va-tag va-tag--hist">HIST</span>}
    </div>
  );
}

export default function VarChipList({ vars, activeIds, maxActive = 5, onToggle }: Props) {
  const atLimit = activeIds.length >= maxActive;
  const activeVars = vars.filter((v) => activeIds.includes(v.id));
  const inactiveVars = vars.filter((v) => !activeIds.includes(v.id));

  return (
    <div className="va-list-wrap">
      <div className="va-list">
        <div className="va-list-inner">
          {activeVars.map((v) => (
            <VarRow key={v.id} {...v} isActive={true} isDisabled={false} maxActive={maxActive} onToggle={onToggle} />
          ))}
          {activeVars.length > 0 && inactiveVars.length > 0 && <div className="va-divider" />}
          {inactiveVars.map((v) => (
            <VarRow key={v.id} {...v} isActive={false} isDisabled={atLimit} maxActive={maxActive} onToggle={onToggle} />
          ))}
        </div>
      </div>
      <div className="va-fade" />
    </div>
  );
}
