import { useMemo } from "react";
import { useAppContext } from "../context/AppContext";
import { getMetricDirection } from "../services/DataService";
import type { AppData } from "../services/DataService";
import KpiGrid from "../components/kpi/KpiGrid";
import ComparisonRadarChart from "../components/charts/ComparisonRadarChart";
import DistributionHistogram from "../components/charts/DistributionHistogram";
import RankingTable from "../components/charts/RankingTable";
import ChoroplethMap from "../components/charts/ChoroplethMap";
import EmptyState from "../components/EmptyState";
import InsightBox from "../components/feedback/InsightBox";
import { calcNationalMean, calcDelta, isStateOutlier, normalizeForRadar } from "../lib/stats";
import type { RankingEntry, TipoValor } from "../types/dataStandard";
import type { StateMetricRecord } from "../types/dataset";

function guessTipoValor(metricId: string, unit: string): TipoValor {
  if (unit === "%" || metricId.endsWith("_pct")) return "percentage";
  return "number";
}

function buildRankingFromRecords(records: StateMetricRecord[], metricId: string): RankingEntry[] {
  const valid = records
    .filter((r) => r.metrics[metricId] !== undefined && !isNaN(r.metrics[metricId]))
    .map((r) => ({ state: r.state, value: r.metrics[metricId] }));
  if (!valid.length) return [];
  const mean = valid.reduce((s, r) => s + r.value, 0) / valid.length;
  return valid
    .sort((a, b) => b.value - a.value)
    .map((r, i) => ({
      rank: i + 1,
      state: r.state,
      estado: r.state,
      value: r.value,
      pct_vs_mean: mean !== 0 ? ((r.value - mean) / mean) * 100 : 0,
    }));
}

type Props = { appData: AppData };

export default function DiagnosticoTab({ appData }: Props) {
  const { state: appState } = useAppContext();
  const { selectedStates, primaryState, activeVariableIds } = appState;
  const { dataset, outliers, distributions, rankings } = appData;

  const primaryRecord = useMemo(
    () => dataset.records.find((r) => r.state === primaryState),
    [dataset.records, primaryState]
  );

  const kpiCards = useMemo(() => {
    if (!primaryRecord) return [];
    return activeVariableIds.map((varId) => {
      const metricDef = dataset.metricCatalog.find((m) => m.id === varId);
      const value = primaryRecord.metrics[varId] ?? null;
      const nationalMean = calcNationalMean(dataset.records, varId);
      const delta =
        value !== null && nationalMean !== null ? calcDelta(value, nationalMean) : null;
      const outlierEntry = outliers[varId];
      const stateIsOutlier =
        outlierEntry && primaryRecord.stateCode
          ? isStateOutlier(primaryRecord.stateCode, outlierEntry)
          : false;
      return {
        label: metricDef?.label ?? varId,
        value,
        unit: metricDef?.unit,
        tipoValor: guessTipoValor(varId, metricDef?.unit ?? ""),
        delta,
        direction: getMetricDirection(varId),
        isOutlier: stateIsOutlier,
      };
    });
  }, [primaryRecord, activeVariableIds, dataset, outliers]);

  const normalizedMap = useMemo(
    () => normalizeForRadar(dataset.records, activeVariableIds),
    [dataset.records, activeVariableIds]
  );

  const stateData = useMemo(
    () =>
      selectedStates.map((name) => ({
        name,
        values: normalizedMap.get(name) ?? {},
      })),
    [selectedStates, normalizedMap]
  );

  const nationalValues = useMemo(() => {
    const result: Record<string, number | null> = {};
    for (const varId of activeVariableIds) {
      const vals = dataset.records
        .map((r) => r.metrics[varId])
        .filter((v): v is number => typeof v === "number" && !isNaN(v));
      if (!vals.length) {
        result[varId] = null;
        continue;
      }
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
      result[varId] = max === min ? 50 : ((mean - min) / (max - min)) * 100;
    }
    return result;
  }, [dataset.records, activeVariableIds]);

  const radarVars = useMemo(
    () =>
      activeVariableIds.map((id) => ({
        id,
        label: dataset.metricCatalog.find((m) => m.id === id)?.label ?? id,
      })),
    [activeVariableIds, dataset.metricCatalog]
  );

  const primaryVarId = activeVariableIds[0] ?? null;
  const primaryMetricDef = primaryVarId
    ? dataset.metricCatalog.find((m) => m.id === primaryVarId)
    : null;
  const distribution = primaryVarId ? distributions[primaryVarId] : null;
  const nationalMeanPrimary = primaryVarId
    ? calcNationalMean(dataset.records, primaryVarId)
    : null;
  const highlightValue =
    primaryRecord && primaryVarId ? (primaryRecord.metrics[primaryVarId] ?? null) : null;

  const rankingRows = useMemo(() => {
    if (!primaryVarId) return [];
    const fromData = rankings[primaryVarId];
    if (fromData?.length) return fromData;
    return buildRankingFromRecords(dataset.records, primaryVarId);
  }, [primaryVarId, rankings, dataset.records]);

  if (!primaryState) {
    return (
      <EmptyState
        title="Sin estado seleccionado"
        description="Selecciona al menos un estado en el panel lateral."
      />
    );
  }

  return (
    <div className="tab-content">
      <p className="tab-section-label">
        Perfil de <strong>{primaryState}</strong>
      </p>

      {kpiCards.length > 0 ? (
        <KpiGrid cards={kpiCards} />
      ) : (
        <InsightBox title="Sin variables activas">
          Activa variables en el panel lateral para ver métricas del estado seleccionado.
        </InsightBox>
      )}

      <section className="panel">
        <p className="panel-title">Perfil comparativo (normalizado 0–100)</p>
        <ComparisonRadarChart
          stateData={stateData}
          nationalValues={nationalValues}
          variables={radarVars}
        />
      </section>

      {primaryVarId && (
        <div className="two-col">
          <section className="panel">
            <p className="panel-title">
              Distribución: {primaryMetricDef?.label ?? primaryVarId}
            </p>
            {distribution ? (
              <DistributionHistogram
                histogram={distribution.histogram}
                highlightValue={highlightValue}
                nationalMean={nationalMeanPrimary}
                label={primaryState}
              />
            ) : (
              <EmptyState
                title="Sin histograma"
                description="Ejecuta npm run pipeline:layer1 para generar distribuciones."
              />
            )}
          </section>

          <section className="panel">
            <p className="panel-title">
              Ranking nacional: {primaryMetricDef?.label ?? primaryVarId}
            </p>
            {rankingRows.length > 0 ? (
              <RankingTable
                rows={rankingRows}
                highlightState={primaryState}
                metricLabel={primaryMetricDef?.label ?? primaryVarId}
                unit={primaryMetricDef?.unit}
              />
            ) : (
              <EmptyState
                title="Sin datos de ranking"
                description="No hay datos suficientes para construir el ranking."
              />
            )}
          </section>
        </div>
      )}

      <section className="panel">
        <p className="panel-title">Mapa coroplético</p>
        <ChoroplethMap />
      </section>
    </div>
  );
}
