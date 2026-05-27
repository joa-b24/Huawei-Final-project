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
import {
  AGE_METRIC_KEYS,
  ANALYSIS_METRICS,
  COVERAGE_METRIC_KEY,
  type AnalysisMetricKey
} from "./analysisMetrics";
import InterpretationHelp from "./InterpretationHelp";
import { getPairInterpretation } from "./pairInterpretations";

function pickMetric(m: MunicipioAnalyticsRecord, k: AnalysisMetricKey): number {
  const v = m[k];
  return typeof v === "number" && Number.isFinite(v) ? v : Number.NaN;
}

type Props = {
  municipios: MunicipioAnalyticsRecord[];
};

const CLUSTER_COLOR_BY_LABEL: Record<string, string> = {
  "Alta cobertura 4G": "#16a34a",
  "Mayor cobertura 4G": "#16a34a",
  "Cobertura media": "#2563eb",
  "Baja cobertura 4G": "#dc2626",
  "Menor cobertura 4G": "#dc2626",
  "Único municipio": "#64748b",
  "Único grupo": "#64748b",
  "Sin grupo": "#94a3b8",
};
const CLUSTER_FALLBACK_COLORS = ["#16a34a", "#2563eb", "#dc2626", "#64748b"];

function isAgeMetric(k: AnalysisMetricKey): boolean {
  return AGE_METRIC_KEYS.includes(k);
}

function otherMetric(avoid: AnalysisMetricKey, alsoAvoid?: AnalysisMetricKey): AnalysisMetricKey {
  const alt = ANALYSIS_METRICS.find((m) => m.key !== avoid && m.key !== alsoAvoid);
  return alt?.key ?? ANALYSIS_METRICS.find((m) => m.key !== avoid)?.key ?? avoid;
}

function resolveAxisPair(x: AnalysisMetricKey, y: AnalysisMetricKey): { x: AnalysisMetricKey; y: AnalysisMetricKey } {
  if (x === y) {
    return { x, y: otherMetric(x) };
  }
  if (isAgeMetric(x) && isAgeMetric(y)) {
    return { x, y: COVERAGE_METRIC_KEY };
  }
  return { x, y };
}

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
  const sameAxis = xKey === yKey;

  const setXKeySafe = (next: AnalysisMetricKey) => {
    const resolved = resolveAxisPair(next, yKey);
    setXKey(resolved.x);
    setYKey(resolved.y);
  };

  const setYKeySafe = (next: AnalysisMetricKey) => {
    const resolved = resolveAxisPair(xKey, next);
    setXKey(resolved.x);
    setYKey(resolved.y);
  };

  const colorEchoesCoverageAxis =
    xKey === COVERAGE_METRIC_KEY || yKey === COVERAGE_METRIC_KEY;

  const data = useMemo(
    () =>
      municipios.map((m) => ({
        name: m.nom_mun,
        x: pickMetric(m, xKey),
        y: pickMetric(m, yKey),
        z: m.pobtot_iter,
        clusterLabel:
          m.cluster_label?.trim() ||
          (typeof m.cluster_id === "number" ? `Grupo ${m.cluster_id}` : "Sin grupo"),
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
      const key = point.clusterLabel;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(point);
    }
    const order = ["Alta cobertura 4G", "Mayor cobertura 4G", "Cobertura media", "Baja cobertura 4G", "Menor cobertura 4G"];
    return [...groups.entries()].sort((a, b) => {
      const ia = order.indexOf(a[0]);
      const ib = order.indexOf(b[0]);
      if (ia >= 0 && ib >= 0) return ia - ib;
      if (ia >= 0) return -1;
      if (ib >= 0) return 1;
      return a[0].localeCompare(b[0], "es");
    });
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
          Cada punto es un municipio (tamaño = población). El color indica uno de tres perfiles de cobertura
          4G dentro del estado (alta, media o baja). Cada eje debe ser una variable distinta. Spearman entre
          los ejes seleccionados:{" "}
          <strong>
            {sameAxis ? "— (elige dos variables diferentes)" : rho === null ? "— (pocos datos o sin varianza)" : rho.toFixed(3)}
          </strong>
          .
        </p>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 12, alignItems: "flex-end" }}>
        <div className="metric-control">
          <label htmlFor="scatter-x">Eje horizontal</label>
          <select
            id="scatter-x"
            value={xKey}
            onChange={(e) => setXKeySafe(e.target.value as AnalysisMetricKey)}
          >
            {ANALYSIS_METRICS.map((m) => (
              <option
                key={m.key}
                value={m.key}
                disabled={m.key === yKey || (isAgeMetric(m.key) && isAgeMetric(yKey))}
              >
                {m.label}
                {m.key === yKey
                  ? " (eje vertical)"
                  : isAgeMetric(m.key) && isAgeMetric(yKey)
                    ? " (elige solo una edad)"
                    : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="metric-control">
          <label htmlFor="scatter-y">Eje vertical</label>
          <select
            id="scatter-y"
            value={yKey}
            onChange={(e) => setYKeySafe(e.target.value as AnalysisMetricKey)}
          >
            {ANALYSIS_METRICS.map((m) => (
              <option
                key={m.key}
                value={m.key}
                disabled={m.key === xKey || (isAgeMetric(m.key) && isAgeMetric(xKey))}
              >
                {m.label}
                {m.key === xKey
                  ? " (eje horizontal)"
                  : isAgeMetric(m.key) && isAgeMetric(xKey)
                    ? " (elige solo una edad)"
                    : ""}
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
          <strong>{municipios.length}</strong> municipios; el color es el perfil de cobertura (3 grupos por estado,
          k-medias con cobertura 4G, escolaridad y % de población 65+).
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
        {colorEchoesCoverageAxis ? (
          <p style={{ fontSize: "0.82rem", color: "#b45309", background: "#fffbeb", borderRadius: 8, padding: "8px 10px", border: "1px solid #fde68a" }}>
            El color del punto ya refleja el nivel de cobertura 4G del municipio (tres grupos del estado).
            Con cobertura en un eje, la gráfica repite la misma dimensión; conviene usar otro eje (escolaridad, edad o sexo).
          </p>
        ) : null}
      </InterpretationHelp>
      <div className="chart-frame">
        {sameAxis ? (
          <p style={{ padding: 24, color: "#64748b" }}>
            Elige dos variables distintas en los ejes horizontal y vertical para comparar municipios.
          </p>
        ) : filtered.length === 0 ? (
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
                  fill={
                    CLUSTER_COLOR_BY_LABEL[clusterName] ??
                    CLUSTER_FALLBACK_COLORS[idx % CLUSTER_FALLBACK_COLORS.length]
                  }
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
