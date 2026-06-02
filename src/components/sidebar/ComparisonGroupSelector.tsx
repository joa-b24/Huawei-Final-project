import { useState, useRef, useEffect } from "react";

export const MAX_COMPARISON_GROUPS = 3;
export const GROUP_COLORS = ["#64748b", "#059669", "#7c3aed", "#dc2626", "#0891b2"];
export const NACIONAL_COLOR = "#94a3b8";

type Props = {
  groups: string[];
  onGroupsChange: (groups: string[]) => void;
  regionGroupId: string | null;
  primaryClusterGroupId: string | null;
  primaryClusterLabel: string | null;
  primaryState?: string | null;
  allStateNames: string[];
  groupColorMap: Map<string, string>;
};

type RowProps = {
  groupId: string;
  label: string;
  color: string;
  isOn: boolean;
  isDisabled: boolean;
  onToggle: () => void;
};

function ToggleRow({ groupId: _groupId, label, color, isOn, isDisabled, onToggle }: RowProps) {
  const dotColor = isOn ? color : "#d1d5db";
  return (
    <div
      className={`cg-row${isDisabled ? " cg-row--dim" : ""}`}
      onClick={() => !isDisabled && onToggle()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" && !isDisabled) onToggle(); }}
    >
      <span className="cg-dot" style={{ background: dotColor }} />
      <span className="cg-label">{label}</span>
      <span
        className={`cg-toggle${isOn ? " on" : ""}`}
        style={isOn ? { background: color } : undefined}
        role="switch"
        aria-checked={isOn}
      />
    </div>
  );
}

export default function ComparisonGroupSelector({
  groups,
  onGroupsChange,
  regionGroupId,
  primaryClusterGroupId,
  primaryClusterLabel,
  primaryState,
  allStateNames,
  groupColorMap,
}: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const addRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!addOpen) return;
    function handleClick(e: MouseEvent) {
      if (addRef.current && !addRef.current.contains(e.target as Node)) {
        setAddOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [addOpen]);

  function toggle(g: string) {
    onGroupsChange(
      groups.includes(g)
        ? groups.filter((x) => x !== g)
        : groups.length < MAX_COMPARISON_GROUPS
        ? [...groups, g]
        : groups
    );
  }

  const stateGroups = groups.filter((g) => g !== "nacional" && !g.startsWith("r:") && !g.startsWith("c:"));
  const availableStates = allStateNames.filter((s) => s !== primaryState && !groups.includes(s));
  const atMax = groups.length >= MAX_COMPARISON_GROUPS;

  return (
    <div className="cg-list">
      <ToggleRow
        groupId="nacional"
        label="Nacional"
        color={NACIONAL_COLOR}
        isOn={groups.includes("nacional")}
        isDisabled={groups.includes("nacional") && groups.length === 1}
        onToggle={() => toggle("nacional")}
      />

      {regionGroupId && (
        <ToggleRow
          groupId={regionGroupId}
          label={`Región ${regionGroupId.slice(2)}`}
          color={groupColorMap.get(regionGroupId) ?? GROUP_COLORS[0]}
          isOn={groups.includes(regionGroupId)}
          isDisabled={!groups.includes(regionGroupId) && atMax}
          onToggle={() => toggle(regionGroupId)}
        />
      )}

      {primaryClusterGroupId && (
        <ToggleRow
          groupId={primaryClusterGroupId}
          label={primaryClusterLabel ?? `Cluster ${primaryClusterGroupId.slice(2)}`}
          color={groupColorMap.get(primaryClusterGroupId) ?? GROUP_COLORS[1]}
          isOn={groups.includes(primaryClusterGroupId)}
          isDisabled={!groups.includes(primaryClusterGroupId) && atMax}
          onToggle={() => toggle(primaryClusterGroupId)}
        />
      )}

      {stateGroups.map((s) => (
        <ToggleRow
          key={s}
          groupId={s}
          label={s}
          color={groupColorMap.get(s) ?? GROUP_COLORS[2]}
          isOn={true}
          isDisabled={false}
          onToggle={() => toggle(s)}
        />
      ))}

      <div className="cg-add" ref={addRef}>
        <button
          type="button"
          className={`cg-add-btn${atMax ? " disabled" : ""}`}
          disabled={atMax}
          onClick={() => !atMax && setAddOpen((v) => !v)}
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
            <path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Agregar estado
        </button>
        {addOpen && !atMax && (
          <div className="cg-add-dropdown">
            {availableStates.length === 0 ? (
              <p className="cg-add-empty">Sin estados disponibles</p>
            ) : (
              availableStates.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="cg-add-option"
                  onMouseDown={() => {
                    if (!groups.includes(s)) onGroupsChange([...groups, s]);
                    setAddOpen(false);
                  }}
                >
                  {s}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
