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
  SCATTER_METRICS,
  VAR_ID_TO_SCATTER_KEY,
  type ScatterMetricKey,
} from "./analysisMetrics";
import InfoTooltip from "../feedback/InfoTooltip";
import { getPairInterpretation } from "./pairInterpretations";

function pickMetric(m: MunicipioAnalyticsRecord, k: ScatterMetricKey): number {
  const v = m[k as keyof MunicipioAnalyticsRecord];
  return typeof v === "number" && Number.isFinite(v) ? v : Number.NaN;
}

type Props = {
  municipios: MunicipioAnalyticsRecord[];
  activeVariableIds?: string[];
  fixedYKey?: ScatterMetricKey;
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

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return Number.NaN;
  const idx = (sorted.length - 1) * q;
  const low = Math.floor(idx);
  const high = Math.ceil(idx);
  if (low === high) return sorted[low];
  return sorted[low] + (sorted[high] - sorted[low]) * (idx - low);
}

function resolveAxisPair(
  x: ScatterMetricKey,
  y: ScatterMetricKey
): { x: ScatterMetricKey; y: ScatterMetricKey } {
  if (x === y) {
    const alt = SCATTER_METRICS.find((m) => m.key !== x);
    return { x, y: alt?.key ?? x };
  }
  return { x, y };
}

export default function MunicipioScatterExplore({ municipios, activeVariableIds = [], fixedYKey }: Props) {
  const [xKey, setXKey] = useState<ScatterMetricKey>("graproes");
  const [yKeyState, setYKeyState] = useState<ScatterMetricKey>("pob_pct_4g_garantizada");

  const yKey = fixedYKey ?? yKeyState;

  const xMeta = SCATTER_METRICS.find((m) => m.key === xKey)!;
  const yMeta = SCATTER_METRICS.find((m) => m.key === yKey)!;
  const sameAxis = xKey === yKey;

  const activeKeys = useMemo(() => {
    const s = new Set<ScatterMetricKey>();
    for (const varId of activeVariableIds) {
      const k = VAR_ID_TO_SCATTER_KEY[varId];
      if (k) s.add(k);
    }
    return s;
  }, [activeVariableIds]);

  const metricOptions = useMemo(() => {
    const active = SCATTER_METRICS.filter((m) => activeKeys.has(m.key as ScatterMetricKey));
    const rest = SCATTER_METRICS.filter((m) => !activeKeys.has(m.key as ScatterMetricKey));
    return [...active, ...rest];
  }, [activeKeys]);

  const setXKeySafe = (next: ScatterMetricKey) => {
    if (fixedYKey) {
      setXKey(next === fixedYKey ? (SCATTER_METRICS.find((m) => m.key !== fixedYKey)?.key ?? next) : next);
    } else {
      const resolved = resolveAxisPair(next, yKey);
      setXKey(resolved.x);
      setYKeyState(resolved.y);
    }
  };
  const setYKeySafe = (next: ScatterMetricKey) => {
    const resolved = resolveAxisPair(xKey, next);
    setXKey(resolved.x);
    setYKeyState(resolved.y);
  };

  const colorEchoesCoverageAxis = xKey === "pob_pct_4g_garantizada" || yKey === "pob_pct_4g_garantizada";

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
      if (!groups.has(key)) groups.set(key, []);
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
    if (filtered.length < 8) return [];
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
        score: Math.abs((d.x - quantile(xs, 0.5)) / iqrX) + Math.abs((d.y - quantile(ys, 0.5)) / iqrY),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }, [filtered]);

  const rhoInterpretation =
    rho === null
      ? null
      : Math.abs(rho) < 0.2
        ? "asociación débil o casi nula"
        : Math.abs(rho) < 0.5
          ? `asociación moderada ${rho > 0 ? "positiva" : "negativa"}`
          : `asociación fuerte ${rho > 0 ? "positiva" : "negativa"}`;

  const pairContextual = !sameAxis ? getPairInterpretation(xKey, yKey, rho) : null;

  const tooltipContent = (
    <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--text-2)" }}>
      <p style={{ fontWeight: 700, margin: "0 0 4px", color: "var(--text-1)" }}>Cómo leer la dispersión</p>
      <p style={{ margin: "0 0 8px" }}>
        Cada punto es un municipio. El <strong>tamaño</strong> representa la población.
        El <strong>color</strong> indica el perfil de cobertura 4G dentro del estado (3 grupos k-means).
      </p>
      <p style={{ fontWeight: 700, margin: "0 0 4px", color: "var(--text-1)" }}>Spearman (ρ)</p>
      <p style={{ margin: "0 0 8px" }}>
        Mide asociación monotónica entre los dos ejes. ρ cercano a ±1 indica relación fuerte;
        cercano a 0, relación débil o nula. No implica causalidad.
      </p>
      {colorEchoesCoverageAxis && (
        <p style={{ margin: "0 0 8px", background: "#fffbeb", borderRadius: 6, padding: "6px 8px", border: "1px solid #fde68a", color: "#b45309" }}>
          El color del punto ya refleja cobertura 4G. Con cobertura en un eje la gráfica repite la
          misma dimensión; conviene usar otro eje (escolaridad, edad o rezago social).
        </p>
      )}
      <p style={{ margin: 0, fontSize: 11, color: "var(--text-3)" }}>
        Puntos aislados de la nube principal son municipios atípicos. Conviene revisarlos individualmente.
      </p>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", margin: 0 }}>
          Explorador de dispersión municipal
        </p>
        {activeKeys.size > 0 && (
          <span style={{ fontSize: 11, color: "var(--text-3)" }}>★ = variable activa en el panel lateral</span>
        )}
        <InfoTooltip wide text={tooltipContent} />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 12, alignItems: "flex-end" }}>
        <div className="metric-control">
          <label htmlFor="scatter-x">Eje horizontal</label>
          <select
            id="scatter-x"
            value={xKey}
            onChange={(e) => setXKeySafe(e.target.value as ScatterMetricKey)}
          >
            {metricOptions.map((m) => (
              <option key={m.key} value={m.key} disabled={m.key === yKey}>
                {activeKeys.has(m.key as ScatterMetricKey) ? `★ ${m.label}` : m.label}
                {m.key === yKey ? " (eje vertical)" : ""}
              </option>
            ))}
          </select>
        </div>
        {!fixedYKey && (
          <div className="metric-control">
            <label htmlFor="scatter-y">Eje vertical</label>
            <select
              id="scatter-y"
              value={yKey}
              onChange={(e) => setYKeySafe(e.target.value as ScatterMetricKey)}
            >
              {metricOptions.map((m) => (
                <option key={m.key} value={m.key} disabled={m.key === xKey}>
                  {activeKeys.has(m.key as ScatterMetricKey) ? `★ ${m.label}` : m.label}
                  {m.key === xKey ? " (eje horizontal)" : ""}
                </option>
              ))}
            </select>
          </div>
        )}
        {fixedYKey && (
          <div className="metric-control">
            <label>Eje vertical</label>
            <span style={{ fontSize: 12, color: "var(--text-2)", padding: "4px 0", display: "block" }}>
              {yMeta.label} <span style={{ color: "var(--text-3)", fontSize: 11 }}>(fijo)</span>
            </span>
          </div>
        )}
      </div>

      {/* Scatter narrative */}
      {!sameAxis && rho !== null && rhoInterpretation && (
        <p style={{ fontSize: 13, color: "var(--text-2)", margin: "0 0 12px", lineHeight: 1.6 }}>
          <strong>{filtered.length}</strong> municipios graficados. Correlación Spearman entre{" "}
          <strong>{xMeta.label}</strong> y <strong>{yMeta.label}</strong>:{" "}
          <strong
            style={{
              color:
                Math.abs(rho) >= 0.4
                  ? rho > 0 ? "var(--green)" : "var(--red)"
                  : "var(--text-2)",
            }}
          >
            ρ = {rho >= 0 ? "+" : ""}{rho.toFixed(3)}
          </strong>{" "}
          ({rhoInterpretation}).
          {pairContextual && <>{" "}{pairContextual}</>}
        </p>
      )}

      <div className="chart-frame">
        {sameAxis ? (
          <p style={{ padding: 24, color: "#64748b" }}>
            Elige dos variables distintas para comparar municipios.
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
                  if (name === "Población") return [value.toLocaleString("es-MX"), name];
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
      {outliers.length > 0 && (
        <p style={{ marginTop: 8, fontSize: "0.82rem", color: "#475569" }}>
          Municipios más atípicos en este cruce:{" "}
          <strong>{outliers.map((o) => o.name).join(", ")}</strong>.
        </p>
      )}
    </div>
  );
}
