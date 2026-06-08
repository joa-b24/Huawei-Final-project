import { useMemo, useState, useRef } from "react";
import StateSearch from "../sidebar/StateSearch";
import VarChipList from "../sidebar/VarChipList";
import ComparisonGroupSelector, { GROUP_COLORS, NACIONAL_COLOR } from "../sidebar/ComparisonGroupSelector";
import { MAX_ACTIVE_VARIABLES } from "../../context/AppContext";

type VarItem = { id: string; label: string; category?: string; role?: string; hasMunicipal?: boolean; hasHistorical?: boolean };

type Props = {
  states: string[];
  primaryState: string | null;
  onSelectState: (s: string) => void;
  vars: VarItem[];
  activeVarIds: string[];
  onToggleVar: (id: string) => void;
  onClearVars: () => void;
  comparisonGroups: string[];
  onComparisonGroupsChange: (groups: string[]) => void;
  regionGroupId: string | null;
  primaryClusterGroupId: string | null;
  primaryClusterLabel: string | null;
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
  comparisonGroups,
  onComparisonGroupsChange,
  regionGroupId,
  primaryClusterGroupId,
  primaryClusterLabel,
  hidden = false,
}: Props) {
  const [stateQuery, setStateQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [varQuery, setVarQuery] = useState("");
  const [varFilter, setVarFilter] = useState<"all" | "municipal" | "historical">("all");
  const [collapsed, setCollapsed] = useState(false);
  const [showComparison, setShowComparison] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const groupColorMap = useMemo(() => {
    const map = new Map<string, string>();
    map.set("nacional", NACIONAL_COLOR);
    comparisonGroups
      .filter((g) => g !== "nacional")
      .forEach((g, i) => map.set(g, GROUP_COLORS[i] ?? GROUP_COLORS[GROUP_COLORS.length - 1]));
    return map;
  }, [comparisonGroups]);


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
        {collapsed ? "›" : "‹"}
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
            <div className="sidebar-section-header">
              <p className="sidebar-label">Comparación</p>
              <button
                type="button"
                className="cg-section-toggle"
                onClick={() => setShowComparison((v) => !v)}
                title={showComparison ? "Ocultar comparaciones" : "Mostrar comparaciones"}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path
                    d={showComparison ? "M2 8l4-4 4 4" : "M2 4l4 4 4-4"}
                    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
            {showComparison && (
              <ComparisonGroupSelector
                groups={comparisonGroups}
                onGroupsChange={onComparisonGroupsChange}
                regionGroupId={regionGroupId}
                primaryClusterGroupId={primaryClusterGroupId}
                primaryClusterLabel={primaryClusterLabel}
                primaryState={primaryState}
                allStateNames={states}
                groupColorMap={groupColorMap}
              />
            )}
          </div>

          <div className="va-section">
            <div className="va-vhead">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="sidebar-label">Variables activas</span>
                <span className="va-count">{activeVarIds.length}</span>
              </div>
              {activeVarIds.length > 0 && (
                <button type="button" className="va-clear" onClick={onClearVars} aria-label="Limpiar variables">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                    <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>
            <div className="va-search">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0, color: "var(--text-3)" }} aria-hidden="true">
                <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.3" />
                <path d="M9 9l2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              <input
                className="va-input"
                value={varQuery}
                onChange={(e) => setVarQuery(e.target.value)}
                placeholder="Buscar variable…"
              />
            </div>
            <div className="va-seg">
              {(["all", "municipal", "historical"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={varFilter === f ? "on" : ""}
                  onClick={() => setVarFilter(f)}
                >
                  {f === "all" ? "Todas" : f === "municipal" ? "Municipal" : "Histórica"}
                </button>
              ))}
            </div>
            <VarChipList vars={filteredVars} activeIds={activeVarIds} maxActive={MAX_ACTIVE_VARIABLES} onToggle={onToggleVar} />
          </div>
        </>
      )}
    </aside>
  );
}
