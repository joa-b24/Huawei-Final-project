import { useEffect, useMemo, useState } from "react";
import { useAppContext } from "../context/AppContext";
import type { AppData } from "../services/DataService";
import CorrelationBarChart from "../components/charts/CorrelationBarChart";
import PairScatterChart from "../components/charts/PairScatterChart";
import MultivariateRegressionPlot from "../components/charts/MultivariateRegressionPlot";
import EmptyState from "../components/EmptyState";
import InfoTooltip from "../components/feedback/InfoTooltip";
import InsightBox from "../components/feedback/InsightBox";
import TabNarrative from "../components/feedback/TabNarrative";
import { corrPValue } from "../lib/stats";
import type { StateCard } from "../types/dataStandard";
import type { StateMetricRecord } from "../types/dataset";
import ComparisonGroupSelector, { GROUP_COLORS } from "../components/sidebar/ComparisonGroupSelector";

function buildStateCardsFromRecords(records: StateMetricRecord[]): Record<string, StateCard> {
  const result: Record<string, StateCard> = {};
  for (const r of records) {
    result[r.state] = { estado: r.state, region: r.region ?? "", metrics: r.metrics };
  }
  return result;
}

type Props = { appData: AppData };

export default function RelacionesTab({ appData }: Props) {
  const { state: appState } = useAppContext();
  const { primaryState, activeVariableIds } = appState;
  const { dataset, correlations } = appData;

  const effectiveStateCards = useMemo(
    () => buildStateCardsFromRecords(dataset.records),
    [dataset.records]
  );

  const [selectedX, setSelectedX] = useState<string | null>(null);
  const [selectedY, setSelectedY] = useState<string | null>(null);

  // ── Grupos de comparación en scatter ─────────────────────────────────────
  const [comparisonGroups, setComparisonGroups] = useState<string[]>(["nacional"]);
  const [showGroups, setShowGroups] = useState(false);

  useEffect(() => { if (!comparisonGroups.some((g) => g !== "nacional")) setShowGroups(false); }, [comparisonGroups]);

  const stateRegionMap = useMemo(
    () => Object.fromEntries(dataset.records.map((r) => [r.state, r.region ?? ""])),
    [dataset.records]
  );
  const stateRegion = primaryState ? (stateRegionMap[primaryState] ?? null) : null;
  const regionGroupId = stateRegion ? `r:${stateRegion}` : null;

  const primaryPcaRecord = useMemo(
    () => appData.pcaResults?.records.find((r) => r.state === primaryState) ?? null,
    [appData.pcaResults, primaryState]
  );
  const primaryClusterGroupId = primaryPcaRecord !== null ? `c:${primaryPcaRecord.cluster}` : null;
  const primaryClusterLabel = primaryPcaRecord !== null
    ? (appData.pcaResults?.cluster_stats[String(primaryPcaRecord.cluster)]?.label ?? `Cluster ${primaryPcaRecord.cluster}`)
    : null;

  const allStateNames = useMemo(() => dataset.records.map((r) => r.state), [dataset.records]);

  const groupColorMap = useMemo(() => {
    const map = new Map<string, string>();
    comparisonGroups.forEach((g, i) => map.set(g, GROUP_COLORS[i] ?? GROUP_COLORS[GROUP_COLORS.length - 1]));
    return map;
  }, [comparisonGroups]);

  const nonNacionalGroups = comparisonGroups.filter((g) => g !== "nacional");

  const groupStateColors = useMemo((): Map<string, string> => {
    if (!showGroups || !nonNacionalGroups.length) return new Map();
    const map = new Map<string, string>();
    nonNacionalGroups.forEach((g) => {
      const color = groupColorMap.get(g) ?? "#6b7280";
      if (g.startsWith("r:")) {
        dataset.records.filter((r) => r.region === g.slice(2)).forEach((r) => map.set(r.state, color));
      } else if (g.startsWith("c:")) {
        (appData.pcaResults?.cluster_stats[g.slice(2)]?.states ?? []).forEach((s) => map.set(s, color));
      } else {
        map.set(g, color);
      }
    });
    return map;
  }, [showGroups, nonNacionalGroups, groupColorMap, dataset.records, appData.pcaResults]);

  const xVarId = selectedX && activeVariableIds.includes(selectedX)
    ? selectedX
    : activeVariableIds[0] ?? null;
  const yVarId = selectedY && activeVariableIds.includes(selectedY) && selectedY !== xVarId
    ? selectedY
    : activeVariableIds.find((id) => id !== xVarId) ?? null;

  const corrRows = useMemo(() => {
    if (!yVarId || !correlations.pearson.variables.length) return [];
    const { variables, matrix } = correlations.pearson;
    const refIdx = variables.indexOf(yVarId);
    if (refIdx === -1) return [];
    const n = dataset.records.length;
    return activeVariableIds
      .filter((id) => id !== yVarId)
      .map((id) => {
        const idx = variables.indexOf(id);
        const r =
          idx !== -1 && Array.isArray(matrix[refIdx]) ? (matrix[refIdx] as number[])[idx] : NaN;
        return {
          variableId: id,
          label: dataset.metricCatalog.find((m) => m.id === id)?.label ?? id,
          r: isNaN(r) ? 0 : r,
          pValue: isNaN(r) ? 1 : corrPValue(r, n),
        };
      })
      .filter((row) => isFinite(row.r));
  }, [yVarId, activeVariableIds, correlations, dataset]);

  const scatterData = useMemo(() => {
    if (!xVarId || !yVarId) return [];
    return dataset.records
      .filter(
        (r) =>
          r.metrics[xVarId] !== undefined &&
          !isNaN(r.metrics[xVarId]) &&
          r.metrics[yVarId] !== undefined &&
          !isNaN(r.metrics[yVarId])
      )
      .map((r) => ({ state: r.state, x: r.metrics[xVarId], y: r.metrics[yVarId] }));
  }, [xVarId, yVarId, dataset.records]);

  const getLabelAndUnit = (varId: string | undefined) => {
    if (!varId) return { label: "", unit: "" };
    const m = dataset.metricCatalog.find((m) => m.id === varId);
    return { label: m?.label ?? varId, unit: m?.unit ?? "" };
  };

  const { label: xLabel, unit: xUnit } = getLabelAndUnit(xVarId ?? undefined);
  const { label: yLabel, unit: yUnit } = getLabelAndUnit(yVarId ?? undefined);

  const metricOptions = useMemo(() => {
    const roleMap = new Map(appData.variablesCatalog.map((v) => [v.variable_id, v.role ?? "both"]));
    return activeVariableIds.map((id) => {
      const m = dataset.metricCatalog.find((mc) => mc.id === id);
      return { id, label: m?.label ?? id, unit: m?.unit ?? "", role: roleMap.get(id) ?? "both" };
    });
  }, [activeVariableIds, dataset.metricCatalog, appData.variablesCatalog]);

  const hasCorrData = correlations.pearson.variables.length > 0;

  return (
    <div className="tab-content">
      <TabNarrative
        title="Análisis de impacto"
        description="Relaciones estadísticas entre variables activas: correlación de Pearson, dispersión por par de estados y regresión OLS multivariada estandarizada."
      >
        {corrRows.length > 0 ? (
          <ImpactoNarrative yLabel={yLabel} corrRows={corrRows} n={dataset.records.length} />
        ) : (
          <p>Activa al menos 2 variables con datos de correlación para ver el análisis.</p>
        )}
      </TabNarrative>

      {activeVariableIds.length < 2 && (
        <InsightBox title="Activa más variables">
          Selecciona al menos 2 variables en el panel lateral para ver correlaciones y scatter.
        </InsightBox>
      )}

      {activeVariableIds.length >= 2 && (
        <>
          <div className="corr-var-selectors">
            <div className="corr-var-selector">
              <span className="corr-var-selector__label">Variable de objetivo</span>
              <select
                className="comparison-select"
                value={yVarId ?? ""}
                onChange={(e) => setSelectedY(e.target.value)}
              >
                {activeVariableIds.map((id) => (
                  <option key={id} value={id}>{getLabelAndUnit(id).label}</option>
                ))}
              </select>
            </div>
            <div className="corr-var-selector">
              <span className="corr-var-selector__label">Variable de dispersión (X)</span>
              <select
                className="comparison-select"
                value={xVarId ?? ""}
                onChange={(e) => setSelectedX(e.target.value)}
              >
                {activeVariableIds.map((id) => (
                  <option key={id} value={id}>{getLabelAndUnit(id).label}</option>
                ))}
              </select>
            </div>
          </div>

        <section className="comparison-panel" style={{ marginTop: 0, marginBottom: 16 }}>
          <div className="comparison-panel__header">
            <span className="comparison-panel__title">Grupos de comparación (scatter)</span>
            {nonNacionalGroups.length > 0 && (
              <button
                type="button"
                className={`groups-toggle-btn${showGroups ? " active" : ""}`}
                onClick={() => setShowGroups((v) => !v)}
                title="Colorear puntos del scatter por grupo"
              >
                Mostrar en scatter
              </button>
            )}
          </div>
          <ComparisonGroupSelector
            groups={comparisonGroups}
            onGroupsChange={setComparisonGroups}
            regionGroupId={regionGroupId}
            primaryClusterGroupId={primaryClusterGroupId}
            primaryClusterLabel={primaryClusterLabel}
            primaryState={primaryState}
            allStateNames={allStateNames}
            groupColorMap={groupColorMap}
          />
        </section>

        <div className="two-col">
          <section className="panel">
            <div className="panel-title-row">
              <p className="panel-title" style={{ margin: 0 }}>Correlaciones con: {yLabel}</p>
              <InfoTooltip wide text={
                <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--text-2)" }}>
                  <p style={{ fontWeight: 700, margin: "0 0 6px", color: "var(--text-1)" }}>Coeficiente de Pearson (r)</p>
                  <p style={{ margin: "0 0 8px" }}>
                    Mide la asociación <strong>lineal</strong> entre cada variable X y la Y seleccionada. Rango: −1 a +1.
                  </p>
                  <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 8, fontSize: 11 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border)" }}>
                        <th style={{ textAlign: "left", padding: "2px 6px 4px 0", color: "var(--text-3)", fontWeight: 600 }}>|r|</th>
                        <th style={{ textAlign: "left", padding: "2px 0 4px", color: "var(--text-3)", fontWeight: 600 }}>Intensidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {([["≥ 0.7", "Fuerte"], ["0.4 – 0.7", "Moderada"], ["0.2 – 0.4", "Débil"], ["< 0.2", "Muy débil / nula"]] as const).map(([rng, lbl]) => (
                        <tr key={rng} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: "3px 6px 3px 0", fontVariantNumeric: "tabular-nums" }}>{rng}</td>
                          <td style={{ padding: "3px 0" }}>{lbl}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p style={{ margin: 0, color: "var(--text-3)", fontSize: 11 }}>
                    Correlación no implica causalidad. Una r alta puede reflejar un factor latente común (p.ej. nivel de desarrollo general del estado).
                  </p>
                </div>
              } />
            </div>
            {corrRows.length > 0 ? (
              <CorrelationBarChart rows={corrRows} />
            ) : hasCorrData ? (
              <EmptyState
                title="Variable no encontrada"
                description="La variable seleccionada no está en la matriz de correlaciones."
              />
            ) : (
              <EmptyState
                title="Sin correlaciones precalculadas"
                description="Ejecuta npm run pipeline:layer1 para generar correlations.json."
              />
            )}
          </section>

          <section className="panel">
            <div className="panel-title-row">
              <p className="panel-title" style={{ margin: 0 }}>{xLabel} vs {yLabel}</p>
              <InfoTooltip wide text={
                <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--text-2)" }}>
                  <p style={{ fontWeight: 700, margin: "0 0 4px", color: "var(--text-1)" }}>Diagrama de dispersión</p>
                  <p style={{ margin: "0 0 10px" }}>
                    Cada punto es un estado. La <strong>línea de tendencia</strong> es una regresión OLS bivariada. Una nube diagonal indica correlación; una nube horizontal indica independencia. Estados muy alejados de la línea son casos atípicos que merecen análisis.
                  </p>
                  <p style={{ margin: 0 }}>
                    El <strong style={{ color: "var(--blue)" }}>punto resaltado</strong> corresponde al estado seleccionado. Pasa el cursor sobre cualquier punto para identificar el estado.
                  </p>
                </div>
              } />
            </div>
            <PairScatterChart
              data={scatterData}
              xLabel={xLabel}
              yLabel={yLabel}
              highlightState={primaryState ?? undefined}
              xUnit={xUnit}
              yUnit={yUnit}
              groupStateColors={showGroups ? groupStateColors : undefined}
            />
          </section>
        </div>
        </>
      )}

      <section className="panel">
        <div className="panel-title-row">
          <p className="panel-title" style={{ margin: 0 }}>Regresión multivariada (OLS estandarizado)</p>
          <InfoTooltip wide text={
            <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--text-2)" }}>
              <p style={{ fontWeight: 700, margin: "0 0 4px", color: "var(--text-1)" }}>Coeficientes beta (β estandarizados)</p>
              <p style={{ margin: "0 0 10px" }}>
                Cada β indica cuántas desviaciones estándar cambia Y por cada desviación estándar de X, <em>manteniendo las demás variables constantes</em>. Al estar estandarizados, son comparables entre sí: mayor |β| = mayor contribución marginal.
              </p>
              <p style={{ fontWeight: 700, margin: "0 0 4px", color: "var(--text-1)" }}>Limitaciones</p>
              <p style={{ margin: 0, color: "var(--text-3)" }}>
                Con solo 32 observaciones (estados), el modelo puede sobreajustarse si hay muchas variables. Alta multicolinealidad entre X's infla los errores estándar. Interpretar como asociación, no como causalidad.
              </p>
            </div>
          } />
        </div>
        <MultivariateRegressionPlot
          stateCards={effectiveStateCards}
          metricOptions={metricOptions}
          defaultDependentVar={xVarId}
        />
      </section>
    </div>
  );
}

// ── Narrativa automática ──────────────────────────────────────────────────────

function corrStrength(r: number): string {
  const abs = Math.abs(r);
  if (abs >= 0.7) return "fuerte";
  if (abs >= 0.4) return "moderada";
  if (abs >= 0.2) return "débil";
  return "muy débil";
}

function ImpactoNarrative({
  yLabel,
  corrRows,
  n,
}: {
  yLabel: string;
  corrRows: { label: string; r: number; pValue: number }[];
  n: number;
}) {
  const sorted = [...corrRows].sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
  const top3 = sorted.slice(0, 3);
  const significant = corrRows.filter((c) => c.pValue < 0.05);
  const posSignif = significant.filter((c) => c.r > 0);
  const negSignif = significant.filter((c) => c.r < 0);

  const S = { lineHeight: 1.65, color: "#334155", margin: "0 0 8px" } as const;

  return (
    <div>
      <p style={S}>
        Se analiza la relación lineal de <strong>{corrRows.length}</strong> variable{corrRows.length !== 1 ? "s" : ""} con{" "}
        <strong>{yLabel}</strong>, usando los {n} estados como observaciones.{" "}
        {significant.length > 0 ? (
          <><strong>{significant.length}</strong> de {corrRows.length} {significant.length === 1 ? "alcanza" : "alcanzan"} significancia estadística (p&nbsp;&lt;&nbsp;0.05).</>
        ) : (
          <>Ninguna correlación alcanza significancia estadística con n&nbsp;=&nbsp;{n}; las tendencias son indicativas.</>
        )}
      </p>

      {top3.length > 0 && (
        <p style={S}>
          Las asociaciones más fuertes son:{" "}
          {top3.map((c, i) => (
            <span key={c.label}>
              {i > 0 && "; "}
              <strong>{c.label}</strong>{" "}(r&nbsp;=&nbsp;{c.r.toFixed(2)},{" "}
              {corrStrength(c.r)} {c.r > 0 ? "positiva" : "negativa"}{c.pValue < 0.05 ? <>, p&nbsp;&lt;&nbsp;0.05</> : null})
            </span>
          ))}.
        </p>
      )}

      {(posSignif.length > 0 || negSignif.length > 0) && (
        <p style={S}>
          {posSignif.length > 0 && (
            <>
              Asociación <strong>positiva</strong> significativa con:{" "}
              <strong>{posSignif.map((c) => c.label).join(", ")}</strong> —{" "}
              {posSignif.length === 1 ? "cuando esta variable aumenta" : "cuando estas variables aumentan"},{" "}
              <strong>{yLabel}</strong> tiende a aumentar también.{" "}
            </>
          )}
          {negSignif.length > 0 && (
            <>
              Asociación <strong>negativa</strong> significativa con:{" "}
              <strong>{negSignif.map((c) => c.label).join(", ")}</strong> —{" "}
              {negSignif.length === 1 ? "cuando esta variable aumenta" : "cuando estas variables aumentan"},{" "}
              <strong>{yLabel}</strong> tiende a disminuir.
            </>
          )}
        </p>
      )}

      <p style={{ lineHeight: 1.55, color: "var(--text-3)", fontSize: 12, margin: 0 }}>
        Correlación no implica causalidad. Con n&nbsp;=&nbsp;{n} estados, se necesita |r|&nbsp;&gt;&nbsp;~0.35 para alcanzar p&nbsp;&lt;&nbsp;0.05.
        Explora el diagrama de dispersión para identificar estados atípicos que puedan estar influyendo en el coeficiente.
      </p>
    </div>
  );
}
