import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import EmptyState from "../EmptyState";

const PRIMARY_COLOR = "#1d4ed8";
const GROUP_COLORS = ["#f59e0b", "#059669", "#7c3aed", "#dc2626", "#0891b2"];

const MAX_GROUPS = 3;

type Props = {
  primaryState: string | null;
  stateRegion: string | null;
  variables: { id: string; label: string }[];
  normalizedMap: Map<string, Record<string, number | null>>;
  nationalValues: Record<string, number | null>;
  stateRegionMap: Record<string, string>;
  allStateNames: string[];
};

type GroupDef = { id: string; label: string; color: string };

export default function ComparisonRadarChart({
  primaryState,
  stateRegion,
  variables,
  normalizedMap,
  nationalValues,
  stateRegionMap,
  allStateNames,
}: Props) {
  const [view, setView] = useState<"radar" | "barras">("radar");
  const [groups, setGroups] = useState<string[]>(["nacional"]);

  useEffect(() => {
    setGroups(["nacional"]);
  }, [primaryState]);

  const regionGroupId = stateRegion ? `r:${stateRegion}` : null;

  const regionValues = useMemo(() => {
    if (!stateRegion) return {};
    const regionStates = Object.entries(stateRegionMap)
      .filter(([, r]) => r === stateRegion)
      .map(([s]) => s);
    const result: Record<string, number> = {};
    for (const v of variables) {
      const vals = regionStates
        .map((s) => normalizedMap.get(s)?.[v.id])
        .filter((x): x is number => typeof x === "number");
      if (vals.length) result[v.id] = vals.reduce((a, b) => a + b, 0) / vals.length;
    }
    return result;
  }, [stateRegion, stateRegionMap, normalizedMap, variables]);

  function getGroupValues(g: string): Record<string, number> {
    if (g === "nacional")
      return Object.fromEntries(
        Object.entries(nationalValues).map(([k, v]) => [k, v ?? 0])
      );
    if (g.startsWith("r:")) return regionValues;
    return Object.fromEntries(
      Object.entries(normalizedMap.get(g) ?? {}).map(([k, v]) => [k, v ?? 0])
    );
  }

  function getGroupLabel(g: string): string {
    if (g === "nacional") return "Nacional";
    if (g.startsWith("r:")) return `Región ${g.slice(2)}`;
    return g;
  }

  function buildGroupDefs(): GroupDef[] {
    return groups.map((g, i) => ({
      id: g,
      label: getGroupLabel(g),
      color: GROUP_COLORS[i] ?? GROUP_COLORS[GROUP_COLORS.length - 1],
    }));
  }

  function toggleGroup(g: string) {
    setGroups((prev) =>
      prev.includes(g)
        ? prev.filter((x) => x !== g)
        : prev.length < MAX_GROUPS
        ? [...prev, g]
        : prev
    );
  }

  const stateGroups = groups.filter((g) => g !== "nacional" && !g.startsWith("r:"));
  const availableStateOptions = allStateNames.filter(
    (s) => s !== primaryState && !groups.includes(s)
  );

  if (!variables.length || !primaryState) {
    return (
      <EmptyState
        title="Sin datos"
        description="Selecciona un estado y activa al menos una variable."
      />
    );
  }

  const primaryValues = normalizedMap.get(primaryState) ?? {};
  const groupDefs = buildGroupDefs();

  const chartData = variables.map((v) => {
    const shortLabel = v.label.length > 26 ? v.label.slice(0, 26) + "…" : v.label;
    const entry: Record<string, string | number> = { axis: shortLabel };
    entry[primaryState] = primaryValues[v.id] ?? 0;
    for (const g of groupDefs) entry[g.label] = getGroupValues(g.id)[v.id] ?? 0;
    return entry;
  });

  return (
    <div>
      {/* Group selector */}
      <div className="comparison-group-selector">
        <label className="comparison-group-option">
          <input
            type="checkbox"
            checked={groups.includes("nacional")}
            onChange={() => toggleGroup("nacional")}
            disabled={groups.includes("nacional") && groups.length === 1}
          />
          <span>Nacional</span>
        </label>

        {regionGroupId && (
          <label className="comparison-group-option">
            <input
              type="checkbox"
              checked={groups.includes(regionGroupId)}
              onChange={() => toggleGroup(regionGroupId)}
              disabled={!groups.includes(regionGroupId) && groups.length >= MAX_GROUPS}
            />
            <span>Región {stateRegion}</span>
          </label>
        )}

        <div className="comparison-state-picker">
          <select
            className="comparison-select comparison-select--sm"
            value=""
            onChange={(e) => {
              const s = e.target.value;
              if (s && !groups.includes(s) && groups.length < MAX_GROUPS) {
                setGroups((prev) => [...prev, s]);
              }
            }}
            disabled={groups.length >= MAX_GROUPS}
          >
            <option value="">+ Estado…</option>
            {availableStateOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {stateGroups.map((s) => (
            <span key={s} className="comparison-state-chip">
              {s}
              <button type="button" onClick={() => toggleGroup(s)}>
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Toggle pill */}
      <div className="toggle-pill" role="group" style={{ marginBottom: 16 }}>
        <button
          type="button"
          className={`toggle-pill__btn${view === "radar" ? " active" : ""}`}
          onClick={() => setView("radar")}
        >
          Radar
        </button>
        <button
          type="button"
          className={`toggle-pill__btn${view === "barras" ? " active" : ""}`}
          onClick={() => setView("barras")}
        >
          Barras
        </button>
      </div>

      {view === "radar" ? (
        <ResponsiveContainer width="100%" height={320}>
          <RadarChart data={chartData} margin={{ top: 10, right: 40, bottom: 10, left: 40 }}>
            <PolarGrid stroke="var(--border)" />
            <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fill: "var(--text-3)" }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
            <Radar
              name={primaryState}
              dataKey={primaryState}
              stroke={PRIMARY_COLOR}
              fill={PRIMARY_COLOR}
              fillOpacity={0.18}
              strokeWidth={2}
            />
            {groupDefs.map((g) => (
              <Radar
                key={g.id}
                name={g.label}
                dataKey={g.label}
                stroke={g.color}
                fill={g.color}
                fillOpacity={0.08}
                strokeDasharray={g.id === "nacional" ? "5 4" : undefined}
                strokeWidth={g.id === "nacional" ? 1.5 : 2}
              />
            ))}
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number) => `${(+v).toFixed(1)} pts`} />
          </RadarChart>
        </ResponsiveContainer>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(240, variables.length * 52)}>
          <BarChart
            data={chartData}
            barCategoryGap="25%"
            margin={{ top: 4, right: 16, bottom: 64, left: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="axis"
              tick={{ fontSize: 10, fill: "var(--text-3)" }}
              angle={-30}
              textAnchor="end"
              interval={0}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: "var(--text-3)" }}
              axisLine={false}
              tickLine={false}
              unit=" pts"
            />
            <Tooltip formatter={(v: number, name: string) => [`${(+v).toFixed(1)} pts`, name]} />
            <Legend verticalAlign="top" wrapperStyle={{ fontSize: 12, paddingBottom: 12 }} />
            <Bar
              dataKey={primaryState}
              fill={PRIMARY_COLOR}
              isAnimationActive={false}
              radius={[2, 2, 0, 0]}
            />
            {groupDefs.map((g) => (
              <Bar
                key={g.id}
                dataKey={g.label}
                fill={g.color}
                isAnimationActive={false}
                radius={[2, 2, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
