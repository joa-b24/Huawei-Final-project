export const MAX_COMPARISON_GROUPS = 3;
export const GROUP_COLORS = ["#64748b", "#059669", "#7c3aed", "#dc2626", "#0891b2"];

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
  function toggle(g: string) {
    onGroupsChange(
      groups.includes(g)
        ? groups.filter((x) => x !== g)
        : groups.length < MAX_COMPARISON_GROUPS
        ? [...groups, g]
        : groups
    );
  }

  function GroupDot({ groupId }: { groupId: string }) {
    const color = groupColorMap.get(groupId);
    if (!color) return null;
    return <span className="comparison-group-dot" style={{ background: color }} />;
  }

  const stateGroups = groups.filter((g) => g !== "nacional" && !g.startsWith("r:") && !g.startsWith("c:"));
  const availableStates = allStateNames.filter((s) => s !== primaryState && !groups.includes(s));

  return (
    <div className="comparison-group-selector">
      <label className="comparison-group-option">
        <input
          type="checkbox"
          checked={groups.includes("nacional")}
          onChange={() => toggle("nacional")}
          disabled={groups.includes("nacional") && groups.length === 1}
        />
        <span>Nacional</span>
      </label>

      {regionGroupId && (
        <label className="comparison-group-option">
          <input
            type="checkbox"
            checked={groups.includes(regionGroupId)}
            onChange={() => toggle(regionGroupId)}
            disabled={!groups.includes(regionGroupId) && groups.length >= MAX_COMPARISON_GROUPS}
          />
          {groups.includes(regionGroupId) && <GroupDot groupId={regionGroupId} />}
          <span>Región {regionGroupId.slice(2)}</span>
        </label>
      )}

      {primaryClusterGroupId && (
        <label className="comparison-group-option">
          <input
            type="checkbox"
            checked={groups.includes(primaryClusterGroupId)}
            onChange={() => toggle(primaryClusterGroupId)}
            disabled={!groups.includes(primaryClusterGroupId) && groups.length >= MAX_COMPARISON_GROUPS}
          />
          {groups.includes(primaryClusterGroupId) && <GroupDot groupId={primaryClusterGroupId} />}
          <span>{primaryClusterLabel}</span>
        </label>
      )}

      <div className="comparison-state-picker">
        <select
          className="comparison-select comparison-select--sm"
          value=""
          onChange={(e) => {
            const s = e.target.value;
            if (s && !groups.includes(s) && groups.length < MAX_COMPARISON_GROUPS) {
              onGroupsChange([...groups, s]);
            }
          }}
          disabled={groups.length >= MAX_COMPARISON_GROUPS}
        >
          <option value="">+ Estado…</option>
          {availableStates.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {stateGroups.map((s) => {
          const color = groupColorMap.get(s);
          return (
            <span
              key={s}
              className="comparison-state-chip"
              style={color ? { background: `color-mix(in srgb, ${color} 15%, transparent)`, color, borderColor: `color-mix(in srgb, ${color} 40%, transparent)` } : undefined}
            >
              {color && <span className="comparison-group-dot" style={{ background: color }} />}
              {s}
              <button type="button" onClick={() => toggle(s)} style={color ? { color } : undefined}>×</button>
            </span>
          );
        })}
      </div>
    </div>
  );
}
