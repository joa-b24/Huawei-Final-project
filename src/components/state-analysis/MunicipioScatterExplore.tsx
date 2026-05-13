import { useMemo, useState } from "react";
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis
} from "recharts";
import type { MunicipioAnalyticsRecord } from "../../types/analytics";
import { spearmanSafe } from "../../utils/spearman";
import { ANALYSIS_METRICS, type AnalysisMetricKey } from "./analysisMetrics";
import InterpretationHelp from "./InterpretationHelp";
import { getPairInterpretation } from "./pairInterpretations";

function pickMetric(m: MunicipioAnalyticsRecord, k: AnalysisMetricKey): number {
  const v = m[k];
  return typeof v === "number" && Number.isFinite(v) ? v : Number.NaN;
}

type Props = {
  municipios: MunicipioAnalyticsRecord[];
};

const CLUSTER_COLORS = ["#7c3aed", "#2563eb", "#0f766e", "#ea580c", "#be123c", "#0891b2"];

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) {
    return Number.NaN;
  }
  const idx = (sorted.length - 1) * q;
  const low = Math.floor(idx);
  const high = Math.ceil(idx);
  if (low === high) {
    return sorted[low];
  }
  return sorted[low] + (sorted[high] - sorted[low]) * (idx - low);
}

export default function MunicipioScatterExplore({ municipios }: Props) {
  const [xKey, setXKey] = useState<AnalysisMetricKey>("graproes");
  const [yKey, setYKey] = useState<AnalysisMetricKey>("pob_pct_4g_garantizada");

  const xMeta = ANALYSIS_METRICS.find((m) => m.key === xKey)!;
  const yMeta = ANALYSIS_METRICS.find((m) => m.key === yKey)!;

  const data = useMemo(
    () =>
      municipios.map((m) => ({
        name: m.nom_mun,
        x: pickMetric(m, xKey),
        y: pickMetric(m, yKey),
        z: m.pobtot_iter,
        clusterId: typeof m.cluster_id === "number" ? m.cluster_id : null
      })),
    [municipios, xKey, yKey]
  );

  const rho = useMemo(() => {
    const xs = municipios.map((m) => pickMetric(m, xKey));
    const ys = municipios.map((m) => pickMetric(m, yKey));
    const xi: number[] = [];
    const yi: number[] = [];
    for (let i = 0; i < xs.length; i++) {
      if (Number.isFinite(xs[i]) && Number.isFinite(ys[i])) {
        xi.push(xs[i]);
        yi.push(ys[i]);
      }
    }
    return spearmanSafe(xi, yi);
  }, [municipios, xKey, yKey]);

  const filtered = data.filter((d) => Number.isFinite(d.x) && Number.isFinite(d.y));
  const groupedByCluster = useMemo(() => {
    const groups = new Map<string, typeof filtered>();
    for (const point of filtered) {
      const key = point.clusterId === null ? "Sin cluster" : `Cluster ${point.clusterId}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(point);
    }
    return [...groups.entries()];
  }, [filtered]);

  const outliers = useMemo(() => {
    if (filtered.length < 8) {
      return [];
    }
    const xs = filtered.map((d) => d.x).sort((a, b) => a - b);
    const ys = filtered.map((d) => d.y).sort((a, b) => a - b);
    const q1x = quantile(xs, 0.25);
    const q3x = quantile(xs, 0.75);
    const q1y = quantile(ys, 0.25);
    const q3y = quantile(ys, 0.75);
    const iqrX = Math.max(q3x - q1x, 1e-9);
    const iqrY = Math.max(q3y - q1y, 1e-9);
    return [...filtered]
      .map((d) => ({
        ...d,
        score: Math.abs((d.x - quantile(xs, 0.5)) / iqrX) + Math.abs((d.y - quantile(ys, 0.5)) / iqrY)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }, [filtered]);
  const rhoInterpretation =
    rho === null
      ? "No se puede estimar Spearman con el subconjunto actual."
      : Math.abs(rho) < 0.2
        ? "asociacion debil o casi nula"
        : Math.abs(rho) < 0.5
          ? `asociacion moderada ${rho > 0 ? "positiva" : "negativa"}`
          : `asociacion fuerte ${rho > 0 ? "positiva" : "negativa"}`;

  return (
    <div>
      <div className="section-heading">
        <h2>Exploración municipal (dispersión)</h2>
        <p>
          Cada punto representa un municipio; el tamaño refleja población y el color el cluster territorial.
          Permite identificar patrones, municipios atípicos y contrastes entre perfiles similares. Spearman entre
          los ejes seleccionados:{" "}
          <strong>{rho === null ? "— (pocos datos o sin varianza)" : rho.toFixed(3)}</strong>.
        </p>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 12, alignItems: "flex-end" }}>
        <div className="metric-control">
          <label htmlFor="scatter-x">Eje horizontal</label>
          <select id="scatter-x" value={xKey} onChange={(e) => setXKey(e.target.value as AnalysisMetricKey)}>
            {ANALYSIS_METRICS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="metric-control">
          <label htmlFor="scatter-y">Eje vertical</label>
          <select id="scatter-y" value={yKey} onChange={(e) => setYKey(e.target.value as AnalysisMetricKey)}>
            {ANALYSIS_METRICS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <InterpretationHelp
        topic={`Dispersión municipal: eje X = ${xMeta.label}; eje Y = ${yMeta.label}`}
        caption="Ayuda: dispersión"
        heading="Interpretación posible"
      >
        <p>
          Eje X: <strong>{xMeta.label}</strong>; eje Y: <strong>{yMeta.label}</strong>. Hay{" "}
          <strong>{municipios.length}</strong> municipios; cada punto es uno (tamaño = población, color = cluster).
        </p>
        <p>
          Con estos ejes, Spearman sugiere <strong>{rhoInterpretation}</strong>
          {rho !== null ? ` (ρ = ${rho.toFixed(3)})` : ""}.
        </p>
        {(() => {
          const contextual = getPairInterpretation(xKey, yKey, rho);
          return contextual ? (
            <p style={{ background: "#eff6ff", borderRadius: 8, padding: "8px 10px", border: "1px solid #bfdbfe" }}>
              <strong>Lectura indicativa:</strong> {contextual}
            </p>
          ) : null;
        })()}
        <p style={{ fontSize: "0.82rem", color: "#64748b" }}>
          Los puntos aislados de la nube principal son municipios atípicos respecto a este par de variables.
          Antes de generalizar, conviene revisarlos uno a uno: pueden estar reflejando casos particulares
          y no la tendencia del estado.
        </p>
      </InterpretationHelp>
      <div className="chart-frame">
        {filtered.length === 0 ? (
          <p style={{ padding: 24, color: "#64748b" }}>No hay municipios con ambos ejes numéricos para graficar.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="x"
                name={xMeta.label}
                unit={xMeta.unit ? ` ${xMeta.unit}` : ""}
                tickLine={false}
              />
              <YAxis
                type="number"
                dataKey="y"
                name={yMeta.label}
                unit={yMeta.unit ? ` ${yMeta.unit}` : ""}
                tickLine={false}
              />
              <ZAxis type="number" dataKey="z" range={[40, 400]} name="Población" />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                formatter={(value: number, name: string) => {
                  if (name === "Población") {
                    return [value.toLocaleString("es-MX"), name];
                  }
                  return [typeof value === "number" ? value.toFixed(2) : value, name];
                }}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.name ?? ""}
              />
              {groupedByCluster.map(([clusterName, points], idx) => (
                <Scatter
                  key={clusterName}
                  name={clusterName}
                  data={points}
                  fill={CLUSTER_COLORS[idx % CLUSTER_COLORS.length]}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </div>
      {outliers.length > 0 ? (
        <p style={{ marginTop: 8, fontSize: "0.82rem", color: "#475569" }}>
          Municipios más atípicos en este cruce:{" "}
          <strong>{outliers.map((o) => o.name).join(", ")}</strong>.
        </p>
      ) : null}
    </div>
  );
}
