import { useMemo, useState } from "react";
import InfoTooltip from "../feedback/InfoTooltip";

type GeoFeature = { properties: Record<string, any> };
type VarRecord = { cve_mun: string; value: number };
type CombinedVar = {
  year: number;
  records: VarRecord[];
  stats?: { count: number; mean: number; median: number; std: number; min: number; max: number; q1: number; q3: number };
};
type CombinedData = { state_code: string; variables: Record<string, CombinedVar> };
export type MunVar = { id: string; label: string; unit: string; direction?: string };

type Props = {
  features: GeoFeature[];
  combined: CombinedData;
  munVars: MunVar[];
};

type Bin = { lo: number; hi: number; count: number };

function buildBins(values: number[], numBins = 10): Bin[] {
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return [{ lo: min, hi: max, count: values.length }];
  const step = (max - min) / numBins;
  const bins: Bin[] = Array.from({ length: numBins }, (_, i) => ({
    lo: min + i * step,
    hi: min + (i + 1) * step,
    count: 0,
  }));
  for (const v of values) {
    const idx = Math.min(Math.floor((v - min) / step), numBins - 1);
    bins[idx].count++;
  }
  return bins;
}

export default function MunicipioDistPanel({ features, combined, munVars }: Props) {
  const [varId, setVarId] = useState(munVars[0]?.id ?? "");

  const currentVar = munVars.find((v) => v.id === varId) ?? munVars[0];
  const unit = currentVar?.unit;
  const varLabel = currentVar?.label ?? varId;

  const values = useMemo(() => {
    const records = combined.variables[varId]?.records ?? [];
    const valueMap = new Map(records.map((r) => [r.cve_mun, r.value]));
    return features
      .map((f) => valueMap.get(f.properties.cvegeo) ?? null)
      .filter((v): v is number => v !== null && !isNaN(v));
  }, [features, combined, varId]);

  const preStats = combined.variables[varId]?.stats;
  const mean = preStats?.mean ?? (values.length ? values.reduce((s, v) => s + v, 0) / values.length : null);
  const median = useMemo(() => {
    if (preStats?.median !== undefined) return preStats.median;
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }, [values, preStats]);

  const bins = useMemo(() => buildBins(values), [values]);
  const maxCount = Math.max(...bins.map((b) => b.count), 1);

  return (
    <section className="panel">
      <div className="ranking-panel-header">
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <p className="panel-title" style={{ margin: 0 }}>Distribución municipal</p>
          <InfoTooltip text="Histograma de los municipios del estado para la variable seleccionada. Cada barra muestra cuántos municipios caen en ese rango de valores. La media y mediana se calculan sobre los municipios con datos disponibles." />
        </div>
        {munVars.length > 1 && (
          <select
            className="ranking-var-select"
            value={varId}
            onChange={(e) => setVarId(e.target.value)}
          >
            {munVars.map((v) => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </select>
        )}
      </div>

      {!values.length ? (
        <p style={{ color: "var(--text-3)", fontSize: 13, textAlign: "center", padding: "24px 0" }}>
          Sin datos para esta variable.
        </p>
      ) : (
        <div>
          <div
            style={{
              display: "flex",
              gap: 2,
              alignItems: "flex-end",
              height: 110,
              padding: "0 4px",
              marginBottom: 4,
            }}
          >
            {bins.map((bin, i) => (
              <div
                key={i}
                title={`${bin.lo.toFixed(1)}–${bin.hi.toFixed(1)}${unit ? " " + unit : ""}: ${bin.count} municipios`}
                style={{
                  flex: 1,
                  height: `${(bin.count / maxCount) * 100}%`,
                  background: "var(--blue)",
                  opacity: 0.65,
                  borderRadius: "2px 2px 0 0",
                  minHeight: bin.count > 0 ? 2 : 0,
                  cursor: "default",
                }}
              />
            ))}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 10,
              color: "var(--text-3)",
              padding: "0 4px",
            }}
          >
            <span>{bins[0]?.lo.toFixed(1)}</span>
            <span>
              {bins[bins.length - 1]?.hi.toFixed(1)}
              {unit ? ` ${unit}` : ""}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              gap: 16,
              justifyContent: "center",
              marginTop: 8,
              fontSize: 11,
              color: "var(--text-3)",
            }}
          >
            {mean !== null && (
              <span>
                Media:{" "}
                <strong style={{ color: "var(--text-2)" }}>
                  {mean.toFixed(1)}
                  {unit ? ` ${unit}` : ""}
                </strong>
              </span>
            )}
            {median !== null && (
              <span>
                Mediana:{" "}
                <strong style={{ color: "var(--text-2)" }}>
                  {median.toFixed(1)}
                  {unit ? ` ${unit}` : ""}
                </strong>
              </span>
            )}
            <span>
              n = <strong style={{ color: "var(--text-2)" }}>{values.length}</strong>
            </span>
          </div>

          <p
            style={{
              textAlign: "center",
              fontSize: 11,
              color: "var(--text-3)",
              margin: "4px 0 0",
            }}
          >
            {varLabel} — distribución entre municipios del estado
          </p>
        </div>
      )}
    </section>
  );
}
