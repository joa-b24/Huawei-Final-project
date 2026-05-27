import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import TabNarrative from "../feedback/TabNarrative";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { calcVif, olsRegression } from "../../lib/regression";
import { formatPValue } from "../../lib/format";
import type { StateCard, TipoValor, VariableRole } from "../../types/dataStandard";
import InsightBox from "../feedback/InsightBox";
import EmptyState from "../EmptyState";

type MetricOption = { id: string; label: string; unit?: string; tipoValor?: TipoValor; role?: VariableRole };

function canBeY(role: VariableRole | undefined) { return !role || role === "target" || role === "both"; }
function canBeX(role: VariableRole | undefined) { return !role || role === "explanatory" || role === "both"; }

type Props = {
  stateCards: Record<string, StateCard>;
  metricOptions: MetricOption[];
  defaultDependentVar?: string;
};

function sampleSD(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1));
}

function standardize(values: number[]) {
  const sd = sampleSD(values);
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  return sd === 0 ? values.map(() => 0) : values.map((v) => (v - mean) / sd);
}

function detectResidualOutliers(residuals: number[], stateNames: string[]): Set<string> {
  if (stateNames.length < 6) return new Set();
  const sorted = [...residuals].sort((a, b) => a - b);
  const n = sorted.length;
  const q1 = sorted[Math.floor(n * 0.25)];
  const q3 = sorted[Math.floor(n * 0.75)];
  const iqr = q3 - q1;
  if (iqr === 0) return new Set();
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;
  return new Set(stateNames.filter((_, i) => residuals[i] < lower || residuals[i] > upper));
}

const MAX_PREDICTORS = 4;

export default function MultivariateRegressionPlot({ stateCards, metricOptions, defaultDependentVar }: Props) {
  const states = useMemo(() => Object.values(stateCards), [stateCards]);
  const [dependentVar, setDependentVar] = useState(() => {
    if (defaultDependentVar) {
      const opt = metricOptions.find((m) => m.id === defaultDependentVar);
      if (canBeY(opt?.role)) return defaultDependentVar;
    }
    return metricOptions.find((m) => canBeY(m.role))?.id ?? "";
  });
  const [predictors, setPredictors] = useState<string[]>([]);
  const [result, setResult] = useState<ReturnType<typeof olsRegression>>(null);
  const [vifs, setVifs] = useState<number[]>([]);
  const [showTable, setShowTable] = useState(false);
  const [usedStateNames, setUsedStateNames] = useState<string[]>([]);
  const [outlierStateSet, setOutlierStateSet] = useState<Set<string>>(new Set());
  const [excludeModelOutliers, setExcludeModelOutliers] = useState(false);
  const [sdY, setSdY] = useState(0);
  const [sdXs, setSdXs] = useState<number[]>([]);

  const yOptions = useMemo(() => metricOptions.filter((m) => canBeY(m.role)), [metricOptions]);
  const availableX = useMemo(
    () => metricOptions.filter((m) => m.id !== dependentVar && canBeX(m.role)),
    [metricOptions, dependentVar]
  );

  function resetModelState() {
    setResult(null);
    setUsedStateNames([]);
    setOutlierStateSet(new Set());
    setExcludeModelOutliers(false);
    setSdY(0);
    setSdXs([]);
  }

  function togglePredictor(id: string) {
    setPredictors((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : prev.length < MAX_PREDICTORS ? [...prev, id] : prev
    );
    resetModelState();
  }

  function runRegression(excludedStates: Set<string> = new Set()) {
    const baseStates = excludedStates.size > 0
      ? states.filter((s) => !excludedStates.has(s.estado))
      : states;

    const y = baseStates.map((s) => s.metrics[dependentVar] ?? NaN).filter((v) => !isNaN(v));
    const validStates = baseStates.filter((s) => !isNaN(s.metrics[dependentVar] ?? NaN));
    const X_raw = validStates.map((s) => predictors.map((pid) => s.metrics[pid] ?? NaN));

    const clean = validStates
      .map((s, i) => ({ state: s.estado, y: y[i], x: X_raw[i] }))
      .filter((row) => !isNaN(row.y) && row.x.every((v) => !isNaN(v)));

    if (clean.length < predictors.length + 2) return;

    const cleanStateNames = clean.map((r) => r.state);
    const rawY = clean.map((r) => r.y);
    const rawXs = predictors.map((_, j) => clean.map((r) => r.x[j]));
    const sdYVal = sampleSD(rawY);
    const sdXVals = rawXs.map(sampleSD);

    const yClean = standardize(rawY);
    const xClean = rawXs.map(standardize);
    const X_std = clean.map((_, i) => xClean.map((col) => col[i]));

    const res = olsRegression(yClean, X_std);
    setResult(res);
    setUsedStateNames(cleanStateNames);
    setSdY(sdYVal);
    setSdXs(sdXVals);

    if (res) {
      setOutlierStateSet(detectResidualOutliers(res.residuals, cleanStateNames));
    }

    if (res && predictors.length > 1) {
      setVifs(calcVif(X_std));
    } else {
      setVifs([]);
    }
  }

  function handleOutlierToggle() {
    const newExclude = !excludeModelOutliers;
    setExcludeModelOutliers(newExclude);
    runRegression(newExclude ? outlierStateSet : new Set());
  }

  const yMeta = metricOptions.find((m) => m.id === dependentVar);
  const yUnit = yMeta?.unit ?? "";
  const yLabelShort = yMeta?.label ?? dependentVar;

  const betaData = result
    ? predictors.map((pid, i) => {
        const meta = metricOptions.find((m) => m.id === pid);
        const label = meta?.label ?? pid;
        const sdXi = sdXs[i] ?? 0;
        const betaUnstd = sdXi > 0 && sdY > 0 ? result.betas[i] * (sdY / sdXi) : NaN;
        return {
          label: label.length > 28 ? label.slice(0, 28) + "…" : label,
          beta: result.betas[i],
          betaUnstd,
          xUnit: meta?.unit ?? "",
          ci95: 1.96 * result.se[i],
          pValue: result.pValues[i],
          vif: vifs[i],
        };
      })
    : [];

  const fittedData = result && usedStateNames.length > 0
    ? result.fitted.map((yhat, i) => ({
        yhat,
        yreal: result.fitted[i] + result.residuals[i],
        residual: result.residuals[i],
        state: usedStateNames[i],
      }))
    : [];

  const rmse = result && result.residuals.length > 0
    ? Math.sqrt(result.residuals.reduce((s, r) => s + r * r, 0) / result.residuals.length)
    : null;

  const [rmseLabel, rmseColor] = !rmse ? ["", ""]
    : rmse < 0.5 ? ["excelente", "#16a34a"]
    : rmse < 0.7 ? ["bueno", "#ca8a04"]
    : rmse < 0.9 ? ["moderado", "#ea580c"]
    : ["débil", "#dc2626"];

  const fittedCombined = fittedData.length > 0 ? (() => {
    const allVals = fittedData.flatMap((d) => [d.yhat, d.yreal]);
    const dMin = Math.min(...allVals);
    const dMax = Math.max(...allVals);
    return [
      ...fittedData.map((d) => ({ ...d, diag: undefined as number | undefined })),
      { yhat: dMin, yreal: undefined as number | undefined, state: "", diag: dMin },
      { yhat: dMax, yreal: undefined as number | undefined, state: "", diag: dMax },
    ];
  })() : [];

  const missingY = yOptions.length === 0;
  const missingX = availableX.length === 0 && yOptions.length > 0;

  return (
    <div>
      {missingY && (
        <div className="regression-role-warning">
          Ninguna variable activa tiene rol <strong>Objetivo (Y)</strong> o <strong>Análisis (Y o X)</strong>.
          Asigna el rol en el catálogo de datos para usar esta sección.
        </div>
      )}
      {missingX && (
        <div className="regression-role-warning">
          No hay predictores disponibles. Añade variables con rol <strong>Predictor (X)</strong> o{" "}
          <strong>Análisis (Y o X)</strong> al análisis.
        </div>
      )}
      {/* Controls */}
      <div className="regression-controls">
        <div className="regression-field">
          <label>Variable dependiente (Y)</label>
          <select
            className="comparison-select"
            value={dependentVar}
            onChange={(e) => { setDependentVar(e.target.value); setPredictors([]); resetModelState(); }}
            style={{ minWidth: 200 }}
            disabled={missingY}
          >
            {yOptions.map((m) => (
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
            onClick={() => { setExcludeModelOutliers(false); runRegression(); }}
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
          <TabNarrative
            title="Interpretación del modelo"
            description={`R² ajustado ${Math.round(result.r2adj * 100)} % · ${betaData.filter((d) => d.pValue < 0.05).length} predictor(es) significativo(s) · ajuste ${rmseLabel || "—"}`}
          >
            <RegresionInsights
              result={result}
              betaData={betaData}
              yLabel={yLabelShort}
              rmse={rmse}
              rmseLabel={rmseLabel}
              n={usedStateNames.length}
            />
          </TabNarrative>

          {/* Model summary */}
          <p className="regression-summary">
            El modelo explica el{" "}
            <strong>{Math.round(result.r2 * 100)}%</strong> de la variación entre estados
            (ajustado: <strong>{Math.round(result.r2adj * 100)}%</strong>).{" "}
            {result.fPValue < 0.05
              ? <>La relación conjunta de los predictores es <strong>estadísticamente significativa</strong>.</>
              : <>La relación conjunta <strong>no alcanza significancia estadística</strong> — interpreta los resultados con cautela.</>
            }
            {result.r2adj < 0.1 && <> El ajuste es bajo; considera agregar más predictores o revisar la selección.</>}
          </p>

          {/* Beta chart */}
          <ResponsiveContainer width="100%" height={Math.max(180, betaData.length * 44)}>
            <BarChart data={betaData} layout="vertical" margin={{ top: 4, right: 60, bottom: 4, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "var(--text-3)" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: "var(--text-2)" }} axisLine={false} tickLine={false} width={220} />
              <Tooltip
                content={({ payload }) => {
                  if (!payload?.length) return null;
                  const d = payload[0].payload;
                  const absB = Math.abs(d.beta);
                  const strength = absB >= 0.5 ? "fuerte" : absB >= 0.25 ? "moderado" : "leve";
                  const dir = d.beta >= 0 ? "positivo" : "negativo";
                  const sig = d.pValue < 0.05 ? "significativo" : "no significativo";
                  const hasUnstd = isFinite(d.betaUnstd);
                  const sign = d.betaUnstd >= 0 ? "+" : "−";
                  const absUnstd = Math.abs(d.betaUnstd);
                  const xUnitStr = d.xUnit ? ` ${d.xUnit}` : "";
                  const yUnitStr = yUnit ? ` ${yUnit}` : "";
                  return (
                    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "8px 12px", fontSize: 12, maxWidth: 260 }}>
                      <strong>{d.label}</strong>
                      <p style={{ margin: "4px 0 2px" }}>Efecto {dir} {strength} · {sig}</p>
                      {hasUnstd && (
                        <p style={{ margin: "2px 0 2px", fontSize: 11 }}>
                          Por cada 1{xUnitStr} adicional → {sign}{absUnstd.toFixed(2)}{yUnitStr} en {yLabelShort}
                        </p>
                      )}
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--text-3)" }}>β_std = {d.beta.toFixed(3)} · p = {d.pValue < 0.001 ? "<0.001" : d.pValue.toFixed(3)}</p>
                    </div>
                  );
                }}
              />
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

          {/* Coefficients table — collapsed by default */}
          <button
            type="button"
            className="regression-detail-btn"
            onClick={() => setShowTable((v) => !v)}
          >
            {showTable ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            Ver detalle estadístico
          </button>
          {showTable && (
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
          )}

          {/* Fitted vs actual */}
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "24px 0 2px" }}>
            <p style={{ fontSize: 13, color: "var(--text-1)", margin: 0, fontWeight: 600 }}>
              ¿Qué tan bien predice el modelo?
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {excludeModelOutliers && outlierStateSet.size > 0 && (
                <span style={{ fontSize: 11, color: "var(--amber)" }}>
                  sin {outlierStateSet.size} atípico{outlierStateSet.size !== 1 ? "s" : ""}
                </span>
              )}
              {outlierStateSet.size > 0 && (
                <button
                  type="button"
                  className={`btn-ghost scatter-outlier-toggle${excludeModelOutliers ? " active" : ""}`}
                  onClick={handleOutlierToggle}
                >
                  {excludeModelOutliers ? "Mostrando atípicos" : `Excluir del modelo (${outlierStateSet.size} atíp.)`}
                </button>
              )}
            </div>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-3)", margin: "0 0 8px" }}>
            Cada punto es un estado. Los cercanos a la diagonal están bien predichos; los alejados son casos que el modelo no captura.
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={fittedCombined} margin={{ top: 8, right: 24, bottom: 24, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="yhat" type="number" tick={{ fontSize: 11, fill: "var(--text-3)" }} axisLine={false} tickLine={false} label={{ value: "Predicho (std)", position: "insideBottom", offset: -12, fontSize: 11, fill: "var(--text-3)" }} />
              <YAxis type="number" tick={{ fontSize: 11, fill: "var(--text-3)" }} axisLine={false} tickLine={false} width={36} label={{ value: "Real (std)", angle: -90, position: "insideLeft", fontSize: 11, fill: "var(--text-3)" }} />
              <Tooltip
                content={({ payload }) => {
                  const p = payload?.find((e) => e.dataKey === "yreal");
                  if (!p) return null;
                  const d = p.payload as typeof fittedData[number];
                  const absRes = Math.abs(d.residual);
                  const [qLabel, qColor] = absRes < 0.5
                    ? ["bien predicho", "#16a34a"]
                    : absRes < 1.0
                    ? ["predicción moderada", "#ca8a04"]
                    : ["predicción débil", "#dc2626"];
                  return (
                    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "6px 10px", fontSize: 12 }}>
                      {d.state && <strong style={{ display: "block", marginBottom: 4 }}>{d.state}</strong>}
                      <div>Predicho: {d.yhat.toFixed(3)}σ</div>
                      <div>Real: {d.yreal.toFixed(3)}σ</div>
                      <div>Residuo: {d.residual > 0 ? "+" : ""}{d.residual.toFixed(3)}σ</div>
                      <div style={{ marginTop: 4, color: qColor, fontWeight: 600 }}>▸ {qLabel}</div>
                    </div>
                  );
                }}
              />
              <Line dataKey="diag" dot={false} stroke="var(--text-3)" strokeDasharray="5 4" strokeWidth={1.5} isAnimationActive={false} connectNulls={false} legendType="none" />
              <Scatter dataKey="yreal" data={fittedData} fill="var(--blue)" opacity={0.7} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
          {rmse !== null && (
            <p style={{ fontSize: 12, color: "var(--text-3)", margin: "4px 0 0", textAlign: "center" }}>
              RMSE = <strong style={{ color: rmseColor }}>{rmse.toFixed(3)}σ</strong>
              {" "}— ajuste <strong style={{ color: rmseColor }}>{rmseLabel}</strong>
              <span style={{ opacity: 0.7 }}>{" "}(escala estandarizada; RMSE = 1σ equivale a no mejorar sobre la media)</span>
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ── Narrativa del modelo ──────────────────────────────────────────────────────

type BetaItem = { label: string; beta: number; pValue: number; vif?: number };

function RegresionInsights({
  result,
  betaData,
  yLabel,
  rmse,
  rmseLabel,
  n,
}: {
  result: NonNullable<ReturnType<typeof import("../../lib/regression").olsRegression>>;
  betaData: BetaItem[];
  yLabel: string;
  rmse: number | null;
  rmseLabel: string;
  n: number;
}) {
  const r2pct = Math.round(result.r2 * 100);
  const r2adjPct = Math.round(result.r2adj * 100);
  const r2Quality = r2adjPct >= 70 ? "alto" : r2adjPct >= 40 ? "moderado" : "bajo";

  const sigPredictors = betaData.filter((d) => d.pValue < 0.05);
  const sorted = [...betaData].sort((a, b) => Math.abs(b.beta) - Math.abs(a.beta));
  const top = sorted[0];
  const highVif = betaData.filter((d) => (d.vif ?? 0) > 5);

  const S = { lineHeight: 1.65, color: "#334155", margin: "0 0 8px" } as const;

  return (
    <div>
      <p style={S}>
        El modelo explica el <strong>{r2pct}&nbsp;%</strong> de la variación en <strong>{yLabel}</strong> entre
        los {n} estados (R² ajustado: <strong>{r2adjPct}&nbsp;%</strong> — poder explicativo <strong>{r2Quality}</strong>).{" "}
        {result.fPValue < 0.05
          ? <>El conjunto de predictores es <strong>estadísticamente significativo</strong> (prueba F, p&nbsp;&lt;&nbsp;0.05).</>
          : <>El conjunto de predictores <strong>no alcanza significancia estadística</strong> — interpreta los coeficientes con cautela.</>
        }
      </p>

      {top && (
        <p style={S}>
          El predictor con mayor contribución marginal es <strong>{top.label}</strong>{" "}
          (β&nbsp;=&nbsp;{top.beta.toFixed(2)}, efecto {top.beta > 0 ? "positivo" : "negativo"},{" "}
          {top.pValue < 0.05 ? "estadísticamente significativo" : `no significativo con n = ${n}`}).{" "}
          {sigPredictors.length > 1 && (
            <>Predictores significativos: <strong>{sigPredictors.map((d) => d.label).join(", ")}</strong>.</>
          )}
          {sigPredictors.length === 0 && betaData.length > 0 && (
            <>Ningún predictor individual alcanza significancia estadística con la muestra disponible; el patrón puede ser indicativo pero no concluyente.</>
          )}
        </p>
      )}

      {highVif.length > 0 && (
        <p style={S}>
          <strong>Alerta de multicolinealidad:</strong>{" "}
          <strong>{highVif.map((d) => d.label).join(", ")}</strong>{" "}
          {highVif.length === 1 ? "presenta" : "presentan"} VIF&nbsp;&gt;&nbsp;5, lo que indica correlación alta entre predictores.
          Los coeficientes beta de estas variables pueden estar inflados o ser inestables.
        </p>
      )}

      {rmse !== null && (
        <p style={{ ...S, margin: 0 }}>
          El ajuste es <strong>{rmseLabel}</strong> (RMSE&nbsp;=&nbsp;{rmse.toFixed(3)}σ).{" "}
          {rmseLabel === "excelente" || rmseLabel === "bueno"
            ? "El modelo captura bien la variación entre estados para este conjunto de predictores."
            : "Considera incluir predictores teóricamente relevantes o revisar la especificación del modelo."
          }
        </p>
      )}
    </div>
  );
}
