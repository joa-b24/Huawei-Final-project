import { useMemo } from "react";
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

  const [xVarId, yVarId] = activeVariableIds;

  const corrRows = useMemo(() => {
    if (!xVarId || !correlations.pearson.variables.length) return [];
    const { variables, matrix } = correlations.pearson;
    const xIdx = variables.indexOf(xVarId);
    if (xIdx === -1) return [];
    const n = dataset.records.length;
    return activeVariableIds
      .filter((id) => id !== xVarId)
      .map((id) => {
        const yIdx = variables.indexOf(id);
        const r =
          yIdx !== -1 && Array.isArray(matrix[xIdx]) ? (matrix[xIdx] as number[])[yIdx] : NaN;
        return {
          variableId: id,
          label: dataset.metricCatalog.find((m) => m.id === id)?.label ?? id,
          r: isNaN(r) ? 0 : r,
          pValue: isNaN(r) ? 1 : corrPValue(r, n),
        };
      })
      .filter((row) => isFinite(row.r));
  }, [xVarId, activeVariableIds, correlations, dataset]);

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

  const { label: xLabel, unit: xUnit } = getLabelAndUnit(xVarId);
  const { label: yLabel, unit: yUnit } = getLabelAndUnit(yVarId);

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
  const shortLabel = (s: string, n = 32) => (s.length > n ? s.slice(0, n) + "…" : s);

  return (
    <div className="tab-content">
      {activeVariableIds.length < 2 && (
        <InsightBox title="Activa más variables">
          Selecciona al menos 2 variables en el panel lateral para ver correlaciones y scatter.
        </InsightBox>
      )}

      {activeVariableIds.length >= 2 && (
        <div className="two-col">
          <section className="panel">
            <p className="panel-title">Correlaciones con: {shortLabel(xLabel, 40)}</p>
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
            <p className="panel-title">
              {shortLabel(xLabel, 28)} vs {shortLabel(yLabel, 28)}
            </p>
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
