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
  primaryState: string | null
): ChartRow[] {
  const byYear = new Map<number, ChartRow>();

  for (const r of varData.records) {
    const estado = codeToEstado[r.state_code] ?? r.state_code;
    if (isNaN(r.value)) continue;
    if (!byYear.has(r.year)) byYear.set(r.year, { anio: r.year });
    byYear.get(r.year)![estado] = r.value;
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

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function EvolucionTooltip({
  active, payload, label, primaryState, varUnit,
}: {
  active?: boolean;
  payload?: { dataKey: string; value: number }[];
  label?: number;
  primaryState: string | null;
  varUnit: string;
}) {
  if (!active || !payload?.length) return null;

  const fmt = (v: number) =>
    varUnit === "%" ? `${v.toFixed(2)}%` : v.toLocaleString("es-MX", { maximumFractionDigits: 2 });

  const dataEntries = payload.filter(
    (p) => p.value !== undefined && !isNaN(p.value) && !["__trend__", "__holt__"].includes(p.dataKey)
  );
  const sorted = [...dataEntries].sort((a, b) => b.value - a.value);
  const primaryEntry = dataEntries.find((p) => p.dataKey === primaryState);
  const topEntry = sorted[0];
  const bottomEntry = sorted[sorted.length - 1];
  const trendEntry = payload.find((p) => p.dataKey === "__trend__");
  const holtEntry = payload.find((p) => p.dataKey === "__holt__");

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
      {bottomEntry && bottomEntry.dataKey !== primaryState && bottomEntry.dataKey !== topEntry?.dataKey && (
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

// ─── Narrativa ────────────────────────────────────────────────────────────────

function EvolucionNarrative({
  primaryState, primaryTrend, primaryForecast, varLabel, varUnit,
}: {
  primaryState: string | null;
  primaryTrend: { start: { anio: number; value: number }; end: { anio: number; value: number } } | null;
  primaryForecast: StateForecast | null;
  varLabel: string;
  varUnit: string;
}) {
  if (!primaryState || !primaryTrend || !primaryForecast) return null;

  const fmt = (v: number) =>
    varUnit === "%" ? `${v.toFixed(1)}%` : v.toLocaleString("es-MX", { maximumFractionDigits: 1 });

  const { start, end } = primaryTrend;
  const delta = end.value - start.value;
  const deltaStr = `${delta >= 0 ? "+" : ""}${fmt(delta)}`;
  const trend = delta > 0 ? "crecimiento" : delta < 0 ? "descenso" : "sin cambio";

  const { ols, holt } = primaryForecast;
  const r2Str = ols.r2 != null ? `R²=${ols.r2.toFixed(2)}` : null;
  const holtNext = holt[0];

  const S = { lineHeight: 1.65, color: "var(--text-2)", margin: "0 0 6px", fontSize: 13 } as const;

  return (
    <div style={{ padding: "10px 0 4px" }}>
      <p style={S}>
        <strong>{primaryState}</strong> registró {deltaStr} pp en <em>{varLabel}</em> entre {start.anio} y {end.anio}
        {" "}({start.anio}: {fmt(start.value)} → {end.anio}: {fmt(end.value)}), con tendencia de {trend}.{" "}
        {r2Str && `La regresión lineal (${r2Str}) `}
        {r2Str && (ols.r2 != null && ols.r2 >= 0.85
          ? "muestra una trayectoria muy regular."
          : ols.r2 != null && ols.r2 >= 0.5
          ? "captura la dirección general pero con variabilidad notable."
          : "indica alta variabilidad año a año.")}
      </p>
      {holtNext && (
        <p style={{ ...S, margin: 0 }}>
          El modelo Holt proyecta {fmt(holtNext.value)}{varUnit} para {holtNext.year}.
        </p>
      )}
    </div>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

type Props = { appData: AppData };

export default function EvolucionTab({ appData }: Props) {
  const { state: appState } = useAppContext();
  const { primaryState, activeVariableIds } = appState;
  const { dataset, temporalVariables, temporalMeta } = appData;

  // Only show active variables that have temporal data
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

  // Label/unit from metricCatalog first, then temporalMeta
  const varMeta   = useMemo(() => dataset.metricCatalog.find((m) => m.id === varId), [dataset.metricCatalog, varId]);
  const varLabel  = varMeta?.label ?? temporalMeta[varId ?? ""]?.label ?? varId ?? "Variable";
  const varUnit   = varMeta?.unit  ?? temporalMeta[varId ?? ""]?.unit  ?? "";
  const varSource = temporalMeta[varId ?? ""]?.source ?? "";

  const codeToEstado = useMemo(
    () => Object.fromEntries(dataset.records.map((r) => [r.stateCode, r.state])),
    [dataset.records]
  );

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
    () => varId && varData ? buildChartData(varData, forecastData, codeToEstado, primaryState) : [],
    [varId, varData, forecastData, codeToEstado, primaryState]
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
  const fmt = (v: number) =>
    varUnit === "%" ? `${v.toFixed(2)}%` : v.toLocaleString("es-MX", { maximumFractionDigits: 2 });

  return (
    <div>
      {/* Variable pills — solo activas con datos históricos */}
      {availableVars.length > 1 && (
        <div className="var-pill-row">
          {availableVars.map((id) => {
            const meta = dataset.metricCatalog.find((m) => m.id === id);
            const label = meta?.label ?? temporalMeta[id]?.label ?? id;
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

      {/* S-curve panel — arriba del chart */}
      {primaryForecast?.logistic && (
        <SCurveInsights
          logistic={primaryForecast.logistic}
          varUnit={varUnit}
          primaryState={primaryState}
        />
      )}

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
                  La <strong style={{ color: "var(--blue)" }}>línea azul punteada</strong> es la tendencia OLS (regresión lineal).
                  El <strong style={{ color: "#7c3aed" }}>punto morado</strong> es la proyección Holt para el año siguiente.
                </p>
              </div>
            } />
          </div>
        </div>

        {/* Narrativa */}
        <EvolucionNarrative
          primaryState={primaryState}
          primaryTrend={primaryTrend}
          primaryForecast={primaryForecast}
          varLabel={varLabel}
          varUnit={varUnit}
        />

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
                <EvolucionTooltip {...(props as any)} primaryState={primaryState} varUnit={varUnit} />
              )}
            />
            {states.map((estado) =>
              estado === primaryState ? null : (
                <Line
                  key={estado} type="monotone" dataKey={estado}
                  stroke="var(--border)" strokeWidth={1}
                  dot={false} activeDot={{ r: 0 }}
                  opacity={0.7} isAnimationActive={false} connectNulls legendType="none"
                />
              )
            )}
            {primaryState && states.includes(primaryState) && (
              <Line
                type="monotone" dataKey={primaryState}
                stroke="var(--blue)" strokeWidth={2.5}
                dot={{ r: 3, fill: "var(--blue)", strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                isAnimationActive={false} connectNulls legendType="none"
              />
            )}
            {primaryForecast && (
              <Line
                type="monotone" dataKey="__trend__"
                stroke="var(--blue)" strokeWidth={1.5} strokeDasharray="5 3"
                dot={false} activeDot={{ r: 0 }} opacity={0.45}
                isAnimationActive={false} connectNulls legendType="none"
              />
            )}
            {primaryForecast?.holt.map(({ year, value }) => (
              <ReferenceDot key={year} x={year} y={value} r={5} fill="#7c3aed" stroke="#fff" strokeWidth={2} />
            ))}
          </LineChart>
        </ResponsiveContainer>

        {primaryTrend && delta !== null && (
          <div className="evolucion-trend">
            <span className="evolucion-trend__state">{primaryState}</span>
            <span className="evolucion-trend__delta" style={{ color: delta >= 0 ? "var(--green)" : "var(--red)" }}>
              {delta >= 0 ? "+" : ""}{fmt(delta)}
            </span>
            <span className="evolucion-trend__range">
              {fmt(primaryTrend.start.value)} ({primaryTrend.start.anio}) → {fmt(primaryTrend.end.value)} ({primaryTrend.end.anio})
            </span>
            {primaryForecast?.ols.r2 != null && (
              <span style={{ fontSize: 11, color: "var(--text-3)", marginLeft: "auto" }}>
                OLS R²: {primaryForecast.ols.r2.toFixed(3)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
