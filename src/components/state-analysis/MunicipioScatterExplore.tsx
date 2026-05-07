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

function pickMetric(m: MunicipioAnalyticsRecord, k: AnalysisMetricKey): number {
  const v = m[k];
  return typeof v === "number" && Number.isFinite(v) ? v : Number.NaN;
}

type Props = {
  municipios: MunicipioAnalyticsRecord[];
};

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
        z: m.pobtot_iter
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

  return (
    <div>
      <div className="section-heading">
        <h2>Exploración municipal (dispersión)</h2>
        <p>
          Cada punto es un municipio; el tamaño refleja la población censal. Spearman entre ejes seleccionados:{" "}
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
            <Scatter data={filtered} fill="#7c3aed" />
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
