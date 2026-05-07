import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { calcVif, olsRegression } from "../../lib/regression";
import { formatPValue } from "../../lib/format";
import type { StateCard, TipoValor } from "../../types/dataStandard";
import InsightBox from "../feedback/InsightBox";
import EmptyState from "../EmptyState";

type MetricOption = { id: string; label: string; tipoValor?: TipoValor };

type Props = {
  stateCards: Record<string, StateCard>;
  metricOptions: MetricOption[];
  defaultDependentVar?: string;
};

function standardize(values: number[]) {
  const n = values.length;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1));
  return sd === 0 ? values.map(() => 0) : values.map((v) => (v - mean) / sd);
}

const MAX_PREDICTORS = 4;

export default function MultivariateRegressionPlot({ stateCards, metricOptions, defaultDependentVar }: Props) {
  const states = useMemo(() => Object.values(stateCards), [stateCards]);
  const [dependentVar, setDependentVar] = useState(defaultDependentVar ?? metricOptions[0]?.id ?? "");
  const [predictors, setPredictors] = useState<string[]>([]);
  const [result, setResult] = useState<ReturnType<typeof olsRegression>>(null);
  const [vifs, setVifs] = useState<number[]>([]);

  const availableX = metricOptions.filter((m) => m.id !== dependentVar);

  function togglePredictor(id: string) {
    setPredictors((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : prev.length < MAX_PREDICTORS ? [...prev, id] : prev
    );
    setResult(null);
  }

  function runRegression() {
    const y = states.map((s) => s.metrics[dependentVar] ?? NaN).filter((v) => !isNaN(v));
    const validStates = states.filter((s) => !isNaN(s.metrics[dependentVar] ?? NaN));
    const X_raw = validStates.map((s) => predictors.map((pid) => s.metrics[pid] ?? NaN));

    // Drop rows with any NaN
    const clean = validStates
      .map((s, i) => ({ y: y[i], x: X_raw[i] }))
      .filter((row) => !isNaN(row.y) && row.x.every((v) => !isNaN(v)));

    if (clean.length < predictors.length + 2) return;

    const yClean = standardize(clean.map((r) => r.y));
    const xClean = predictors.map((_, j) => standardize(clean.map((r) => r.x[j])));
    const X_std = clean.map((_, i) => xClean.map((col) => col[i]));

    const res = olsRegression(yClean, X_std);
    setResult(res);
    if (res && predictors.length > 1) {
      setVifs(calcVif(X_std));
    } else {
      setVifs([]);
    }
  }

  const betaData = result
    ? predictors.map((pid, i) => {
        const label = metricOptions.find((m) => m.id === pid)?.label ?? pid;
        return {
          label: label.length > 28 ? label.slice(0, 28) + "…" : label,
          beta: result.betas[i],
          ci95: 1.96 * result.se[i],
          pValue: result.pValues[i],
          vif: vifs[i],
        };
      })
    : [];

  const fittedData = result
    ? result.fitted.map((yhat, i) => ({ yhat, yreal: result.fitted[i] + result.residuals[i] }))
    : [];

  return (
    <div>
      {/* Controls */}
      <div className="regression-controls">
        <div className="regression-field">
          <label>Variable dependiente (Y)</label>
          <select
            className="comparison-select"
            value={dependentVar}
            onChange={(e) => { setDependentVar(e.target.value); setPredictors([]); setResult(null); }}
            style={{ minWidth: 200 }}
          >
            {metricOptions.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>

        <div className="regression-field" style={{ flex: 1 }}>
          <label>Predictores X (máx. {MAX_PREDICTORS})</label>
          <div className="regression-x-chips">
            {availableX.map((m) => {
              const isActive = predictors.includes(m.id);
              const isDisabled = !isActive && predictors.length >= MAX_PREDICTORS;
              return (
                <button
                  key={m.id}
                  type="button"
                  className={`regression-chip${isActive ? " active" : ""}${isDisabled ? " disabled" : ""}`}
                  onClick={() => !isDisabled && togglePredictor(m.id)}
                  title={isDisabled ? `Máximo ${MAX_PREDICTORS} predictores` : m.label}
                >
                  {m.label.length > 24 ? m.label.slice(0, 24) + "…" : m.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="regression-field">
          <label style={{ opacity: 0 }}>Acción</label>
          <button
            className="regression-btn"
            disabled={predictors.length === 0}
            onClick={runRegression}
            type="button"
          >
            Calcular modelo
          </button>
        </div>
      </div>

      {predictors.length >= 4 && (
        <InsightBox title="Advertencia de sobreajuste">
          Con n = {states.length} estados y {predictors.length} predictores, el modelo puede sobreajustarse.
        </InsightBox>
      )}

      {!result && (
        <EmptyState title="Modelo no calculado" description="Selecciona predictores y presiona «Calcular modelo»." />
      )}

      {result && (
        <>
          {/* R² stats */}
          <div className="regression-stats">
            <div className="regression-stat">
              <p className="regression-stat__label">R²</p>
              <p className="regression-stat__value">{result.r2.toFixed(3)}</p>
            </div>
            <div className="regression-stat">
              <p className="regression-stat__label">R² ajustada</p>
              <p className="regression-stat__value">{result.r2adj.toFixed(3)}</p>
            </div>
            <div className="regression-stat">
              <p className="regression-stat__label">F / p-value</p>
              <p className="regression-stat__value" style={{ fontSize: 14 }}>
                {result.fStat.toFixed(1)} / {formatPValue(result.fPValue)}
              </p>
            </div>
          </div>

          {result.r2adj < 0.1 && (
            <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 12 }}>
              El modelo explica poca variación (R²adj &lt; 0.10). Considera agregar otros predictores.
            </p>
          )}

          {/* Beta chart */}
          <ResponsiveContainer width="100%" height={Math.max(180, betaData.length * 44)}>
            <BarChart data={betaData} layout="vertical" margin={{ top: 4, right: 60, bottom: 4, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "var(--text-3)" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: "var(--text-2)" }} axisLine={false} tickLine={false} width={220} />
              <Tooltip formatter={(v: number, _: string, props: any) => [`β = ${v.toFixed(3)} (p ${formatPValue(props.payload.pValue)})`, "Coef. estandarizado"]} />
              <Bar dataKey="beta" radius={[0, 3, 3, 0]} isAnimationActive={false}>
                {betaData.map((d, i) => (
                  <Cell
                    key={i}
                    fill={d.beta >= 0 ? "var(--green)" : "var(--red)"}
                    opacity={d.pValue < 0.05 ? 1 : 0.4}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Coefficients table */}
          <table className="regression-coef-table">
            <thead>
              <tr>
                <th>Variable</th>
                <th>β (std)</th>
                <th>SE</th>
                <th>t</th>
                <th>p-value</th>
                <th>Sig.</th>
                {vifs.length > 0 && <th>VIF</th>}
              </tr>
            </thead>
            <tbody>
              {betaData.map((d, i) => (
                <tr key={i}>
                  <td style={{ fontFamily: "inherit", color: "var(--text-2)" }}>
                    {d.label} {d.vif > 5 && <span title="Posible colinealidad" style={{ color: "var(--amber)" }}>⚠</span>}
                  </td>
                  <td>{result.betas[i].toFixed(3)}</td>
                  <td>{result.se[i].toFixed(3)}</td>
                  <td>{result.tStats[i].toFixed(2)}</td>
                  <td>{result.pValues[i].toFixed(3)}</td>
                  <td style={{ color: "var(--text-3)" }}>{formatPValue(d.pValue)}</td>
                  {vifs.length > 0 && <td style={{ color: d.vif > 5 ? "var(--amber)" : "inherit" }}>{isFinite(d.vif) ? d.vif.toFixed(1) : "∞"}</td>}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Fitted vs actual */}
          <p style={{ fontSize: 12, color: "var(--text-3)", margin: "20px 0 6px", fontWeight: 600 }}>
            Valores reales vs. predichos — R² = {result.r2.toFixed(2)}
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <ScatterChart margin={{ top: 8, right: 24, bottom: 24, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="yhat" type="number" name="Predicho" tick={{ fontSize: 11, fill: "var(--text-3)" }} axisLine={false} tickLine={false} label={{ value: "Predicho (std)", position: "insideBottom", offset: -12, fontSize: 11, fill: "var(--text-3)" }} />
              <YAxis dataKey="yreal" type="number" name="Real" tick={{ fontSize: 11, fill: "var(--text-3)" }} axisLine={false} tickLine={false} width={36} label={{ value: "Real (std)", angle: -90, position: "insideLeft", fontSize: 11, fill: "var(--text-3)" }} />
              <Tooltip formatter={(v: number, name: string) => [v.toFixed(2), name]} />
              <Scatter data={fittedData} fill="var(--blue)" opacity={0.7} isAnimationActive={false} />
            </ScatterChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}
