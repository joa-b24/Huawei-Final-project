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
import InfoTooltip from "../components/feedback/InfoTooltip";
import TabNarrative from "../components/feedback/TabNarrative";
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
  const { dataset, outliers, distributions, univariateStats, rankings } = appData;

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

  // National average in normalized space = mean of all states' percentile ranks ≈ 50
  const nationalValues = useMemo(() => {
    const result: Record<string, number | null> = {};
    for (const varId of activeVariableIds) {
      const vals = dataset.records
        .map((r) => normalizedMap.get(r.state)?.[varId])
        .filter((v): v is number => typeof v === "number");
      result[varId] = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
    }
    return result;
  }, [dataset.records, activeVariableIds, normalizedMap]);

  const rawMap = useMemo(() => {
    const map = new Map<string, Record<string, number | null>>();
    for (const r of dataset.records) {
      const entry: Record<string, number | null> = {};
      for (const id of activeVariableIds) entry[id] = r.metrics[id] ?? null;
      map.set(r.state, entry);
    }
    return map;
  }, [dataset.records, activeVariableIds]);

  const radarVars = useMemo(
    () =>
      activeVariableIds.map((id) => {
        const m = dataset.metricCatalog.find((m) => m.id === id);
        return { id, label: m?.label ?? id, unit: m?.unit ?? "" };
      }),
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

  const primaryRankingRow = rankingRows.find((r) => r.state === primaryState) ?? null;
  const rankingLabel = rankingMetricDef?.label ?? effectiveRankingVarId ?? "";

  return (
    <div className="tab-content">
      <TabNarrative
        title="Descripción general"
        description="Vista del estado seleccionado frente al conjunto nacional, regiones, clusters o estados: indicadores clave vs media, perfil comparativo normalizado, distribución estadística y posición en el ranking."
      >
        {kpiCards.length > 0 ? (
          <DiagnosticoNarrative
            primaryState={primaryState}
            stateRegion={stateRegion}
            kpiCards={kpiCards}
            rankingRow={primaryRankingRow}
            rankingLabel={rankingLabel}
            totalStates={dataset.records.length}
          />
        ) : (
          <p>Activa variables en el panel lateral para ver el análisis del estado seleccionado.</p>
        )}
      </TabNarrative>

      {kpiCards.length > 0 ? (
        <KpiGrid cards={kpiCards} />
      ) : (
        <InsightBox title="Sin variables activas">
          Activa variables en el panel lateral para ver métricas del estado seleccionado.
        </InsightBox>
      )}

      <section className="panel">
        <div className="panel-title-row">
          <p className="panel-title" style={{ margin: 0 }}>Perfil comparativo</p>
          <InfoTooltip text="Normaliza cada variable por rango percentil (0–100 pts, donde 100 = estado con el valor más alto entre los 32). En métricas de polaridad negativa (ej. pobreza) se invierte para que mayor puntuación = mejor desempeño. El tooltip muestra el valor real en unidades originales." />
        </div>
        <ComparisonRadarChart
          primaryState={primaryState}
          stateRegion={stateRegion}
          variables={radarVars}
          normalizedMap={normalizedMap}
          rawMap={rawMap}
          nationalValues={nationalValues}
          stateRegionMap={stateRegionMap}
          allStateNames={dataset.records.map((r) => r.state)}
        />
      </section>

      {primaryVarId && (
        <div className="two-col">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <section className="panel">
            <div className="ranking-panel-header">
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <p className="panel-title" style={{ margin: 0 }}>Distribución nacional</p>
                <InfoTooltip text="Histograma que muestra cómo se distribuyen los valores de la variable entre los 32 estados. La línea vertical indica el promedio nacional; el punto destacado corresponde al estado seleccionado." />
              </div>
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
          {effectiveHistVarId && (
            <TabNarrative
              title="Estadísticos de distribución"
              description="Forma, dispersión y posición del estado en la distribución nacional de la variable seleccionada."
            >
              <DistributionInsights
                varId={effectiveHistVarId}
                stateValue={highlightValue}
                uniStat={univariateStats[effectiveHistVarId] ?? null}
                normality={distribution?.normality ?? null}
              />
            </TabNarrative>
          )}
          </div>

          <section className="panel ranking-panel">
            <div className="ranking-panel-header">
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <p className="panel-title" style={{ margin: 0 }}>Ranking nacional</p>
                <InfoTooltip text="Ordena los 32 estados de mayor a menor valor en la variable seleccionada. El porcentaje indica la diferencia respecto al promedio nacional. El estado seleccionado se resalta y se desplaza automáticamente a la vista." />
              </div>
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
        <div className="panel-title-row">
          <p className="panel-title" style={{ margin: 0 }}>Mapa coroplético</p>
          <InfoTooltip text="Colorea cada estado según el valor de la variable seleccionada. Los tonos más oscuros representan valores más altos. Haz clic en cualquier estado para seleccionarlo como estado de análisis." />
        </div>
        <ChoroplethMap appData={appData} />
      </section>
    </div>
  );
}

// ── Insights distribución ─────────────────────────────────────────────────────

import type { UnivariateStat } from "../services/DataService";
import type { DistributionEntry } from "../types/dataStandard";

function DistributionInsights({
  stateValue,
  uniStat,
  normality,
}: {
  varId: string;
  stateValue: number | null;
  uniStat: UnivariateStat | null;
  normality: DistributionEntry["normality"] | null;
}) {
  if (!uniStat) return null;

  const { mean, std, skewness, q25, q50, q75 } = uniStat;
  if (mean === null || std === null || skewness === null) return null;

  const zScore = stateValue !== null && std > 0 ? (stateValue - mean) / std : null;

  const skewDesc =
    Math.abs(skewness) < 0.5
      ? "aproximadamente simétrica, lo que indica que los valores se distribuyen de forma equilibrada alrededor de la media"
      : skewness > 0
        ? "sesgada a la derecha: la mayoría de los estados tiene valores por debajo de la media, con algunos casos que elevan el promedio"
        : "sesgada a la izquierda: la mayoría de los estados tiene valores por encima de la media, con algunos rezagados que la arrastran hacia abajo";

  const normalityDesc =
    normality?.is_normal === true
      ? `La prueba de Shapiro-Wilk no rechaza la hipótesis de normalidad (p = ${normality.p_value?.toFixed(3)}), por lo que comparar el estado con la media y desviación estándar tiene validez estadística.`
      : normality?.is_normal === false
        ? `La prueba de Shapiro-Wilk rechaza la normalidad (p = ${normality.p_value?.toFixed(3)}), lo que indica heterogeneidad marcada entre estados; la posición relativa es orientativa y debe interpretarse con cautela.`
        : null;

  let statePositionDesc: string | null = null;
  if (stateValue !== null && zScore !== null) {
    const direction = zScore >= 0 ? "por encima" : "por debajo";
    const absZ = Math.abs(zScore).toFixed(2);
    let quartileDesc = "";
    if (q25 !== null && q50 !== null && q75 !== null) {
      if (stateValue >= q75) quartileDesc = ", ubicándose en el cuartil superior (top 25 % de los estados)";
      else if (stateValue >= q50) quartileDesc = ", por encima de la mediana nacional";
      else if (stateValue >= q25) quartileDesc = ", por debajo de la mediana pero dentro del segundo cuartil";
      else quartileDesc = ", en el cuartil inferior (bottom 25 % de los estados)";
    }
    statePositionDesc = `El estado seleccionado se sitúa ${direction} de la media nacional por ${absZ} desviaciones estándar${quartileDesc}.`;
  }

  return (
    <div style={{ marginTop: 12, padding: "0 4px" }}>
      <p style={{ lineHeight: 1.65, color: "#334155", margin: "0 0 6px" }}>
        Entre los 32 estados, la variable presenta una media de <strong>{mean.toFixed(2)}</strong> con
        una dispersión de <strong>{std.toFixed(2)}</strong> (desv. estándar). La distribución es{" "}
        <strong>{skewDesc}</strong>.
      </p>
      {normalityDesc && (
        <p style={{ lineHeight: 1.65, color: "#334155", margin: "0 0 6px" }}>
          {normalityDesc}
        </p>
      )}
      {statePositionDesc && (
        <p style={{ lineHeight: 1.65, color: "#334155", margin: 0 }}>
          {statePositionDesc}
        </p>
      )}
    </div>
  );
}

// ── Narrativa automática ──────────────────────────────────────────────────────

type KpiCardSummary = {
  label: string;
  value: number | null;
  delta: number | null;
  direction: string;
  isOutlier: boolean;
};

function fmtPct(d: number | null): string {
  if (d === null) return "—";
  return `${d > 0 ? "+" : ""}${d.toFixed(1)}%`;
}

function DiagnosticoNarrative({
  primaryState,
  stateRegion,
  kpiCards,
  rankingRow,
  rankingLabel,
  totalStates,
}: {
  primaryState: string;
  stateRegion: string | null;
  kpiCards: KpiCardSummary[];
  rankingRow: import("../types/dataStandard").RankingEntry | null;
  rankingLabel: string;
  totalStates: number;
}) {
  const withData = kpiCards.filter((c) => c.value !== null);
  if (!withData.length) return null;

  const outliers = withData.filter((c) => c.isOutlier);

  const goodPerformers = withData
    .filter((c) => c.direction === "lower_better" ? (c.delta ?? 0) < 0 : (c.delta ?? 0) > 0)
    .sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0));

  const badPerformers = withData
    .filter((c) => c.direction === "lower_better" ? (c.delta ?? 0) > 0 : (c.delta ?? 0) < 0)
    .sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0));

  return (
    <div>
      <p style={{ lineHeight: 1.65, color: "#334155", margin: "0 0 8px" }}>
        En <strong>{primaryState}</strong>
        {stateRegion ? <>, región <strong>{stateRegion}</strong>,</> : ","}{" "}
        de las <strong>{withData.length}</strong> variable{withData.length !== 1 ? "s" : ""} con datos,{" "}
        <strong>{goodPerformers.length}</strong> {goodPerformers.length === 1 ? "muestra" : "muestran"} desempeño favorable respecto a la media nacional{" "}
        y <strong>{badPerformers.length}</strong> {badPerformers.length === 1 ? "presenta" : "presentan"} oportunidad de mejora.
        {goodPerformers.length > 0 && (
          <> El mayor avance relativo es{" "}
          <strong>{goodPerformers[0].label}</strong> ({fmtPct(goodPerformers[0].delta)} vs media).</>
        )}
        {badPerformers.length > 0 && (
          <> La mayor brecha aparece en{" "}
          <strong>{badPerformers[0].label}</strong> ({fmtPct(badPerformers[0].delta)} vs media).</>
        )}
      </p>
      {rankingRow && rankingLabel && (
        <p style={{ lineHeight: 1.65, color: "#334155", margin: "0 0 10px" }}>
          En <strong>{rankingLabel}</strong>, el estado ocupa el{" "}
          <strong>lugar {rankingRow.rank} de {totalStates}</strong>, con un valor{" "}
          <strong>{fmtPct(rankingRow.pct_vs_mean)}</strong> respecto al promedio nacional.
        </p>
      )}
      {outliers.length > 0 && (
        <p style={{ lineHeight: 1.65, color: "#334155", margin: 0 }}>
          Se detecta comportamiento atípico (criterio IQR) en:{" "}
          <strong>{outliers.map((c) => c.label).join(", ")}</strong>.
          {" "}Esto indica que la entidad se aleja significativamente
          de la distribución del resto de estados en {outliers.length === 1 ? "esa variable" : "esas variables"}.
        </p>
      )}
    </div>
  );
}
    