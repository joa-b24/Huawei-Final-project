import { useMemo, useState } from "react";
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
import { GROUP_COLORS, NACIONAL_COLOR } from "../sidebar/ComparisonGroupSelector";
import ChartWrapper from "./ChartWrapper";

const PRIMARY_COLOR = "#1d4ed8";

function wrapText(text: string, maxCharsPerLine: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let i = 0;
  while (i < words.length && lines.length < maxLines) {
    let line = words[i];
    i++;
    while (i < words.length && `${line} ${words[i]}`.length <= maxCharsPerLine) {
      line += ` ${words[i]}`;
      i++;
    }
    const isLastLine = lines.length === maxLines - 1;
    if (isLastLine && i < words.length) {
      line = line.length <= maxCharsPerLine - 1 ? `${line}…` : `${line.slice(0, maxCharsPerLine - 1)}…`;
    }
    lines.push(line);
  }
  return lines;
}

function RadarAxisTick({
  x, y, payload, textAnchor,
}: {
  x?: number; y?: number; payload?: { value?: string }; textAnchor?: "end" | "start" | "middle" | "inherit";
}) {
  const lines = wrapText(payload?.value ?? "", 25, 2);
  const lineH = 13;
  const offsetY = -((lines.length - 1) * lineH) / 2;
  return (
    <text x={x} y={y} textAnchor={textAnchor} fill="var(--text-3)" fontSize={11}>
      {lines.map((line, i) => (
        <tspan key={i} x={x} dy={i === 0 ? offsetY : lineH}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

function BarAxisTick({ x, y, payload }: { x?: number; y?: number; payload?: { value?: string } }) {
  const lines = wrapText(payload?.value ?? "", 25, 2);
  return (
    <text x={x} y={(y ?? 0) + 6} textAnchor="middle" fill="var(--text-3)" fontSize={10}>
      {lines.map((line, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : 12}>{line}</tspan>
      ))}
    </text>
  );
}

type Props = {
  primaryState: string | null;
  stateRegion: string | null;
  variables: { id: string; label: string; unit?: string }[];
  normalizedMap: Map<string, Record<string, number | null>>;
  rawMap?: Map<string, Record<string, number | null>>;
  nationalValues: Record<string, number | null>;
  stateRegionMap: Record<string, string>;
  pcaResults?: PcaResults | null;
  groups: string[];
  panelTitle?: string;
  tooltip?: React.ReactNode;
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
  pcaResults,
  groups,
  panelTitle,
  tooltip,
}: Props) {
  const [view, setView] = useState<"radar" | "barras">("radar");

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
    const nonNacional = groups.filter((g) => g !== "nacional");
    return groups.map((g) => ({
      id: g,
      label: getGroupLabel(g),
      color: g === "nacional"
        ? NACIONAL_COLOR
        : GROUP_COLORS[nonNacional.indexOf(g)] ?? GROUP_COLORS[GROUP_COLORS.length - 1],
    }));
  }

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
    const shortLabel = v.label.length > 50 ? v.label.slice(0, 50) + "…" : v.label;
    const entry: Record<string, string | number> = { axis: shortLabel, varId: v.id };
    entry[primaryState] = primaryValues[v.id] ?? 0;
    for (const g of groupDefs) entry[g.label] = getGroupValues(g.id)[v.id] ?? 0;
    return entry;
  });

  // Tabla radar (variables como filas, estados como columnas — para vista lado-a-lado)
  const downloadTableData = variables.map((v) => {
    const label = v.label.length > 50 ? v.label.slice(0, 50) + "…" : v.label;
    const unit = v.unit ?? "";
    const fmt = (raw: number | null): string => (raw !== null ? fmtRaw(raw, unit) : "—");
    const row: Record<string, string> = { Variable: label };
    row[primaryState] = fmt(rawMap?.get(primaryState)?.[v.id] ?? null);
    for (const g of groupDefs) row[g.label] = fmt(getRawValueByName(g.label, v.id));
    return row;
  });

  // Tabla barras (transpuesta: estados/grupos como filas, variables como columnas)
  const downloadTableDataBars = (() => {
    const colLabel = (v: { label: string }) =>
      v.label.length > 18 ? v.label.slice(0, 17) + "…" : v.label;
    const rows: Array<Record<string, string>> = [];
    const entities = [{ id: primaryState, label: primaryState }, ...groupDefs.map((g) => ({ id: g.id, label: g.label }))];
    for (const entity of entities) {
      const row: Record<string, string> = { "Estado/Grupo": entity.label };
      for (const v of variables) {
        const unit = v.unit ?? "";
        const fmt = (raw: number | null): string => (raw !== null ? fmtRaw(raw, unit) : "—");
        const raw = entity.id === primaryState
          ? (rawMap?.get(primaryState)?.[v.id] ?? null)
          : getRawValueByName(entity.label, v.id);
        row[colLabel(v)] = fmt(raw);
      }
      rows.push(row);
    }
    return rows;
  })();

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

  function renderLegend({ payload }: { payload?: Array<{ value?: string; color?: string }> }) {
    if (!payload?.length) return null;
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 20px", padding: "8px 0 0 40px" }}>
        {payload.map((entry, i) => {
          const label = entry.value ?? "";
          const color = entry.color ?? "#6b7280";
          const isPrimary = label === primaryState;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ display: "block", width: 20, height: 2.5, background: color, borderRadius: 2, flexShrink: 0 }} />
              <span>
                <p style={{ margin: 0, fontSize: 12, fontWeight: isPrimary ? 700 : 500, color: "var(--text-1)", lineHeight: 1.25 }}>
                  {label}
                </p>
                {isPrimary && (
                  <p style={{ margin: 0, fontSize: 10, color: "var(--text-3)", lineHeight: 1 }}>Estado seleccionado</p>
                )}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  const togglePill = (
    <div
      className="toggle-pill"
      role="group"
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") setView("radar");
        if (e.key === "ArrowRight") setView("barras");
      }}
    >
      <button type="button" className={`toggle-pill__btn${view === "radar" ? " active" : ""}`} onClick={() => setView("radar")}>Radar</button>
      <button type="button" className={`toggle-pill__btn${view === "barras" ? " active" : ""}`} onClick={() => setView("barras")}>Barras</button>
    </div>
  );

  return (
    <ChartWrapper
      panelTitle={panelTitle}
      tooltip={tooltip}
      title={primaryState ?? "Sin estado"}
      description="Percentil 0–100 normalizado sobre los 32 estados. En variables de polaridad negativa la escala se invierte."
      chartType={view === "radar" ? "Radar" : "Barras comparativas"}
      headerActions={togglePill}
      downloadTableData={view === "barras" ? downloadTableDataBars : downloadTableData}
      tableLayout="below"
    >
      {view === "radar" ? (
        <div className="chart-rc-wrap" style={{ height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={chartData} margin={{ top: 10, right: 40, bottom: 10, left: 40 }}>
            <PolarGrid stroke="var(--border)" />
            <PolarAngleAxis dataKey="axis" tick={<RadarAxisTick />} />
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
            <Legend content={renderLegend} />
            <Tooltip content={renderTooltip} />
          </RadarChart>
        </ResponsiveContainer>
        </div>
      ) : (
        <div className="chart-rc-wrap" style={{ height: Math.max(240, variables.length * 52) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            barCategoryGap="25%"
            margin={{ top: 4, right: 16, bottom: 8, left: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="axis"
              tick={<BarAxisTick />}
              tickLine={false}
              axisLine={false}
              interval={0}
              height={44}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: "var(--text-3)" }}
              axisLine={false}
              tickLine={false}
              unit=" pts"
            />
            <Tooltip content={renderTooltip} />
            <Legend content={renderLegend} verticalAlign="top" wrapperStyle={{ paddingBottom: 12 }} />
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
        </div>
      )}
    </ChartWrapper>
  );
}
