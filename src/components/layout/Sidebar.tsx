import { useState } from "react";
import type { ComparisonTarget } from "../../context/AppContext";
import ComparisonSelect from "../sidebar/ComparisonSelect";
import StateList from "../sidebar/StateList";
import StateSearch from "../sidebar/StateSearch";
import VarChipList from "../sidebar/VarChipList";

type VarItem = { id: string; label: string; category?: string };

type Props = {
  states: string[];
  selectedStates: string[];
  onToggleState: (s: string) => void;
  comparisonTarget: ComparisonTarget;
  onComparisonChange: (t: ComparisonTarget) => void;
  vars: VarItem[];
  activeVarIds: string[];
  onToggleVar: (id: string) => void;
};

export default function Sidebar({
  states,
  selectedStates,
  onToggleState,
  comparisonTarget,
  onComparisonChange,
  vars,
  activeVarIds,
  onToggleVar,
}: Props) {
  const [stateQuery, setStateQuery] = useState("");
  const [varQuery, setVarQuery] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  const filteredStates = stateQuery
    ? states.filter((s) => s.toLowerCase().includes(stateQuery.toLowerCase()))
    : states;

  const filteredVars = varQuery
    ? vars.filter((v) => v.label.toLowerCase().includes(varQuery.toLowerCase()))
    : vars;

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
            <p className="sidebar-label">Seleccionar estado(s)</p>
            <StateSearch value={stateQuery} onChange={setStateQuery} placeholder="Buscar estado..." />
            <StateList states={filteredStates} selected={selectedStates} onToggle={onToggleState} />
          </div>

          <div className="sidebar-section">
            <p className="sidebar-label">Comparar con</p>
            <ComparisonSelect value={comparisonTarget} onChange={onComparisonChange} />
          </div>

          <div className="sidebar-section">
            <p className="sidebar-label">Variables activas ({activeVarIds.length}/5)</p>
            <StateSearch value={varQuery} onChange={setVarQuery} placeholder="Buscar variable..." />
            <VarChipList vars={filteredVars} activeIds={activeVarIds} onToggle={onToggleVar} />
          </div>
        </>
      )}
    </aside>
  );
}
