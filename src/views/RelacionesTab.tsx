import { useMemo, useState } from "react";
import { useAppContext } from "../context/AppContext";
import type { AppData } from "../services/DataService";
import CorrelationBarChart from "../components/charts/CorrelationBarChart";
import PairScatterChart from "../components/charts/PairScatterChart";
import BoxplotPanel from "../components/charts/BoxplotPanel";
import CorrelationMatrixTable from "../components/charts/CorrelationMatrixTable";
import MultivariateRegressionPlot from "../components/charts/MultivariateRegressionPlot";
import EmptyState from "../components/EmptyState";
import InsightBox from "../components/feedback/InsightBox";
import { corrPValue } from "../lib/stats";
import type { StateCard } from "../types/dataStandard";
import type { StateMetricRecord } from "../types/dataset";

function buildStateCardsFromRecords(records: StateMetricRecord[]): Record<string, StateCard> {
  const result: Record<string, StateCard> = {};
  for (const r of records) {
    result[r.state] = {
      estado: r.state,
      region: r.region ?? "",
      metrics: r.metrics,
      overall_score: 0,
      color_code: "yellow",
    };
  }
  return result;
}

type Props = { appData: AppData };

export default function RelacionesTab({ appData }: Props) {
  const { state: appState } = useAppContext();
  const { primaryState, activeVariableIds } = appState;
  const { dataset, correlations, stateCards } = appData;

  const effectiveStateCards = useMemo(
    () =>
      Object.keys(stateCards).length > 0
        ? stateCards
        : buildStateCardsFromRecords(dataset.records),
    [stateCards, dataset.records]
  );

  const [selectedX, setSelectedX] = useState<string | null>(null);
  const [selectedY, setSelectedY] = useState<string | null>(null);

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

  const boxplotVars = useMemo(
    () =>
      activeVariableIds.map((varId) => {
        const metricDef = dataset.metricCatalog.find((m) => m.id === varId);
        const primaryRecord = dataset.records.find((r) => r.state === primaryState);
        const values = dataset.records.map((r) => r.metrics[varId] ?? NaN);
        return {
          id: varId,
          label: metricDef?.label ?? varId,
          values,
          highlightValue: primaryRecord?.metrics[varId] ?? null,
        };
      }),
    [activeVariableIds, dataset, primaryState]
  );

  const metricOptions = useMemo(
    () => dataset.metricCatalog.map((m) => ({ id: m.id, label: m.label })),
    [dataset.metricCatalog]
  );

  const variableLabels = useMemo(
    () => Object.fromEntries(dataset.metricCatalog.map((m) => [m.id, m.label])),
    [dataset.metricCatalog]
  );

  const hasCorrData = correlations.pearson.variables.length > 0;

  return (
    <div className="tab-content">
      {activeVariableIds.length < 2 && (
        <InsightBox title="Activa más variables">
          Selecciona al menos 2 variables en el panel lateral para ver correlaciones y scatter.
        </InsightBox>
      )}

      {activeVariableIds.length >= 2 && (
        <>
          <div className="corr-var-selectors">
            <div className="corr-var-selector">
              <span className="corr-var-selector__label">Eje Y — vertical</span>
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
              <span className="corr-var-selector__label">Eje X — horizontal</span>
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

        <div className="two-col">
          <section className="panel">
            <p className="panel-title">Correlaciones con: {yLabel}</p>
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
            <p className="panel-title">{xLabel} vs {yLabel}</p>
            <PairScatterChart
              data={scatterData}
              xLabel={xLabel}
              yLabel={yLabel}
              highlightState={primaryState ?? undefined}
              xUnit={xUnit}
              yUnit={yUnit}
            />
          </section>
        </div>
        </>
      )}

      {activeVariableIds.length > 0 && (
        <section className="panel">
          <p className="panel-title">Distribución por variable (todos los estados)</p>
          <BoxplotPanel variables={boxplotVars} />
        </section>
      )}

      {hasCorrData && (
        <section className="panel">
          <p className="panel-title">Top correlaciones (Pearson)</p>
          <CorrelationMatrixTable
            payload={correlations}
            variableLabels={variableLabels}
            n={dataset.records.length}
          />
        </section>
      )}

      <section className="panel">
        <p className="panel-title">Regresión multivariada (OLS estandarizado)</p>
        <MultivariateRegressionPlot
          stateCards={effectiveStateCards}
          metricOptions={metricOptions}
          defaultDependentVar={xVarId}
        />
      </section>
    </div>
  );
}
