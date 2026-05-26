import { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { MunicipioAnalyticsRecord } from "../../types/analytics";

const METRIC_OPTIONS = [
  { key: "pob_pct_4g_garantizada" as const, label: "Cobertura 4G poblacional (%)" },
  { key: "loc_pct_4g_garantizada" as const, label: "Cobertura 4G localidades (%)" },
  { key: "graproes" as const, label: "Escolaridad promedio (años)" },
];

const N_BINS = 10;

function buildHistogram(values: number[]): { lo: number; hi: number; count: number; pct: number }[] {
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const binW = range / N_BINS;
  const bins = Array.from({ length: N_BINS }, (_, i) => ({
    lo: min + i * binW,
    hi: min + (i + 1) * binW,
    count: 0,
    pct: 0,
  }));
  for (const v of values) {
    const idx = Math.min(Math.floor((v - min) / binW), N_BINS - 1);
    bins[idx].count++;
  }
  const total = values.length;
  bins.forEach((b) => { b.pct = (b.count / total) * 100; });
  return bins;
}

type MetricKey = typeof METRIC_OPTIONS[number]["key"];

function getVal(m: MunicipioAnalyticsRecord, k: MetricKey): number | undefined {
  const v = m[k];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

type Props = {
  municipios: MunicipioAnalyticsRecord[];
  primaryState: string;
};

export default function MunicipalXRayPanel({ municipios, primaryState }: Props) {
  const [metricKey, setMetricKey] = useState<MetricKey>("pob_pct_4g_garantizada");
  const [rankView, setRankView] = useState<"top" | "bottom">("top");

  const metricLabel = METRIC_OPTIONS.find((m) => m.key === metricKey)?.label ?? metricKey;

  const values = useMemo(
    () => municipios.map((m) => getVal(m, metricKey)).filter((v): v is number => v !== undefined),
    [municipios, metricKey]
  );

  const histogram = useMemo(() => buildHistogram(values), [values]);
  const mean = useMemo(
    () => (values.length ? values.reduce((s, v) => s + v, 0) / values.length : null),
    [values]
  );

  const ranked = useMemo(
    () =>
      municipios
        .map((m) => ({ nom_mun: m.nom_mun, value: getVal(m, metricKey) }))
        .filter((m): m is { nom_mun: string; value: number } => m.value !== undefined)
        .sort((a, b) => b.value - a.value),
    [municipios, metricKey]
  );

  const displayed = rankView === "top" ? ranked.slice(0, 10) : [...ranked].reverse().slice(0, 10);
  const isPercent = metricKey !== "graproes";

  return (
    <div className="mun-xray-panel">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--text-1)" }}>
          Rayos X — {municipios.length} municipios de {primaryState}
        </p>
        <select
          className="ranking-var-select"
          value={metricKey}
          onChange={(e) => setMetricKey(e.target.value as MetricKey)}
        >
          {METRIC_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Histogram */}
      <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Distribución municipal — {metricLabel}
      </p>
      {histogram.length > 0 ? (
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={histogram} margin={{ top: 4, right: 8, bottom: 20, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="lo"
              tickFormatter={(v: number) => isPercent ? `${v.toFixed(0)}%` : v.toFixed(1)}
              tick={{ fontSize: 9, fill: "var(--text-3)" }}
              tickLine={false}
              axisLine={false}
              interval={1}
            />
            <YAxis
              tick={{ fontSize: 9, fill: "var(--text-3)" }}
              tickLine={false}
              axisLine={false}
              width={24}
            />
            <Tooltip
              formatter={(v: number, _: string, props: any) => {
                const d = props.payload;
                const range = isPercent
                  ? `${d.lo.toFixed(1)}% – ${d.hi.toFixed(1)}%`
                  : `${d.lo.toFixed(2)} – ${d.hi.toFixed(2)}`;
                return [`${v} municipios (${range})`, metricLabel];
              }}
            />
            <Bar dataKey="count" isAnimationActive={false} radius={[2, 2, 0, 0]}>
              {histogram.map((_, i) => (
                <Cell key={i} fill="var(--blue)" opacity={0.7 + i * 0.03} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p style={{ color: "var(--text-3)", fontSize: 12 }}>Sin datos para esta métrica.</p>
      )}

      {mean !== null && (
        <p style={{ margin: "2px 0 12px", fontSize: 11, color: "var(--text-3)", textAlign: "center" }}>
          Media estatal: <strong>{isPercent ? `${mean.toFixed(1)}%` : mean.toFixed(2)}</strong>
          {" · "}n = {values.length} municipios con dato
        </p>
      )}

      {/* Ranking */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Ranking municipal
        </p>
        <div className="toggle-pill" role="group">
          <button
            type="button"
            className={`toggle-pill__btn${rankView === "top" ? " active" : ""}`}
            onClick={() => setRankView("top")}
          >
            Top 10
          </button>
          <button
            type="button"
            className={`toggle-pill__btn${rankView === "bottom" ? " active" : ""}`}
            onClick={() => setRankView("bottom")}
          >
            Últimos 10
          </button>
        </div>
      </div>

      <div style={{ overflowY: "auto", maxHeight: 260 }}>
        <table className="ranking-table" style={{ fontSize: 11 }} aria-label={`Ranking municipal: ${metricLabel}`}>
          <thead>
            <tr>
              <th>#</th>
              <th>Municipio</th>
              <th>{metricLabel}</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((m, i) => (
              <tr key={m.nom_mun}>
                <td><span className="rank-mid">{rankView === "top" ? i + 1 : ranked.length - i}</span></td>
                <td>{m.nom_mun}</td>
                <td style={{ fontFamily: "var(--font-mono)" }}>
                  {isPercent ? `${m.value.toFixed(1)}%` : m.value.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
