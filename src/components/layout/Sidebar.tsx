import { useState, useRef } from "react";
import StateSearch from "../sidebar/StateSearch";
import VarChipList from "../sidebar/VarChipList";

type VarItem = { id: string; label: string; category?: string; role?: string; hasMunicipal?: boolean; hasHistorical?: boolean };

type Props = {
  states: string[];
  primaryState: string | null;
  onSelectState: (s: string) => void;
  vars: VarItem[];
  activeVarIds: string[];
  onToggleVar: (id: string) => void;
  onClearVars: () => void;
  hidden?: boolean;
};

export default function Sidebar({
  states,
  primaryState,
  onSelectState,
  vars,
  activeVarIds,
  onToggleVar,
  onClearVars,
  hidden = false,
}: Props) {
  const [stateQuery, setStateQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [varQuery, setVarQuery] = useState("");
  const [varFilter, setVarFilter] = useState<"all" | "municipal" | "historical">("all");
  const [collapsed, setCollapsed] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  if (hidden) return null;

  const suggestions = stateQuery.trim()
    ? states.filter((s) => s.toLowerCase().includes(stateQuery.toLowerCase())).slice(0, 8)
    : states.slice(0, 8);

  function handleSelectState(s: string) {
    onSelectState(s);
    setStateQuery("");
    setShowDropdown(false);
  }

  const filteredVars = vars.filter((v) => {
    if (varQuery && !(v.label ?? "").toLowerCase().includes(varQuery.toLowerCase())) return false;
    if (varFilter === "municipal") return !!v.hasMunicipal;
    if (varFilter === "historical") return !!v.hasHistorical;
    return true;
  });

  return (
    <aside className={`layout-sidebar${collapsed ? " collapsed" : ""}`}>
      <button
        className="sidebar-toggle"
        onClick={() => setCollapsed((c) => !c)}
        title={collapsed ? "Expandir panel" : "Colapsar panel"}
        type="button"
      >
        {collapsed ? "»" : "«"}
      </button>

      {!collapsed && (
        <>
          <div className="sidebar-logo">
            <p className="sidebar-logo__eyebrow">Observatorio</p>
            <p className="sidebar-logo__title">Indicadores Estatales</p>
          </div>

          <div className="sidebar-section">
            <p className="sidebar-label">Estado principal</p>
            {primaryState && (
              <div className="state-selected-badge">
                <span>{primaryState}</span>
                <button
                  type="button"
                  onClick={() => onSelectState("")}
                  aria-label="Quitar selección"
                >
                  ×
                </button>
              </div>
            )}
            <div className="state-typeahead">
              <StateSearch
                value={stateQuery}
                onChange={(v) => { setStateQuery(v); setShowDropdown(true); }}
                placeholder="Buscar estado..."
              />
              {showDropdown && suggestions.length > 0 && (
                <div className="state-typeahead__dropdown" ref={dropdownRef}>
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`state-typeahead__option${s === primaryState ? " selected" : ""}`}
                      onMouseDown={() => handleSelectState(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="sidebar-section">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p className="sidebar-label" style={{ margin: 0 }}>Variables activas ({activeVarIds.length}/5)</p>
              {activeVarIds.length > 0 && (
                <button type="button" className="var-chip-clear" onClick={onClearVars} style={{ margin: 0 }}>×</button>
              )}
            </div>
            <StateSearch value={varQuery} onChange={setVarQuery} placeholder="Buscar variable..." />
            <div className="var-filter-row">
              {(["all", "municipal", "historical"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`var-filter-btn${varFilter === f ? " active" : ""}`}
                  onClick={() => setVarFilter(f)}
                >
                  {f === "all" ? "Todas" : f === "municipal" ? "Municipal" : "Histórica"}
                </button>
              ))}
            </div>
            <VarChipList vars={filteredVars} activeIds={activeVarIds} onToggle={onToggleVar} />
          </div>
        </>
      )}
    </aside>
  );
}
