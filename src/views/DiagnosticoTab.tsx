import { useMemo, useState } from "react";
import { useAppContext } from "../context/AppContext";
import { getMetricPolaridad } from "../services/DataService";
import type { AppData } from "../services/DataService";
import KpiGrid from "../components/kpi/KpiGrid";
import ComparisonRadarChart from "../components/charts/ComparisonRadarChart";
import DistributionHistogram from "../components/charts/DistributionHistogram";
import InlineBoxplot from "../components/charts/InlineBoxplot";
import RankingTable from "../components/charts/RankingTable";
import ChoroplethMap from "../components/charts/ChoroplethMap";
import EmptyState from "../components/EmptyState";
import InsightBox from "../components/feedback/InsightBox";
import PhasePlaceholder from "../components/feedback/PhasePlaceholder";
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
  const { primaryState, activeVariableIds } = appState;
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
        direction: getMetricPolaridad(varId, appData.variablesCatalog),
        isOutlier: stateIsOutlier,
      };
    });
  }, [primaryRecord, activeVariableIds, dataset, outliers]);

  const polaridadMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const varId of activeVariableIds) {
      map[varId] = getMetricPolaridad(varId, appData.variablesCatalog);
    }
    return map;
  }, [activeVariableIds, appData.variablesCatalog]);

  const normalizedMap = useMemo(
    () => normalizeForRadar(dataset.records, activeVariableIds, polaridadMap),
    [dataset.records, activeVariableIds, polaridadMap]
  );

  const stateRegionMap = useMemo(
    () => Object.fromEntries(dataset.records.map((r) => [r.state, r.region ?? ""])),
    [dataset.records]
  );

  const stateRegion = primaryState
    ? (stateRegionMap[primaryState] ?? null)
    : null;

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

  const [histVarId, setHistVarId] = useState<string | null>(null);
  const effectiveHistVarId =
    histVarId && activeVariableIds.includes(histVarId) ? histVarId : primaryVarId;

  const histMetricDef = effectiveHistVarId
    ? dataset.metricCatalog.find((m) => m.id === effectiveHistVarId)
    : null;
  const distribution = effectiveHistVarId ? distributions[effectiveHistVarId] : null;
  const nationalMeanHist = effectiveHistVarId
    ? calcNationalMean(dataset.records, effectiveHistVarId)
    : null;
  const highlightValue =
    primaryRecord && effectiveHistVarId
      ? (primaryRecord.metrics[effectiveHistVarId] ?? null)
      : null;

  const histStateValues = useMemo(() => {
    if (!effectiveHistVarId) return [];
    return dataset.records
      .map((r) => ({ state: r.state, value: r.metrics[effectiveHistVarId] }))
      .filter((d): d is { state: string; value: number } => typeof d.value === "number" && !isNaN(d.value));
  }, [effectiveHistVarId, dataset.records]);

  const histogramBinStates = useMemo(() => {
    if (!effectiveHistVarId || !distribution) return undefined;
    const { bins, counts } = distribution.histogram;
    if (bins.length <= counts.length) return undefined;
    const nBins = counts.length;
    return Array.from({ length: nBins }, (_, i) => {
      const lo = bins[i];
      const hi = bins[i + 1];
      return dataset.records
        .filter((r) => {
          const v = r.metrics[effectiveHistVarId];
          if (typeof v !== "number" || isNaN(v)) return false;
          return i === nBins - 1 ? v >= lo && v <= hi : v >= lo && v < hi;
        })
        .map((r) => r.state);
    });
  }, [effectiveHistVarId, distribution, dataset.records]);

  const [rankingVarId, setRankingVarId] = useState<string | null>(null);
  const [rankingView, setRankingView] = useState<"table" | "bars">("table");

  const effectiveRankingVarId =
    rankingVarId && activeVariableIds.includes(rankingVarId)
      ? rankingVarId
      : primaryVarId;
  const rankingMetricDef = effectiveRankingVarId
    ? dataset.metricCatalog.find((m) => m.id === effectiveRankingVarId)
    : null;

  const rankingRows = useMemo(() => {
    if (!effectiveRankingVarId) return [];
    const fromData = rankings[effectiveRankingVarId];
    if (fromData?.length) return fromData;
    return buildRankingFromRecords(dataset.records, effectiveRankingVarId);
  }, [effectiveRankingVarId, rankings, dataset.records]);

  if (!primaryState) {
    return (
      <EmptyState
        title="Sin estado seleccionado"
        description="Selecciona un estado en el panel lateral."
      />
    );
  }

  return (
    <div className="tab-content">
      {kpiCards.length > 0 ? (
        <KpiGrid cards={kpiCards} />
      ) : (
        <InsightBox title="Sin variables activas">
          Activa variables en el panel lateral para ver métricas del estado seleccionado.
        </InsightBox>
      )}

      <section className="panel">
        <p className="panel-title">Perfil comparativo</p>
        <ComparisonRadarChart
          primaryState={primaryState}
          stateRegion={stateRegion}
          variables={radarVars}
          normalizedMap={normalizedMap}
          nationalValues={nationalValues}
          stateRegionMap={stateRegionMap}
          allStateNames={dataset.records.map((r) => r.state)}
        />
      </section>

      {primaryVarId && (
        <div className="two-col">
          <section className="panel">
            <div className="ranking-panel-header">
              <p className="panel-title" style={{ margin: 0 }}>Distribución nacional</p>
              {activeVariableIds.length > 1 && (
                <select
                  className="ranking-var-select"
                  value={effectiveHistVarId ?? ""}
                  onChange={(e) => setHistVarId(e.target.value)}
                >
                  {activeVariableIds.map((varId) => {
                    const lbl = dataset.metricCatalog.find((m) => m.id === varId)?.label ?? varId;
                    return <option key={varId} value={varId}>{lbl}</option>;
                  })}
                </select>
              )}
            </div>
            {distribution ? (
              <DistributionHistogram
                histogram={distribution.histogram}
                highlightValue={highlightValue}
                nationalMean={nationalMeanHist}
                binStates={histogramBinStates}
              />
            ) : (
              <EmptyState
                title="Sin histograma"
                description="Ejecuta npm run pipeline:layer1 para generar distribuciones."
              />
            )}
            {histStateValues.length >= 4 && (
              <div style={{ padding: "0 16px 0 28px", marginTop: 2 }}>
                <InlineBoxplot
                  stateValues={histStateValues}
                  highlightState={primaryState}
                  domainMin={Math.min(...histStateValues.map((d) => d.value))}
                  domainMax={Math.max(...histStateValues.map((d) => d.value))}
                />
              </div>
            )}
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--text-3)", textAlign: "center" }}>
              {histMetricDef?.label ?? effectiveHistVarId} — distribución entre los 32 estados
            </p>
          </section>

          <section className="panel ranking-panel">
            <div className="ranking-panel-header">
              <p className="panel-title" style={{ margin: 0 }}>Ranking nacional</p>
              {activeVariableIds.length > 1 && (
                <select
                  className="ranking-var-select"
                  value={effectiveRankingVarId ?? ""}
                  onChange={(e) => setRankingVarId(e.target.value)}
                >
                  {activeVariableIds.map((varId) => {
                    const lbl = dataset.metricCatalog.find((m) => m.id === varId)?.label ?? varId;
                    return (
                      <option key={varId} value={varId}>{lbl}</option>
                    );
                  })}
                </select>
              )}
            </div>
            <div
              className="toggle-pill ranking-panel__toggle"
              role="group"
              aria-label="Vista del ranking"
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft") setRankingView("table");
                if (e.key === "ArrowRight") setRankingView("bars");
              }}
            >
              <button
                type="button"
                className={`toggle-pill__btn${rankingView === "table" ? " active" : ""}`}
                onClick={() => setRankingView("table")}
              >
                Tabla
              </button>
              <button
                type="button"
                className={`toggle-pill__btn${rankingView === "bars" ? " active" : ""}`}
                onClick={() => setRankingView("bars")}
              >
                Barras
              </button>
            </div>
            {rankingRows.length > 0 ? (
              <RankingTable
                rows={rankingRows}
                highlightState={primaryState}
                metricLabel={rankingMetricDef?.label ?? effectiveRankingVarId ?? ""}
                unit={rankingMetricDef?.unit}
                view={rankingView}
                direction={effectiveRankingVarId ? getMetricPolaridad(effectiveRankingVarId, appData.variablesCatalog) : undefined}
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
        <ChoroplethMap appData={appData} />
      </section>

      <section className="panel">
        <p className="panel-title">Distribución del ingreso — Curva de Lorenz / Gini</p>
        <PhasePlaceholder
          message="Curva de Lorenz y coeficiente de Gini — no disponible aún."
        />
      </section>
    </div>
  );
}
