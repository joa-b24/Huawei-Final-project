import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAppContext } from "../context/AppContext";
import type { AppData } from "../services/DataService";
import EmptyState from "../components/EmptyState";
import type { TerritorialWideRecord } from "../types/dataStandard";

type ChartRow = { anio: number } & Record<string, number>;

function buildChartData(historical: TerritorialWideRecord[], varId: string): ChartRow[] {
  const byYear = new Map<number, ChartRow>();
  for (const rec of historical) {
    const val = rec.metrics[varId];
    if (val === undefined || isNaN(val)) continue;
    if (!byYear.has(rec.anio)) byYear.set(rec.anio, { anio: rec.anio });
    byYear.get(rec.anio)![rec.estado] = val;
  }
  return Array.from(byYear.values()).sort((a, b) => a.anio - b.anio);
}

type TooltipProps = {
  active?: boolean;
  payload?: { dataKey: string; value: number }[];
  label?: number;
  primaryState: string | null;
  varUnit: string;
};

function EvolucionTooltip({ active, payload, label, primaryState, varUnit }: TooltipProps) {
  if (!active || !payload?.length) return null;

  const valid = payload.filter((p) => p.value !== undefined && !isNaN(p.value));
  const sorted = [...valid].sort((a, b) => b.value - a.value);
  const primaryEntry = valid.find((p) => p.dataKey === primaryState);
  const topEntry = sorted[0];
  const bottomEntry = sorted[sorted.length - 1];

  const fmt = (v: number) =>
    varUnit === "%" ? `${v.toFixed(2)}%` : v.toLocaleString("es-MX", { maximumFractionDigits: 2 });

  return (
    <div className="evolucion-tooltip">
      <p className="evolucion-tooltip__year">Año {label}</p>
      {primaryEntry && (
        <p className="evolucion-tooltip__primary">
          <span className="evolucion-tooltip__dot evolucion-tooltip__dot--primary" />
          {primaryState}: <strong>{fmt(primaryEntry.value)}</strong>
        </p>
      )}
      {topEntry && topEntry.dataKey !== primaryState && (
        <p className="evolucion-tooltip__row">
          <span className="evolucion-tooltip__dot" />↑ {topEntry.dataKey}: {fmt(topEntry.value)}
        </p>
      )}
      {bottomEntry &&
        bottomEntry.dataKey !== primaryState &&
        bottomEntry.dataKey !== topEntry?.dataKey && (
          <p className="evolucion-tooltip__row">
            <span className="evolucion-tooltip__dot" />↓ {bottomEntry.dataKey}: {fmt(bottomEntry.value)}
          </p>
        )}
    </div>
  );
}

type Props = { appData: AppData };

export default function EvolucionTab({ appData }: Props) {
  const { state: appState } = useAppContext();
  const { primaryState, activeVariableIds } = appState;
  const { historical, dataset } = appData;

  const [selectedVarId, setSelectedVarId] = useState<string | null>(null);
  const varId =
    selectedVarId && activeVariableIds.includes(selectedVarId)
      ? selectedVarId
      : activeVariableIds[0] ?? null;

  const varMeta = useMemo(
    () => dataset.metricCatalog.find((m) => m.id === varId),
    [dataset.metricCatalog, varId]
  );
  const varUnit = varMeta?.unit ?? "";

  const states = useMemo(
    () => [...new Set(historical.map((r) => r.estado))].sort(),
    [historical]
  );

  const chartData = useMemo(
    () => (varId && historical.length ? buildChartData(historical, varId) : []),
    [historical, varId]
  );

  const primaryTrend = useMemo(() => {
    if (!primaryState || !chartData.length) return null;
    const points = chartData
      .map((d) => ({ anio: d.anio, value: d[primaryState] as number | undefined }))
      .filter((d): d is { anio: number; value: number } =>
        d.value !== undefined && !isNaN(d.value)
      );
    if (points.length < 2) return null;
    return { start: points[0], end: points[points.length - 1] };
  }, [chartData, primaryState]);

  if (!activeVariableIds.length) {
    return (
      <EmptyState
        title="Sin variables activas"
        description="Selecciona al menos una variable en el panel lateral para ver series de tiempo."
      />
    );
  }

  if (!historical.length) {
    return (
      <div className="panel" style={{ textAlign: "center", color: "var(--text-3)", padding: 32 }}>
        <p style={{ margin: "0 0 6px" }}>No hay datos históricos disponibles.</p>
        <p style={{ fontSize: 13, margin: 0 }}>
          Las series de tiempo se generarán a partir de{" "}
          <code>historical_state.json</code>.
        </p>
      </div>
    );
  }

  const delta = primaryTrend
    ? primaryTrend.end.value - primaryTrend.start.value
    : null;
  const fmt = (v: number) =>
    varUnit === "%" ? `${v.toFixed(2)}%` : v.toLocaleString("es-MX", { maximumFractionDigits: 2 });

  return (
    <div>
      {activeVariableIds.length > 1 && (
        <div className="var-pill-row">
          {activeVariableIds.map((id) => {
            const label = dataset.metricCatalog.find((m) => m.id === id)?.label ?? id;
            return (
              <button
                key={id}
                className={`var-pill${id === varId ? " var-pill--active" : ""}`}
                onClick={() => setSelectedVarId(id)}
                type="button"
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      <div className="panel" style={{ marginTop: activeVariableIds.length > 1 ? 0 : undefined }}>
        <div className="panel-title-row">
          <h3 className="panel-title" style={{ margin: 0 }}>
            {varMeta?.label ?? varId ?? "Variable"}
          </h3>
          {varUnit && (
            <span style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 400 }}>
              ({varUnit})
            </span>
          )}
        </div>

        <ResponsiveContainer width="100%" height={360}>
          <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="anio"
              tick={{ fontSize: 12, fill: "var(--text-2)" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "var(--text-2)" }}
              tickLine={false}
              axisLine={false}
              width={56}
              tickFormatter={(v: number) =>
                varUnit === "%" ? `${v}%` : v.toLocaleString("es-MX")
              }
            />
            <Tooltip
              content={(props) => (
                <EvolucionTooltip
                  {...(props as any)}
                  primaryState={primaryState}
                  varUnit={varUnit}
                />
              )}
            />
            {states.map((estado) => (
              <Line
                key={estado}
                type="monotone"
                dataKey={estado}
                stroke={estado === primaryState ? "var(--blue)" : "var(--border)"}
                strokeWidth={estado === primaryState ? 2.5 : 1}
                dot={
                  estado === primaryState
                    ? { r: 3, fill: "var(--blue)", strokeWidth: 0 }
                    : false
                }
                activeDot={estado === primaryState ? { r: 5 } : { r: 0 }}
                opacity={estado === primaryState ? 1 : 0.7}
                isAnimationActive={false}
                connectNulls
                legendType="none"
              />
            ))}
          </LineChart>
        </ResponsiveContainer>

        {primaryTrend && delta !== null && (
          <div className="evolucion-trend">
            <span className="evolucion-trend__state">{primaryState}</span>
            <span
              className="evolucion-trend__delta"
              style={{ color: delta >= 0 ? "var(--green)" : "var(--red)" }}
            >
              {delta >= 0 ? "+" : ""}
              {fmt(delta)}
            </span>
            <span className="evolucion-trend__range">
              {fmt(primaryTrend.start.value)} ({primaryTrend.start.anio}) →{" "}
              {fmt(primaryTrend.end.value)} ({primaryTrend.end.anio})
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
