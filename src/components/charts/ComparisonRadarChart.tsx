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
  type TooltipProps,
} from "recharts";
import EmptyState from "../EmptyState";
import type { PcaResults } from "../../services/DataService";

const PRIMARY_COLOR = "#1d4ed8";
const GROUP_COLORS = ["#64748b", "#059669", "#7c3aed", "#dc2626", "#0891b2"];

const MAX_GROUPS = 3;

type Props = {
  primaryState: string | null;
  stateRegion: string | null;
  variables: { id: string; label: string; unit?: string }[];
  normalizedMap: Map<string, Record<string, number | null>>;
  rawMap?: Map<string, Record<string, number | null>>;
  nationalValues: Record<string, number | null>;
  stateRegionMap: Record<string, string>;
  allStateNames: string[];
  pcaResults?: PcaResults | null;
};

function fmtRaw(v: number, unit: string): string {
  const u = unit.trim();
  if (u === "%" || u.endsWith("%")) return `${v.toFixed(1)}%`;
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(2)} M${u ? ` ${u}` : ""}`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)} K${u ? ` ${u}` : ""}`;
  return `${Number.isInteger(v) ? v : v.toFixed(2)}${u ? ` ${u}` : ""}`;
}

type GroupDef = { id: string; label: string; color: string };

export default function ComparisonRadarChart({
  primaryState,
  stateRegion,
  variables,
  normalizedMap,
  rawMap,
  nationalValues,
  stateRegionMap,
  allStateNames,
  pcaResults,
}: Props) {
  const [view, setView] = useState<"radar" | "barras">("radar");
  const [groups, setGroups] = useState<string[]>(["nacional"]);

  useEffect(() => {
    setGroups(["nacional"]);
  }, [primaryState]);

  const regionGroupId = stateRegion ? `r:${stateRegion}` : null;

  const primaryPcaRecord = useMemo(
    () => pcaResults?.records.find((r) => r.state === primaryState) ?? null,
    [pcaResults, primaryState]
  );
  const primaryClusterGroupId =
    primaryPcaRecord !== null ? `c:${primaryPcaRecord.cluster}` : null;
  const primaryClusterLabel =
    primaryPcaRecord !== null
      ? (pcaResults?.cluster_stats[String(primaryPcaRecord.cluster)]?.label ??
        `Cluster ${primaryPcaRecord.cluster}`)
      : null;

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

  function getClusterValues(clusterId: number): Record<string, number> {
    const clusterStates = pcaResults?.cluster_stats[String(clusterId)]?.states ?? [];
    const result: Record<string, number> = {};
    for (const v of variables) {
      const vals = clusterStates
        .map((s) => normalizedMap.get(s)?.[v.id])
        .filter((x): x is number => typeof x === "number");
      if (vals.length) result[v.id] = vals.reduce((a, b) => a + b, 0) / vals.length;
    }
    return result;
  }

  function getGroupValues(g: string): Record<string, number> {
    if (g === "nacional")
      return Object.fromEntries(
        Object.entries(nationalValues).map(([k, v]) => [k, v ?? 0])
      );
    if (g.startsWith("r:")) return regionValues;
    if (g.startsWith("c:")) return getClusterValues(parseInt(g.slice(2), 10));
    return Object.fromEntries(
      Object.entries(normalizedMap.get(g) ?? {}).map(([k, v]) => [k, v ?? 0])
    );
  }

  function getGroupLabel(g: string): string {
    if (g === "nacional") return "Nacional";
    if (g.startsWith("r:")) return `Región ${g.slice(2)}`;
    if (g.startsWith("c:")) {
      const id = parseInt(g.slice(2), 10);
      return pcaResults?.cluster_stats[String(id)]?.label ?? `Cluster ${id}`;
    }
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
    const entry: Record<string, string | number> = { axis: shortLabel, varId: v.id };
    entry[primaryState] = primaryValues[v.id] ?? 0;
    for (const g of groupDefs) entry[g.label] = getGroupValues(g.id)[v.id] ?? 0;
    return entry;
  });

  function getRawValueByName(name: string, varId: string): number | null {
    if (!rawMap) return null;
    if (rawMap.has(name)) return rawMap.get(name)?.[varId] ?? null;
    if (name === "Nacional") {
      const vals = [...rawMap.values()].map((m) => m[varId]).filter((v): v is number => typeof v === "number");
      return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
    }
    if (name.startsWith("Región ")) {
      const region = name.slice("Región ".length);
      const states = Object.entries(stateRegionMap).filter(([, r]) => r === region).map(([s]) => s);
      const vals = states.map((s) => rawMap?.get(s)?.[varId]).filter((v): v is number => typeof v === "number");
      return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
    }
    const clusterStat = Object.values(pcaResults?.cluster_stats ?? {}).find(
      (cs) => cs.label === name
    );
    if (clusterStat) {
      const vals = clusterStat.states
        .map((s) => rawMap?.get(s)?.[varId])
        .filter((v): v is number => typeof v === "number");
      return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
    }
    return null;
  }

  function renderTooltip({ payload }: TooltipProps<number, string>) {
    if (!payload?.length) return null;
    const varId = payload[0]?.payload?.varId as string | undefined;
    const varMeta = variables.find((v) => v.id === varId);
    const unit = varMeta?.unit ?? "";
    return (
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "8px 12px", fontSize: 12, minWidth: 200 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>{varMeta?.label ?? varId}</div>
        {payload.map((p) => {
          const name = p.name ?? "";
          const normVal = p.value ?? 0;
          const rawVal = varId ? getRawValueByName(name, varId) : null;
          return (
            <div key={name} style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 2 }}>
              <span><span style={{ color: p.color ?? p.fill }}>■ </span>{name}</span>
              <span style={{ textAlign: "right" }}>
                {rawVal !== null ? <strong>{fmtRaw(rawVal, unit)}</strong> : <em style={{ color: "var(--text-3)" }}>—</em>}
                <span style={{ color: "var(--text-3)", marginLeft: 6 }}>({normVal.toFixed(0)} pts)</span>
              </span>
            </div>
          );
        })}
      </div>
    );
  }

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

        {primaryClusterGroupId && (
          <label className="comparison-group-option">
            <input
              type="checkbox"
              checked={groups.includes(primaryClusterGroupId)}
              onChange={() => toggleGroup(primaryClusterGroupId)}
              disabled={
                !groups.includes(primaryClusterGroupId) && groups.length >= MAX_GROUPS
              }
            />
            <span>{primaryClusterLabel}</span>
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
      <div
        className="toggle-pill"
        role="group"
        style={{ marginBottom: 16 }}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") setView("radar");
          if (e.key === "ArrowRight") setView("barras");
        }}
      >
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
            <Tooltip content={renderTooltip} />
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
            <Tooltip content={renderTooltip} />
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
