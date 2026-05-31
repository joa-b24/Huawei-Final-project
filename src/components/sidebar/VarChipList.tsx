import type { CSSProperties } from "react";

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

const BADGE_STYLE: CSSProperties = {
  fontSize: 8,
  fontWeight: 700,
  letterSpacing: "0.05em",
  borderRadius: 3,
  padding: "1px 3px",
  marginLeft: 3,
  verticalAlign: "middle",
  opacity: 0.85,
};

function Chip({ id, label, category, role, hasMunicipal, hasHistorical, isActive, isDisabled, maxActive, onToggle }: VarItem & { isActive: boolean; isDisabled: boolean; maxActive: number; onToggle: (id: string) => void }) {
  const isContext = role === "context";
  const dotColor = category ? (CATEGORY_COLORS[category] ?? "#6b7280") : "#6b7280";
  const coverageParts = [hasMunicipal ? "Municipal" : "", hasHistorical ? "Histórica" : ""].filter(Boolean).join(", ");
  const titleText = isDisabled
    ? `Máximo ${maxActive} variables activas`
    : isContext
    ? `${label} — variable contextual (referencia, no análisis primario)`
    : coverageParts
    ? `${label} — cobertura: ${coverageParts}`
    : label;
  return (
    <button
      type="button"
      className={`var-chip${isActive ? " active" : ""}${isDisabled ? " disabled" : ""}${isContext ? " var-chip--context" : ""}`}
      onClick={() => { if (!isDisabled) onToggle(id); }}
      aria-pressed={isActive}
      title={titleText}
    >
      <span className="var-chip__dot" aria-hidden="true" style={{ background: dotColor }} />
      {label}
      {hasMunicipal && <span style={{ ...BADGE_STYLE, background: "#1d4ed8", color: "#fff" }}>MUN</span>}
      {hasHistorical && <span style={{ ...BADGE_STYLE, background: "#065f46", color: "#fff" }}>HIST</span>}
      {isContext && <span className="var-chip__role-tag">ctx</span>}
    </button>
  );
}

export default function VarChipList({ vars, activeIds, maxActive = 5, onToggle }: Props) {
  const atLimit = activeIds.length >= maxActive;
  const activeVars = vars.filter((v) => activeIds.includes(v.id));
  const inactiveVars = vars.filter((v) => !activeIds.includes(v.id));

  return (
    <div className="var-chip-list">
      {activeVars.map((v) => (
        <Chip key={v.id} {...v} isActive={true} isDisabled={false} maxActive={maxActive} onToggle={onToggle} />
      ))}
      {activeVars.length > 0 && inactiveVars.length > 0 && (
        <div className="var-chip-divider" />
      )}
      {inactiveVars.map((v) => (
        <Chip key={v.id} {...v} isActive={false} isDisabled={atLimit} maxActive={maxActive} onToggle={onToggle} />
      ))}
    </div>
  );
}
