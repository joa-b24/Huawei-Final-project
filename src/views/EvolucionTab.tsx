import { useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAppContext } from "../context/AppContext";
import type { AppData } from "../services/DataService";
import EmptyState from "../components/EmptyState";
import InfoTooltip from "../components/feedback/InfoTooltip";
import TabNarrative from "../components/feedback/TabNarrative";
import { GROUP_COLORS, NACIONAL_COLOR } from "../components/sidebar/ComparisonGroupSelector";
import { humanizeVarId } from "../utils/humanize";

// ─── Types ────────────────────────────────────────────────────────────────────

type ChartRow = { anio: number } & Record<string, number | undefined>;

type TemporalRecord = { state_code: string; year: number; value: number };
type TemporalVarData = {
  variable_id: string;
  updated_at?: string;
  records: TemporalRecord[];
};

type OlsForecast = {
  slope: number;
  r2: number | null;
  forecast_year: number;
  forecast_value: number;
  trend_years: number[];
  trend_values: number[];
};

type LogisticForecast = {
  ceiling: number;
  gap: number;
  inflection_year: number;
  passed_inflection: boolean;
  velocity: string;
  velocity_label: string;
} | null;

type StateForecast = {
  ols: OlsForecast;
  holt: { year: number; value: number }[];
  logistic: LogisticForecast;
};

type ForecastData = {
  variable_id: string;
  states: Record<string, StateForecast>;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildChartData(
  varData: TemporalVarData,
  forecastData: ForecastData | null,
  codeToEstado: Record<string, string>,
  primaryState: string | null,
  showNacional: boolean
): ChartRow[] {
  const byYear = new Map<number, ChartRow>();
  const yearValues = new Map<number, number[]>();

  for (const r of varData.records) {
    const estado = codeToEstado[r.state_code] ?? r.state_code;
    if (isNaN(r.value)) continue;
    if (!byYear.has(r.year)) byYear.set(r.year, { anio: r.year });
    byYear.get(r.year)![estado] = r.value;
    if (showNacional) {
      if (!yearValues.has(r.year)) yearValues.set(r.year, []);
      yearValues.get(r.year)!.push(r.value);
    }
  }

  if (showNacional) {
    for (const [year, values] of yearValues) {
      const mean = values.reduce((s, v) => s + v, 0) / values.length;
      byYear.get(year)!["__nacional__"] = mean;
    }
  }

  if (forecastData && primaryState) {
    const stateCode = Object.keys(forecastData.states).find(
      (k) => (codeToEstado[k] ?? k) === primaryState
    );
    if (stateCode) {
      const { ols, holt } = forecastData.states[stateCode];
      ols.trend_years.forEach((yr, i) => {
        if (!byYear.has(yr)) byYear.set(yr, { anio: yr });
        byYear.get(yr)!["__trend__"] = ols.trend_values[i];
      });
      const maxHistYear = Math.max(...varData.records.map((r) => r.year));
      holt.forEach(({ year, value }) => {
        if (year > maxHistYear) {
          if (!byYear.has(year)) byYear.set(year, { anio: year });
          byYear.get(year)!["__holt__"] = value;
        }
      });
    }
  }

  return Array.from(byYear.values()).sort((a, b) => a.anio - b.anio);
}

// ─── KPI strip ────────────────────────────────────────────────────────────────

function KpiCard({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div style={{ flex: 1, background: "var(--surface, #f8fafc)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", minWidth: 0 }}>
      <p style={{ fontSize: 11, color: "var(--text-3)", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</p>
      <p style={{ fontSize: 17, fontWeight: 700, color: color ?? "var(--text-1)", margin: 0, fontVariantNumeric: "tabular-nums" }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: "var(--text-3)", margin: "2px 0 0" }}>{sub}</p>}
    </div>
  );
}

function KpiStrip({
  lastValue, lastYear, delta, startYear, slope, r2, varUnit,
}: {
  lastValue: number;
  lastYear: number;
  delta: number;
  startYear: number;
  slope: number;
  r2: number | null;
  varUnit: string;
}) {
  const fmt = (v: number) =>
    varUnit === "%" ? `${v.toFixed(1)}%` : v.toLocaleString("es-MX", { maximumFractionDigits: 1 });

  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
      <KpiCard
        label={`Último valor (${lastYear})`}
        value={fmt(lastValue)}
      />
      <KpiCard
        label={`Variación ${startYear}–${lastYear}`}
        value={`${delta >= 0 ? "+" : ""}${fmt(delta)}${varUnit === "%" ? " pp" : ""}`}
        color={delta >= 0 ? "var(--green)" : "var(--red)"}
      />
      <KpiCard
        label="Pendiente OLS"
        value={`${slope >= 0 ? "+" : ""}${slope.toFixed(2)} pp/año`}
        sub={r2 != null ? `R² = ${r2.toFixed(2)}` : undefined}
      />
    </div>
  );
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function EvolucionTooltip({
  active, payload, label, primaryState, varUnit, groupStateColors, showNacional,
}: {
  active?: boolean;
  payload?: { dataKey: string; value: number }[];
  label?: number;
  primaryState: string | null;
  varUnit: string;
  groupStateColors: Map<string, string>;
  showNacional: boolean;
}) {
  if (!active || !payload?.length) return null;

  const fmt = (v: number) =>
    varUnit === "%" ? `${v.toFixed(2)}%` : v.toLocaleString("es-MX", { maximumFractionDigits: 2 });

  const SPECIAL = ["__trend__", "__holt__", "__nacional__"];
  const dataEntries = payload.filter(
    (p) => p.value !== undefined && !isNaN(p.value) && !SPECIAL.includes(p.dataKey)
  );
  const sorted = [...dataEntries].sort((a, b) => b.value - a.value);
  const primaryEntry = dataEntries.find((p) => p.dataKey === primaryState);
  const topEntry = sorted[0];
  const bottomEntry = sorted[sorted.length - 1];
  const trendEntry = payload.find((p) => p.dataKey === "__trend__");
  const holtEntry = payload.find((p) => p.dataKey === "__holt__");
  const nacionalEntry = payload.find((p) => p.dataKey === "__nacional__");
  const groupEntries = dataEntries.filter(
    (p) => p.dataKey !== primaryState && groupStateColors.has(p.dataKey)
  );

  return (
    <div className="evolucion-tooltip">
      <p className="evolucion-tooltip__year">Año {label}</p>
      {primaryEntry && (
        <p className="evolucion-tooltip__primary">
          <span className="evolucion-tooltip__dot evolucion-tooltip__dot--primary" />
          {primaryState}: <strong>{fmt(primaryEntry.value)}</strong>
        </p>
      )}
      {groupEntries.map((e) => (
        <p key={e.dataKey} className="evolucion-tooltip__row">
          <span
            className="evolucion-tooltip__dot"
            style={{ background: groupStateColors.get(e.dataKey) }}
          />
          {e.dataKey}: {fmt(e.value)}
        </p>
      ))}
      {showNacional && nacionalEntry && (
        <p className="evolucion-tooltip__row" style={{ color: NACIONAL_COLOR }}>
          Media nacional: {fmt(nacionalEntry.value)}
        </p>
      )}
      {!groupStateColors.size && topEntry && topEntry.dataKey !== primaryState && (
        <p className="evolucion-tooltip__row">
          <span className="evolucion-tooltip__dot" />↑ {topEntry.dataKey}: {fmt(topEntry.value)}
        </p>
      )}
      {!groupStateColors.size && bottomEntry && bottomEntry.dataKey !== primaryState && bottomEntry.dataKey !== topEntry?.dataKey && (
        <p className="evolucion-tooltip__row">
          <span className="evolucion-tooltip__dot" />↓ {bottomEntry.dataKey}: {fmt(bottomEntry.value)}
        </p>
      )}
      {trendEntry && (
        <p className="evolucion-tooltip__row" style={{ color: "var(--blue)", opacity: 0.7 }}>
          Tendencia OLS: {fmt(trendEntry.value)}
        </p>
      )}
      {holtEntry && (
        <p className="evolucion-tooltip__row" style={{ color: "#7c3aed" }}>
          Proyección Holt: {fmt(holtEntry.value)}
        </p>
      )}
    </div>
  );
}

// ─── S-Curve panel ───────────────────────────────────────────────────────────

const SCURVE_TOOLTIP = (
  <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--text-2)" }}>
    <p style={{ fontWeight: 700, margin: "0 0 4px", color: "var(--text-1)" }}>
      Curva S logística — modelo de adopción tecnológica
    </p>
    <p style={{ margin: "0 0 8px" }}>
      Ajusta la función <em>L / (1 + e<sup>-k(t-t₀)</sup>)</em> a la serie histórica.
    </p>
    <p style={{ margin: "0 0 4px", fontWeight: 600, color: "var(--text-1)" }}>Techo de saturación (L)</p>
    <p style={{ margin: "0 0 8px" }}>Máximo teórico de adopción bajo las condiciones actuales. No es una meta normativa.</p>
    <p style={{ margin: "0 0 4px", fontWeight: 600, color: "var(--text-1)" }}>Punto de inflexión (t₀)</p>
    <p style={{ margin: "0 0 8px" }}>Año de máxima aceleración: antes = crecimiento creciente, después = crecimiento decreciente hacia la saturación.</p>
    <p style={{ margin: "0 0 4px", fontWeight: 600, color: "var(--text-1)" }}>Velocidad de adopción (k)</p>
    <p style={{ margin: 0 }}>Pendiente de la curva. Alta (k&gt;0.6) ≈ ciclo completo en ~5 años · Media (k&gt;0.3) ≈ ~10 años · Lenta (k≤0.3) ≈ más de 10 años.</p>
  </div>
);

function SCurveInsights({
  logistic, varUnit, primaryState,
}: {
  logistic: LogisticForecast;
  varUnit: string;
  primaryState: string | null;
}) {
  if (!logistic) return null;

  const fmt = (v: number) =>
    varUnit === "%" ? `${v.toFixed(1)}%` : v.toLocaleString("es-MX", { maximumFractionDigits: 1 });

  const velocityColor =
    logistic.velocity === "Acelerada" ? "var(--green)" :
    logistic.velocity === "Moderada"  ? "var(--amber)" : "var(--text-3)";

  return (
    <div className="scurve-insights">
      <div className="scurve-insights__header">
        <p className="scurve-insights__title">Ciclo de adopción — {primaryState}</p>
        <InfoTooltip wide text={SCURVE_TOOLTIP} />
      </div>
      <div className="scurve-insights__grid">
        <div className="scurve-insights__item">
          <span className="scurve-insights__label">Techo de saturación</span>
          <span className="scurve-insights__value">{fmt(logistic.ceiling)}</span>
        </div>
        <div className="scurve-insights__item">
          <span className="scurve-insights__label">Brecha restante</span>
          <span className="scurve-insights__value"
            style={{ color: logistic.gap > 10 ? "var(--red)" : "var(--green)" }}>
            {fmt(logistic.gap)}
          </span>
        </div>
        <div className="scurve-insights__item">
          <span className="scurve-insights__label">Punto de inflexión</span>
          <span className="scurve-insights__value">
            {logistic.inflection_year}
            <span style={{ fontSize: 10, color: "var(--text-3)", marginLeft: 4 }}>
              ({logistic.passed_inflection ? "superado" : "no alcanzado"})
            </span>
          </span>
        </div>
        <div className="scurve-insights__item">
          <span className="scurve-insights__label">Velocidad</span>
          <span className="scurve-insights__value" style={{ color: velocityColor }}>
            {logistic.velocity}
          </span>
        </div>
      </div>
      <p className="scurve-insights__desc">
        {logistic.velocity_label}.{" "}
        {logistic.passed_inflection
          ? `${primaryState} ya superó el punto de mayor aceleración (${logistic.inflection_year}) y converge hacia la saturación.`
          : `${primaryState} aún no alcanza el pico de adopción más agresiva (${logistic.inflection_year}).`}
      </p>
    </div>
  );
}

// ─── Narrativa expandida ──────────────────────────────────────────────────────

function EvolucionNarrative({
  primaryState, primaryTrend, primaryForecast, varLabel, varUnit,
  nacionalLastValue, groupStateColors,
}: {
  primaryState: string | null;
  primaryTrend: { start: { anio: number; value: number }; end: { anio: number; value: number } } | null;
  primaryForecast: StateForecast | null;
  varLabel: string;
  varUnit: string;
  nacionalLastValue: number | null;
  groupStateColors: Map<string, string>;
}) {
  if (!primaryState || !primaryTrend || !primaryForecast) return null;

  const fmt = (v: number) =>
    varUnit === "%" ? `${v.toFixed(1)}%` : v.toLocaleString("es-MX", { maximumFractionDigits: 1 });

  const { start, end } = primaryTrend;
  const delta = end.value - start.value;
  const deltaStr = `${delta >= 0 ? "+" : ""}${fmt(delta)}`;
  const trendDesc =
    delta > 2 ? "una trayectoria de crecimiento sostenido" :
    delta > 0 ? "un leve incremento" :
    delta < -2 ? "una trayectoria de descenso" :
    "una trayectoria estable";

  const { ols, holt } = primaryForecast;
  const r2Quality = ols.r2 != null
    ? ols.r2 >= 0.85 ? "muy regular y predecible"
    : ols.r2 >= 0.5 ? "con cierta variabilidad interanual"
    : "con alta variabilidad año a año"
    : null;
  const holtNext = holt[0];

  const nacionalDiff = nacionalLastValue != null ? end.value - nacionalLastValue : null;

  const S = { lineHeight: 1.65, color: "var(--text-2)", margin: "0 0 8px", fontSize: 13 } as const;

  return (
    <div style={{ padding: "4px 0" }}>
      <p style={S}>
        <strong>{primaryState}</strong> muestra {trendDesc} en <em>{varLabel}</em>: pasó de{" "}
        <strong>{fmt(start.value)}</strong> en {start.anio} a <strong>{fmt(end.value)}</strong> en{" "}
        {end.anio} (variación acumulada: <strong>{deltaStr}{varUnit === "%" ? " pp" : ""}</strong>).
        {r2Quality && (
          <>{" "}La regresión lineal (R²={ols.r2!.toFixed(2)}) describe una tendencia {r2Quality}.</>
        )}
      </p>
      {nacionalDiff != null && (
        <p style={S}>
          La media nacional en {end.anio} era <strong>{fmt(nacionalLastValue!)}</strong>.{" "}
          <strong>{primaryState}</strong> se ubica{" "}
          <strong style={{ color: nacionalDiff >= 0 ? "var(--green)" : "var(--red)" }}>
            {nacionalDiff >= 0 ? "+" : ""}{fmt(nacionalDiff)} pp {nacionalDiff >= 0 ? "por encima" : "por debajo"}
          </strong>{" "}
          del promedio nacional, indicando un desempeño {nacionalDiff >= 0 ? "superior" : "inferior"} al resto del país.
        </p>
      )}
      {groupStateColors.size > 0 && (
        <p style={S}>
          Las líneas de colores corresponden a los grupos de comparación activos en el panel lateral
          (región, clúster o estados específicos). Permiten contextualizar la trayectoria de{" "}
          <strong>{primaryState}</strong> frente a sus pares seleccionados.
        </p>
      )}
      {holtNext && (
        <p style={{ ...S, margin: 0 }}>
          El modelo Holt-Winters proyecta <strong>{fmt(holtNext.value)}{varUnit}</strong> para{" "}
          {holtNext.year}, asumiendo continuidad de la tendencia reciente.
        </p>
      )}
    </div>
  );
}

// ─── Panel de pendientes por estado ──────────────────────────────────────────

function SlopePanel({
  forecastData, codeToEstado, primaryState, varUnit, varLabel,
}: {
  forecastData: ForecastData;
  codeToEstado: Record<string, string>;
  primaryState: string | null;
  varUnit: string;
  varLabel: string;
}) {
  const slopes = useMemo(
    () =>
      Object.entries(forecastData.states)
        .map(([code, f]) => ({ state: codeToEstado[code] ?? code, slope: f.ols.slope }))
        .filter((r) => isFinite(r.slope))
        .sort((a, b) => b.slope - a.slope),
    [forecastData, codeToEstado]
  );

  if (!slopes.length) return null;

  const maxAbs = Math.max(...slopes.map((s) => Math.abs(s.slope)));

  return (
    <section className="panel">
      <p className="panel-title">
        Velocidad de cambio por estado — {varLabel}
        <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-3)", marginLeft: 6 }}>
          pendiente OLS · pp/año
        </span>
      </p>
      <p style={{ fontSize: 12, color: "var(--text-3)", margin: "0 0 14px" }}>
        Estados con mayor pendiente positiva han crecido más rápido en el período histórico disponible.
      </p>
      <div style={{ maxHeight: 400, overflowY: "auto", paddingRight: 4 }}>
        {slopes.map(({ state, slope }) => {
          const pct = maxAbs > 0 ? (Math.abs(slope) / maxAbs) * 100 : 0;
          const isPrimary = state === primaryState;
          const color = isPrimary ? "var(--blue)" : slope >= 0 ? "#10b981" : "#ef4444";
          return (
            <div
              key={state}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 5,
                background: isPrimary ? "var(--accent-soft, #eff6ff)" : "transparent",
                borderRadius: 4,
                padding: "2px 4px",
              }}
            >
              <span
                style={{
                  width: 148,
                  fontSize: 11,
                  flexShrink: 0,
                  fontWeight: isPrimary ? 700 : 400,
                  color: isPrimary ? "var(--blue)" : "var(--text-2)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {state}
              </span>
              <div style={{ flex: 1, height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3 }} />
              </div>
              <span
                style={{
                  fontSize: 11,
                  width: 58,
                  textAlign: "right",
                  color,
                  fontWeight: isPrimary ? 700 : 400,
                  fontVariantNumeric: "tabular-nums",
                  flexShrink: 0,
                }}
              >
                {slope >= 0 ? "+" : ""}
                {slope.toFixed(2)}
                {varUnit === "%" ? "%" : ""}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

type Props = { appData: AppData };

export default function EvolucionTab({ appData }: Props) {
  const { state: appState } = useAppContext();
  const { primaryState, activeVariableIds, comparisonGroups } = appState;
  const { dataset, temporalVariables, temporalMeta } = appData;

  const showNacional = comparisonGroups.includes("nacional");

  const temporalSet = useMemo(() => new Set(temporalVariables), [temporalVariables]);
  const availableVars = useMemo(
    () => activeVariableIds.filter((id) => temporalSet.has(id)),
    [activeVariableIds, temporalSet]
  );

  const [selectedVarId, setSelectedVarId] = useState<string | null>(null);
  const varId: string | null = useMemo(() => {
    if (selectedVarId && availableVars.includes(selectedVarId)) return selectedVarId;
    return availableVars[0] ?? null;
  }, [selectedVarId, availableVars]);

  const varMeta   = useMemo(() => dataset.metricCatalog.find((m) => m.id === varId), [dataset.metricCatalog, varId]);
  const varLabel  = (() => {
    const raw = varMeta?.label ?? temporalMeta[varId ?? ""]?.label ?? varId ?? "Variable";
    return raw && raw !== varId ? raw : humanizeVarId(varId ?? "Variable");
  })();
  const varUnit   = varMeta?.unit  ?? temporalMeta[varId ?? ""]?.unit  ?? "";
  const varSource = temporalMeta[varId ?? ""]?.source ?? "";

  const codeToEstado = useMemo(
    () => Object.fromEntries(dataset.records.map((r) => [r.stateCode, r.state])),
    [dataset.records]
  );

  // ─── Group colors (comparison groups → per-state color map) ─────────────────
  const groupStateColors = useMemo((): Map<string, string> => {
    const nonNacional = comparisonGroups.filter((g) => g !== "nacional");
    if (!nonNacional.length) return new Map();
    const map = new Map<string, string>();
    nonNacional.forEach((g, i) => {
      const color = GROUP_COLORS[i] ?? GROUP_COLORS[GROUP_COLORS.length - 1];
      if (g.startsWith("r:")) {
        dataset.records.filter((r) => r.region === g.slice(2)).forEach((r) => map.set(r.state, color));
      } else if (g.startsWith("c:")) {
        (appData.pcaResults?.cluster_stats[g.slice(2)]?.states ?? []).forEach((s) => map.set(s, color));
      } else {
        map.set(g, color);
      }
    });
    return map;
  }, [comparisonGroups, dataset.records, appData.pcaResults]);

  // ─── Data fetching ───────────────────────────────────────────────────────────
  const [temporalCache, setTemporalCache] = useState<Record<string, TemporalVarData | null | undefined>>({});
  const [forecastCache, setForecastCache] = useState<Record<string, ForecastData | null | undefined>>({});
  const fetchingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!varId) return;
    if (!(varId in temporalCache) && !fetchingRef.current.has(varId)) {
      fetchingRef.current.add(varId);
      fetch(`/data/outputs/temporal/${varId}.json`)
        .then((r) => (r.ok ? (r.json() as Promise<TemporalVarData>) : null))
        .then((data) => setTemporalCache((prev) => ({ ...prev, [varId]: data ?? null })))
        .catch(() => setTemporalCache((prev) => ({ ...prev, [varId]: null })))
        .finally(() => fetchingRef.current.delete(varId));
    }
    const fKey = `${varId}.forecast`;
    if (!(fKey in forecastCache) && !fetchingRef.current.has(fKey)) {
      fetchingRef.current.add(fKey);
      fetch(`/data/outputs/temporal/${varId}.forecast.json`)
        .then((r) => (r.ok ? (r.json() as Promise<ForecastData>) : null))
        .then((data) => setForecastCache((prev) => ({ ...prev, [fKey]: data ?? null })))
        .catch(() => setForecastCache((prev) => ({ ...prev, [fKey]: null })))
        .finally(() => fetchingRef.current.delete(fKey));
    }
  }, [varId, temporalCache, forecastCache]);

  const varData      = varId ? (temporalCache[varId] ?? null) : null;
  const forecastData = varId ? (forecastCache[`${varId}.forecast`] ?? null) : null;

  const states = useMemo(
    () => varData
      ? [...new Set(varData.records.map((r) => codeToEstado[r.state_code] ?? r.state_code))].sort()
      : [],
    [varData, codeToEstado]
  );

  const chartData = useMemo(
    () => varId && varData ? buildChartData(varData, forecastData, codeToEstado, primaryState, showNacional) : [],
    [varId, varData, forecastData, codeToEstado, primaryState, showNacional]
  );

  const primaryForecast = useMemo((): StateForecast | null => {
    if (!forecastData || !primaryState) return null;
    const stateCode = Object.keys(forecastData.states).find(
      (k) => (codeToEstado[k] ?? k) === primaryState
    );
    return stateCode ? (forecastData.states[stateCode] ?? null) : null;
  }, [forecastData, primaryState, codeToEstado]);

  const primaryTrend = useMemo(() => {
    if (!primaryState || !chartData.length) return null;
    const points = chartData
      .map((d) => ({ anio: d.anio, value: d[primaryState] as number | undefined }))
      .filter((d): d is { anio: number; value: number } => d.value !== undefined && !isNaN(d.value));
    if (points.length < 2) return null;
    return { start: points[0], end: points[points.length - 1] };
  }, [chartData, primaryState]);

  const nacionalLastValue = useMemo(() => {
    if (!showNacional || !chartData.length) return null;
    const rows = chartData.filter((r) => r["__nacional__"] !== undefined);
    if (!rows.length) return null;
    return rows[rows.length - 1]["__nacional__"] as number;
  }, [showNacional, chartData]);

  // ─── Guards ──────────────────────────────────────────────────────────────────

  if (!availableVars.length) {
    return (
      <EmptyState
        title="Sin variables con datos históricos"
        description="Activa en el sidebar una variable con badge HIST para ver su evolución temporal."
      />
    );
  }

  if (varId && temporalCache[varId] === undefined) {
    return (
      <div className="panel" style={{ textAlign: "center", color: "var(--text-3)", padding: 32 }}>
        <p style={{ margin: 0 }}>Cargando datos históricos…</p>
      </div>
    );
  }

  if (varId && temporalCache[varId] === null) {
    return (
      <div className="panel" style={{ textAlign: "center", color: "var(--text-3)", padding: 32 }}>
        <p style={{ margin: "0 0 6px" }}>No hay datos históricos para esta variable.</p>
        <p style={{ fontSize: 13, margin: 0 }}>
          Importa series de tiempo en el tab <strong>Datos</strong> (operación: Histórico).
        </p>
      </div>
    );
  }

  const delta = primaryTrend ? primaryTrend.end.value - primaryTrend.start.value : null;
  const hasGroups = groupStateColors.size > 0;

  return (
    <div>
      {/* Variable pills — solo activas con datos históricos */}
      {availableVars.length > 1 && (
        <div className="var-pill-row">
          {availableVars.map((id) => {
            const meta = dataset.metricCatalog.find((m) => m.id === id);
            const rawLabel = meta?.label ?? temporalMeta[id]?.label ?? id;
            const label = rawLabel && rawLabel !== id ? rawLabel : humanizeVarId(id);
            return (
              <button
                key={id}
                className={`var-pill-btn${id === varId ? " active" : ""}`}
                onClick={() => setSelectedVarId(id)}
                type="button"
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* Narrativa en TabNarrative */}
      {primaryTrend && primaryForecast && (
        <TabNarrative
          title={`Evolución de ${varLabel}`}
          description={`Trayectoria histórica${showNacional ? " y comparativa nacional" : ""} de ${primaryState ?? "el estado seleccionado"}.`}
        >
          <EvolucionNarrative
            primaryState={primaryState}
            primaryTrend={primaryTrend}
            primaryForecast={primaryForecast}
            varLabel={varLabel}
            varUnit={varUnit}
            nacionalLastValue={nacionalLastValue}
            groupStateColors={groupStateColors}
          />
        </TabNarrative>
      )}

      {/* S-curve panel */}
      {primaryForecast?.logistic && (
        <SCurveInsights
          logistic={primaryForecast.logistic}
          varUnit={varUnit}
          primaryState={primaryState}
        />
      )}

      {/* Chart panel */}
      <div className="panel" style={{ marginTop: primaryForecast?.logistic ? 0 : undefined }}>
        <div className="panel-title-row">
          <div>
            <h3 className="panel-title" style={{ margin: "0 0 2px" }}>{varLabel}</h3>
            {varSource && (
              <span style={{ fontSize: 11, color: "var(--text-3)" }}>{varSource}</span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {varUnit && (
              <span style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 400 }}>({varUnit})</span>
            )}
            <InfoTooltip wide text={
              <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--text-2)" }}>
                <p style={{ fontWeight: 700, margin: "0 0 4px", color: "var(--text-1)" }}>Cómo leer el gráfico</p>
                <p style={{ margin: "0 0 8px" }}>
                  Cada línea gris es un estado. La <strong style={{ color: "var(--blue)" }}>línea azul sólida</strong> es el estado seleccionado.
                  La <strong style={{ color: "var(--blue)" }}>línea azul punteada</strong> es la tendencia OLS.
                  El <strong style={{ color: "#7c3aed" }}>punto morado</strong> es la proyección Holt para el año siguiente.
                </p>
                {showNacional && (
                  <p style={{ margin: "0 0 8px" }}>
                    La <strong style={{ color: NACIONAL_COLOR }}>línea gris punteada</strong> es la media nacional.
                  </p>
                )}
                {hasGroups && (
                  <p style={{ margin: 0 }}>
                    Las <strong>líneas de colores</strong> corresponden a los grupos de comparación activos en el panel lateral.
                  </p>
                )}
              </div>
            } />
          </div>
        </div>

        {/* KPI strip */}
        {primaryTrend && primaryForecast && delta !== null && (
          <KpiStrip
            lastValue={primaryTrend.end.value}
            lastYear={primaryTrend.end.anio}
            delta={delta}
            startYear={primaryTrend.start.anio}
            slope={primaryForecast.ols.slope}
            r2={primaryForecast.ols.r2}
            varUnit={varUnit}
          />
        )}

        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="anio" tick={{ fontSize: 12, fill: "var(--text-2)" }} tickLine={false} axisLine={false} />
            <YAxis
              tick={{ fontSize: 12, fill: "var(--text-2)" }}
              tickLine={false}
              axisLine={false}
              width={56}
              tickFormatter={(v: number) => varUnit === "%" ? `${v}%` : v.toLocaleString("es-MX")}
            />
            <Tooltip
              content={(props) => (
                <EvolucionTooltip
                  {...(props as any)}
                  primaryState={primaryState}
                  varUnit={varUnit}
                  groupStateColors={groupStateColors}
                  showNacional={showNacional}
                />
              )}
            />

            {/* Background states — dimmed when groups are active */}
            {states.map((estado) =>
              estado === primaryState || groupStateColors.has(estado) ? null : (
                <Line
                  key={estado} type="monotone" dataKey={estado}
                  stroke="var(--border)" strokeWidth={1}
                  dot={false} activeDot={{ r: 0 }}
                  opacity={hasGroups ? 0.12 : 0.7}
                  isAnimationActive={false} connectNulls legendType="none"
                />
              )
            )}

            {/* Group-colored states */}
            {Array.from(groupStateColors.entries()).map(([estado, color]) =>
              estado === primaryState ? null : (
                <Line
                  key={`grp_${estado}`} type="monotone" dataKey={estado}
                  stroke={color} strokeWidth={2}
                  dot={{ r: 2, fill: color, strokeWidth: 0 }}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false} connectNulls legendType="none"
                />
              )
            )}

            {/* Nacional mean */}
            {showNacional && (
              <Line
                type="monotone" dataKey="__nacional__"
                stroke={NACIONAL_COLOR} strokeWidth={1.5} strokeDasharray="4 2"
                dot={false} activeDot={{ r: 0 }}
                opacity={0.85} isAnimationActive={false} connectNulls legendType="none"
              />
            )}

            {/* Primary state — always on top */}
            {primaryState && states.includes(primaryState) && (
              <Line
                type="monotone" dataKey={primaryState}
                stroke="var(--blue)" strokeWidth={2.5}
                dot={{ r: 3, fill: "var(--blue)", strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                isAnimationActive={false} connectNulls legendType="none"
              />
            )}

            {/* OLS trend line */}
            {primaryForecast && (
              <Line
                type="monotone" dataKey="__trend__"
                stroke="var(--blue)" strokeWidth={1.5} strokeDasharray="5 3"
                dot={false} activeDot={{ r: 0 }} opacity={0.45}
                isAnimationActive={false} connectNulls legendType="none"
              />
            )}

            {/* Holt projection dots */}
            {primaryForecast?.holt.map(({ year, value }) => (
              <ReferenceDot key={year} x={year} y={value} r={5} fill="#7c3aed" stroke="#fff" strokeWidth={2} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Slope comparison panel */}
      {forecastData && (
        <SlopePanel
          forecastData={forecastData}
          codeToEstado={codeToEstado}
          primaryState={primaryState}
          varUnit={varUnit}
          varLabel={varLabel}
        />
      )}
    </div>
  );
}
