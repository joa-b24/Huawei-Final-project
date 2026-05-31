import { useEffect, useMemo, useState } from "react";
import { useAppContext } from "../context/AppContext";
import { getMetricPolaridad } from "../services/DataService";
import type { AppData } from "../services/DataService";
import KpiGrid from "../components/kpi/KpiGrid";
import ComparisonRadarChart from "../components/charts/ComparisonRadarChart";
import DistributionHistogram from "../components/charts/DistributionHistogram";
import InlineBoxplot from "../components/charts/InlineBoxplot";
import RankingTable from "../components/charts/RankingTable";
import ChoroplethMap from "../components/charts/ChoroplethMap";
import MunicipalModeView, { type MunVar } from "../components/charts/MunicipalModeView";
import EmptyState from "../components/EmptyState";
import InsightBox from "../components/feedback/InsightBox";
import InfoTooltip from "../components/feedback/InfoTooltip";
import TabNarrative from "../components/feedback/TabNarrative";
import { calcNationalMean, calcDelta, isStateOutlier, normalizeForRadar } from "../lib/stats";
import type { RankingEntry, TipoValor } from "../types/dataStandard";
import type { StateMetricRecord } from "../types/dataset";
import ComparisonGroupSelector, { GROUP_COLORS } from "../components/sidebar/ComparisonGroupSelector";

function guessTipoValor(metricId: string, unit: string): TipoValor {
  if (unit === "%" || metricId.endsWith("_pct")) return "percentage";
  return "number";
}

function buildRankingFromRecords(
  records: StateMetricRecord[],
  metricId: string,
  direction: import("../types/dataStandard").MetricPolaridad = "higher_better"
): RankingEntry[] {
  const valid = records
    .filter((r) => r.metrics[metricId] !== undefined && !isNaN(r.metrics[metricId]))
    .map((r) => ({ state: r.state, value: r.metrics[metricId] }));
  if (!valid.length) return [];
  const mean = valid.reduce((s, r) => s + r.value, 0) / valid.length;
  // rank 1 = best: highest for higher_better, lowest for lower_better
  const sorted = direction === "lower_better"
    ? [...valid].sort((a, b) => a.value - b.value)
    : [...valid].sort((a, b) => b.value - a.value);
  return sorted.map((r, i) => ({
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
  const { dataset, outliers, distributions, univariateStats } = appData;

  const primaryRecord = useMemo(
    () => dataset.records.find((r) => r.state === primaryState),
    [dataset.records, primaryState]
  );

  const primaryPcaRecord = useMemo(
    () => appData.pcaResults?.records.find((r) => r.state === primaryState) ?? null,
    [appData.pcaResults, primaryState]
  );
  const primaryClusterGroupId = primaryPcaRecord !== null ? `c:${primaryPcaRecord.cluster}` : null;
  const primaryClusterLabel = primaryPcaRecord !== null
    ? (appData.pcaResults?.cluster_stats[String(primaryPcaRecord.cluster)]?.label ?? `Cluster ${primaryPcaRecord.cluster}`)
    : null;

  const [comparisonGroups, setComparisonGroups] = useState<string[]>(["nacional"]);
  useEffect(() => { setComparisonGroups(["nacional"]); }, [primaryState]);

  const [showGroups, setShowGroups] = useState(false);

  const secondaryGroup = comparisonGroups.find((g) => g !== "nacional") ?? null;

  const comparisonLabel: string | null = secondaryGroup
    ? secondaryGroup.startsWith("r:") ? `Región ${secondaryGroup.slice(2)}`
    : secondaryGroup.startsWith("c:")
      ? (appData.pcaResults?.cluster_stats[secondaryGroup.slice(2)]?.label ?? `Cluster ${secondaryGroup.slice(2)}`)
    : secondaryGroup
    : null;

  const comparisonValues = useMemo(() => {
    if (!secondaryGroup || !activeVariableIds.length) return null;
    const g = secondaryGroup;
    if (g.startsWith("r:")) {
      const region = g.slice(2);
      const result: Record<string, number | null> = {};
      for (const varId of activeVariableIds) {
        const vals = dataset.records
          .filter((r) => r.region === region)
          .map((r) => r.metrics[varId])
          .filter((v): v is number => typeof v === "number" && !isNaN(v));
        result[varId] = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
      }
      return result;
    }
    if (g.startsWith("c:")) {
      const clusterStates = appData.pcaResults?.cluster_stats[g.slice(2)]?.states ?? [];
      const result: Record<string, number | null> = {};
      for (const varId of activeVariableIds) {
        const vals = clusterStates
          .map((s) => dataset.records.find((r) => r.state === s)?.metrics[varId])
          .filter((v): v is number => typeof v === "number" && !isNaN(v));
        result[varId] = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
      }
      return result;
    }
    const stateRec = dataset.records.find((r) => r.state === g);
    if (!stateRec) return null;
    const result: Record<string, number | null> = {};
    for (const varId of activeVariableIds) {
      result[varId] = stateRec.metrics[varId] ?? null;
    }
    return result;
  }, [secondaryGroup, activeVariableIds, dataset.records, appData.pcaResults]);

  type GroupLine = { value: number; label: string; color: string };

  const nonNacionalGroups = comparisonGroups.filter((g) => g !== "nacional");

  useEffect(() => {
    if (!comparisonGroups.some((g) => g !== "nacional")) setShowGroups(false);
  }, [comparisonGroups]);

  // Single source of truth: groupId → color, indexed by position in comparisonGroups (matches radar)
  const groupColorMap = useMemo(() => {
    const map = new Map<string, string>();
    comparisonGroups.forEach((g, i) => map.set(g, GROUP_COLORS[i] ?? GROUP_COLORS[GROUP_COLORS.length - 1]));
    return map;
  }, [comparisonGroups]);

  function computeGroupValue(g: string, varId: string): number | null {
    if (g.startsWith("r:")) {
      const region = g.slice(2);
      const vals = dataset.records
        .filter((r) => r.region === region)
        .map((r) => r.metrics[varId])
        .filter((v): v is number => typeof v === "number" && !isNaN(v));
      return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
    }
    if (g.startsWith("c:")) {
      const clusterStates = appData.pcaResults?.cluster_stats[g.slice(2)]?.states ?? [];
      const vals = clusterStates
        .map((s) => dataset.records.find((r) => r.state === s)?.metrics[varId])
        .filter((v): v is number => typeof v === "number" && !isNaN(v));
      return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
    }
    return dataset.records.find((r) => r.state === g)?.metrics[varId] ?? null;
  }

  function groupLabel(g: string): string {
    if (g.startsWith("r:")) return `R:${g.slice(2)}`;
    if (g.startsWith("c:")) return appData.pcaResults?.cluster_stats[g.slice(2)]?.label ?? `C${g.slice(2)}`;
    return g;
  }

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

  // Municipal manifest — loaded once, tells us which variable_ids have municipal data per state
  const [munManifest, setMunManifest] = useState<Record<string, { variables: string[] }> | null>(null);
  useEffect(() => {
    fetch("/data/municipal_manifest.json")
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((data) => setMunManifest(data?.states ?? null));
  }, []);

  const munVarsAvailable = useMemo((): MunVar[] => {
    const sc = primaryRecord?.stateCode;
    if (!munManifest || !sc) return [];
    const stateVarIds = new Set(munManifest[sc]?.variables ?? []);
    return activeVariableIds
      .filter((id) => stateVarIds.has(id))
      .map((id) => {
        const m = dataset.metricCatalog.find((mc) => mc.id === id);
        return { id, label: m?.label ?? id, unit: m?.unit ?? "", direction: getMetricPolaridad(id, appData.variablesCatalog) };
      });
  }, [munManifest, primaryRecord?.stateCode, activeVariableIds, dataset.metricCatalog, appData.variablesCatalog]);

  const [municipalMode, setMunicipalMode] = useState(false);
  useEffect(() => { setMunicipalMode(false); }, [primaryState]);

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
      const compValue = comparisonValues?.[varId] ?? null;
      const compDelta = value !== null && compValue !== null ? calcDelta(value, compValue) : null;
      const groupComparisons = showGroups && nonNacionalGroups.length > 0
        ? nonNacionalGroups.map((g) => {
            const gVal = computeGroupValue(g, varId);
            return {
              label: groupLabel(g),
              delta: value !== null && gVal !== null ? calcDelta(value, gVal) : null,
              color: groupColorMap.get(g) ?? "#6b7280",
            };
          })
        : undefined;
      return {
        label: metricDef?.label ?? varId,
        value,
        unit: metricDef?.unit,
        tipoValor: guessTipoValor(varId, metricDef?.unit ?? ""),
        delta,
        direction: getMetricPolaridad(varId, appData.variablesCatalog),
        isOutlier: stateIsOutlier,
        comparisonLabel: comparisonLabel ?? undefined,
        comparisonDelta: compDelta,
        groupComparisons,
        hasMunicipalData: munVarsAvailable.some((v) => v.id === varId),
      };
    });
  }, [primaryRecord, activeVariableIds, dataset, outliers, comparisonValues, comparisonLabel, showGroups, nonNacionalGroups, groupColorMap, munVarsAvailable]);

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

  const regionGroupId = stateRegion ? `r:${stateRegion}` : null;
  const allStateNames = useMemo(() => dataset.records.map((r) => r.state), [dataset.records]);

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

  // Single source of truth for all 6 panels (histogram, map, ranking, mun-dist, mun-map, mun-ranking)
  const [activeChartVarId, setActiveChartVarId] = useState<string | null>(null);
  useEffect(() => { setActiveChartVarId(null); }, [primaryState]);
  const effectiveChartVarId =
    activeChartVarId && activeVariableIds.includes(activeChartVarId) ? activeChartVarId : primaryVarId;

  const [rankingView, setRankingView] = useState<"table" | "lollipop">("lollipop");

  const histMetricDef = effectiveChartVarId
    ? dataset.metricCatalog.find((m) => m.id === effectiveChartVarId)
    : null;
  const distribution = effectiveChartVarId ? distributions[effectiveChartVarId] : null;
  const nationalMeanHist = effectiveChartVarId
    ? calcNationalMean(dataset.records, effectiveChartVarId)
    : null;
  const highlightValue =
    primaryRecord && effectiveChartVarId
      ? (primaryRecord.metrics[effectiveChartVarId] ?? null)
      : null;

  const comparisonHistValue = effectiveChartVarId && comparisonValues
    ? (comparisonValues[effectiveChartVarId] ?? null)
    : null;

  const histStateValues = useMemo(() => {
    if (!effectiveChartVarId) return [];
    return dataset.records
      .map((r) => ({ state: r.state, value: r.metrics[effectiveChartVarId] }))
      .filter((d): d is { state: string; value: number } => typeof d.value === "number" && !isNaN(d.value));
  }, [effectiveChartVarId, dataset.records]);

  const histogramBinStates = useMemo(() => {
    if (!effectiveChartVarId || !distribution) return undefined;
    const { bins, counts } = distribution.histogram;
    if (bins.length <= counts.length) return undefined;
    const nBins = counts.length;
    return Array.from({ length: nBins }, (_, i) => {
      const lo = bins[i];
      const hi = bins[i + 1];
      return dataset.records
        .filter((r) => {
          const v = r.metrics[effectiveChartVarId];
          if (typeof v !== "number" || isNaN(v)) return false;
          return i === nBins - 1 ? v >= lo && v <= hi : v >= lo && v < hi;
        })
        .map((r) => r.state);
    });
  }, [effectiveChartVarId, distribution, dataset.records]);

  const rankingMetricDef = effectiveChartVarId
    ? dataset.metricCatalog.find((m) => m.id === effectiveChartVarId)
    : null;

  const effectiveRankingDirection = effectiveChartVarId
    ? getMetricPolaridad(effectiveChartVarId, appData.variablesCatalog)
    : "higher_better";

  const histGroupLines = useMemo((): GroupLine[] => {
    if (!showGroups || !effectiveChartVarId || !nonNacionalGroups.length) return [];
    return nonNacionalGroups.flatMap((g) => {
      const value = computeGroupValue(g, effectiveChartVarId);
      const color = groupColorMap.get(g) ?? "#6b7280";
      return value !== null ? [{ value, label: groupLabel(g), color }] : [];
    });
  }, [showGroups, effectiveChartVarId, nonNacionalGroups, groupColorMap, dataset.records, appData.pcaResults]);

  const rankingGroupLines = useMemo((): GroupLine[] => {
    if (!showGroups || !effectiveChartVarId || !nonNacionalGroups.length) return [];
    return nonNacionalGroups.flatMap((g) => {
      if (!g.startsWith("r:") && !g.startsWith("c:")) return [];
      const value = computeGroupValue(g, effectiveChartVarId);
      const color = groupColorMap.get(g) ?? "#6b7280";
      return value !== null ? [{ value, label: groupLabel(g), color }] : [];
    });
  }, [showGroups, effectiveChartVarId, nonNacionalGroups, groupColorMap, dataset.records, appData.pcaResults]);

  const rankingRows = useMemo(() => {
    if (!effectiveChartVarId) return [];
    return buildRankingFromRecords(dataset.records, effectiveChartVarId, effectiveRankingDirection);
  }, [effectiveChartVarId, dataset.records, effectiveRankingDirection]);


  if (!primaryState) {
    return (
      <EmptyState
        title="Sin estado seleccionado"
        description="Selecciona un estado en el panel lateral."
      />
    );
  }

  const primaryRankingRow = rankingRows.find((r) => r.state === primaryState) ?? null;
  const rankingLabel = rankingMetricDef?.label ?? effectiveChartVarId ?? "";

  return (
    <div className="tab-content">
      <TabNarrative
        title="Descripción general"
        description="Vista del estado seleccionado frente al conjunto nacional, regiones, clusters o estados."
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

      <section className="comparison-panel" style={{ marginTop: 8 }}>
        <div className="comparison-panel__header">
          <span className="comparison-panel__title">Grupos de comparación</span>
          {nonNacionalGroups.length > 0 && (
            <button
              type="button"
              className={`groups-toggle-btn${showGroups ? " active" : ""}`}
              onClick={() => setShowGroups((v) => !v)}
              title="Superponer grupos en distribución, mapa y ranking"
            >
              Mostrar en gráficas
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
          <InfoTooltip wide text={
            <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--text-2)" }}>
              <p style={{ fontWeight: 700, margin: "0 0 4px", color: "var(--text-1)" }}>Vista y normalización</p>
              <p style={{ margin: "0 0 10px" }}>
                Usa los botones <strong>Radar / Barras</strong> para cambiar el tipo de gráfico. Ambas vistas usan la misma escala de <strong>percentil 0–100</strong> sobre los 32 estados. En variables de polaridad negativa (ej. pobreza) la escala se invierte: 100 = mejor desempeño.
              </p>
              <p style={{ fontWeight: 700, margin: "0 0 4px", color: "var(--text-1)" }}>Cómo interpretar</p>
              <p style={{ margin: "0 0 8px" }}>
                En el radar: cuanto más alejado del centro, mayor ventaja relativa. El área encerrada refleja el desempeño agregado.
              </p>
              <p style={{ margin: 0 }}>
                Los <strong>grupos de comparación</strong> se seleccionan en el panel superior (Nacional, Región, Cluster estructural o un estado específico). Selección máxima de 3 grupos. El hover muestra el valor real en unidades originales.
              </p>
            </div>
          } />
        </div>
        <ComparisonRadarChart
          primaryState={primaryState}
          stateRegion={stateRegion}
          variables={radarVars}
          normalizedMap={normalizedMap}
          rawMap={rawMap}
          nationalValues={nationalValues}
          stateRegionMap={stateRegionMap}
          pcaResults={appData.pcaResults}
          groups={comparisonGroups}
        />
      </section>

      {primaryVarId && (
        <>
          {/* Variable selector + narrative — always visible */}
          {effectiveChartVarId && (
            <TabNarrative
              title={municipalMode
                ? `Vista municipal — ${histMetricDef?.label ?? effectiveChartVarId}`
                : `Análisis de variable — ${histMetricDef?.label ?? effectiveChartVarId}`}
              description={municipalMode
                ? "Histograma, mapa y ranking de municipios del estado para la variable seleccionada."
                : "Distribución entre los 32 estados, mapa coroplético y ranking nacional para la variable seleccionada."}
              style={{ marginTop: 16 }}
            >
              {activeVariableIds.length > 1 && (
                <div className="var-pill-row">
                  {activeVariableIds.map((vid) => {
                    const lbl = dataset.metricCatalog.find((m) => m.id === vid)?.label ?? vid;
                    return (
                      <button
                        key={vid}
                        type="button"
                        className={`var-pill-btn${effectiveChartVarId === vid ? " active" : ""}`}
                        onClick={() => setActiveChartVarId(vid)}
                      >
                        {lbl}
                      </button>
                    );
                  })}
                </div>
              )}
              {!municipalMode && (
                <DistributionInsights
                  varId={effectiveChartVarId}
                  stateValue={highlightValue}
                  uniStat={univariateStats[effectiveChartVarId] ?? null}
                  normality={distribution?.normality ?? null}
                  primaryState={primaryState}
                  rankingRow={rankingRows.find((r) => r.state === primaryState) ?? null}
                  totalStates={dataset.records.length}
                />
              )}
            </TabNarrative>
          )}

          {/* Municipal toggle — only when selected variable has municipal data */}
          {munVarsAvailable.some((v) => v.id === effectiveChartVarId) && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
              <button
                type="button"
                className={`groups-toggle-btn${municipalMode ? " active" : ""}`}
                onClick={() => setMunicipalMode((m) => !m)}
              >
                {municipalMode ? "← Vista nacional" : "Ver municipios →"}
              </button>
            </div>
          )}
        </>
      )}

      {/* Municipal charts */}
      {primaryRecord?.stateCode && municipalMode && effectiveChartVarId && munVarsAvailable.some((v) => v.id === effectiveChartVarId) && (
        <MunicipalModeView
          stateCode={primaryRecord.stateCode}
          primaryState={primaryState}
          munVars={munVarsAvailable}
          varId={effectiveChartVarId}
        />
      )}

      {primaryVarId && !municipalMode && (
        <>

          {/* Two-column: distribution (left) + map (right) */}
          <div className="two-col">
            {/* Left: histogram + boxplot + narrative */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
              <section className="panel" style={{ flex: 1 }}>
                <div className="ranking-panel-header">
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <p className="panel-title" style={{ margin: 0 }}>Distribución nacional</p>
                    <InfoTooltip wide text={
                      <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--text-2)" }}>
                        <p style={{ fontWeight: 700, margin: "0 0 4px", color: "var(--text-1)" }}>Histograma</p>
                        <p style={{ margin: "0 0 4px" }}>
                          Los <strong>10 intervalos</strong> son pre-calculados y fijos (igual amplitud sobre el rango nacional); cada barra muestra cuántos estados caen en ese rango de valores.
                        </p>
                        <p style={{ margin: "0 0 10px" }}>
                          La <strong>barra resaltada</strong> contiene al estado seleccionado. Pasa el cursor sobre una barra para ver qué estados pertenecen a ese intervalo.
                        </p>
                        <p style={{ fontWeight: 700, margin: "0 0 4px", color: "var(--text-1)" }}>Diagrama de caja (boxplot)</p>
                        <p style={{ margin: "0 0 6px" }}>
                          La <strong>caja</strong> enmarca el 50&nbsp;% central de los estados (Q₁ a Q₃). La línea sólida interior es la <strong>mediana</strong> (valor que divide exactamente a los 32 estados en dos mitades). La línea punteada es la <strong>media nacional</strong>.
                        </p>
                        <p style={{ margin: 0 }}>
                          Los <strong>bigotes</strong> se extienden hasta 1.5&nbsp;×&nbsp;IQR desde cada extremo de la caja — lo que cubre el rango "esperado" sin casos extremos. Los <strong style={{ color: "var(--amber)" }}>puntos naranjas</strong> más allá de los bigotes son estados <em>atípicos</em>. El <strong style={{ color: "var(--blue)" }}>punto azul</strong> es el estado seleccionado.
                        </p>
                      </div>
                    } />
                  </div>
                </div>
                {distribution ? (
                  <DistributionHistogram
                    histogram={distribution.histogram}
                    highlightValue={highlightValue}
                    nationalMean={nationalMeanHist}
                    binStates={histogramBinStates}
                    highlightState={primaryState}
                    comparisonValue={showGroups ? null : comparisonHistValue}
                    comparisonLabel={showGroups ? undefined : (comparisonLabel ?? undefined)}
                    groupLines={showGroups ? histGroupLines : undefined}
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
                      nationalMean={nationalMeanHist ?? undefined}
                      groupMarkers={showGroups ? histGroupLines : undefined}
                    />
                  </div>
                )}
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--text-3)", textAlign: "center" }}>
                  {histMetricDef?.label ?? effectiveChartVarId} — distribución entre los 32 estados
                </p>
              </section>
            </div>

            {/* Right: choropleth map */}
            <section className="panel">
              <div className="panel-title-row">
                <p className="panel-title" style={{ margin: 0 }}>Mapa coroplético</p>
                <InfoTooltip text="Cada estado se colorea según su valor en la variable seleccionada. La escala de color va del tono más claro (valor menor) al más oscuro (valor mayor). Busca patrones espaciales: estados contiguos con colores similares sugieren agrupamientos regionales. Haz clic en cualquier estado para seleccionarlo como estado de análisis." />
              </div>
              <ChoroplethMap appData={appData} varId={effectiveChartVarId ?? ""} groupStateNames={groupStateColors} />
            </section>
          </div>

          {/* Ranking panel — full width */}
          <section className="panel ranking-panel">
            <div className="ranking-panel-header">
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <p className="panel-title" style={{ margin: 0 }}>Ranking nacional</p>
                <InfoTooltip wide text={
                  <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--text-2)" }}>
                    <p style={{ fontWeight: 700, margin: "0 0 4px", color: "var(--text-1)" }}>Posición relativa</p>
                    <p style={{ margin: 0 }}>
                      Los 32 estados ordenados de <strong>mejor a peor</strong> desempeño según la dirección de la variable. El <strong>% vs media</strong> indica cuánto se aleja el estado del promedio nacional: verde = favorable, rojo = desfavorable. El estado seleccionado y los grupos de comparación activos se resaltan.
                    </p>
                  </div>
                } />
              </div>
            </div>
            <div
              className="toggle-pill ranking-panel__toggle"
              role="group"
              aria-label="Vista del ranking"
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft") setRankingView("table");
                if (e.key === "ArrowRight") setRankingView("lollipop");
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
                className={`toggle-pill__btn${rankingView === "lollipop" ? " active" : ""}`}
                onClick={() => setRankingView("lollipop")}
              >
                Lollipop
              </button>
            </div>
            {rankingRows.length > 0 ? (
              <RankingTable
                rows={rankingRows}
                highlightState={primaryState}
                comparisonStates={comparisonGroups.filter(
                  (g) => g !== "nacional" && !g.startsWith("r:") && !g.startsWith("c:")
                )}
                metricLabel={rankingMetricDef?.label ?? effectiveChartVarId ?? ""}
                unit={rankingMetricDef?.unit}
                view={rankingView}
                direction={effectiveRankingDirection}
                groupLines={rankingGroupLines}
              />
            ) : (
              <EmptyState
                title="Sin datos de ranking"
                description="No hay datos suficientes para construir el ranking."
              />
            )}
          </section>
        </>
      )}
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
  primaryState,
  rankingRow,
  totalStates,
}: {
  varId: string;
  stateValue: number | null;
  uniStat: UnivariateStat | null;
  normality: DistributionEntry["normality"] | null;
  primaryState: string | null;
  rankingRow: import("../types/dataStandard").RankingEntry | null;
  totalStates: number;
}) {
  if (!uniStat) return null;

  const { mean, std, skewness, q25, q50, q75 } = uniStat;
  if (mean === null || std === null || skewness === null) return null;

  const zScore = stateValue !== null && std > 0 ? (stateValue - mean) / std : null;

  let quartileLabel: string | null = null;
  if (stateValue !== null && q25 !== null && q50 !== null && q75 !== null) {
    if (stateValue >= q75) quartileLabel = "cuartil superior (top 25 % nacional)";
    else if (stateValue >= q50) quartileLabel = "segundo cuartil (entre la mediana y Q₃)";
    else if (stateValue >= q25) quartileLabel = "tercer cuartil (entre Q₁ y la mediana)";
    else quartileLabel = "cuartil inferior (bottom 25 % nacional)";
  }

  const skewDesc =
    Math.abs(skewness) < 0.5
      ? "aproximadamente simétrica — la media es un buen punto de referencia"
      : skewness > 0
        ? "cola derecha — unos pocos estados con valores altos elevan la media; la mediana refleja mejor al estado 'típico'"
        : "cola izquierda — unos pocos rezagados arrastran la media hacia abajo";

  const normalityNote =
    normality?.is_normal === true
      ? `normal (Shapiro-Wilk p = ${normality.p_value?.toFixed(3)})`
      : normality?.is_normal === false
        ? `no normal (p = ${normality.p_value?.toFixed(3)}) — precaución con comparaciones basadas en σ`
        : null;

  const rankPct = rankingRow ? Math.round((rankingRow.rank / totalStates) * 100) : null;
  const rankTercile =
    rankPct !== null
      ? rankPct <= 33 ? "tercio superior"
        : rankPct <= 66 ? "tercio medio"
        : "tercio inferior"
      : null;

  const S = { lineHeight: 1.65, color: "#334155", margin: "0 0 8px" } as const;

  return (
    <div style={{ marginTop: 12, padding: "0 4px" }}>
      {primaryState && stateValue !== null && (
        <p style={S}>
          <strong>{primaryState}</strong> registra un valor de{" "}
          <strong>{stateValue.toFixed(2)}</strong>
          {quartileLabel ? <>, ubicado en el <strong>{quartileLabel}</strong></> : ""}.
          {rankingRow && rankTercile ? (
            <> En el ranking ocupa el <strong>lugar {rankingRow.rank} de {totalStates}</strong> ({rankTercile} nacional),
            con un valor <strong>{rankingRow.pct_vs_mean >= 0 ? "+" : ""}{rankingRow.pct_vs_mean.toFixed(1)} %</strong> respecto a la media.</>
          ) : ""}
        </p>
      )}
      <p style={S}>
        La distribución entre los 32 estados es <strong>{skewDesc}</strong>.
        El mapa coroplético muestra la variación geográfica — busca patrones regionales.
      </p>
      <p style={{ lineHeight: 1.5, color: "var(--text-3)", fontSize: 11, margin: 0, borderTop: "1px solid var(--border)", paddingTop: 6 }}>
        Media: <strong>{mean.toFixed(2)}</strong> · σ: <strong>{std.toFixed(2)}</strong>
        {zScore !== null && <> · z del estado: <strong>{zScore >= 0 ? "+" : ""}{zScore.toFixed(2)}</strong></>}
        {normalityNote && <> · {normalityNote}</>}
      </p>
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

  const rankPct = rankingRow ? (rankingRow.rank / totalStates) * 100 : null;
  const rankTercile =
    rankPct !== null
      ? rankPct <= 33 ? "tercio superior" : rankPct <= 66 ? "tercio medio" : "tercio inferior"
      : null;

  const S = { lineHeight: 1.65, color: "#334155", margin: "0 0 8px" } as const;

  return (
    <div>
      <p style={S}>
        El perfil de <strong>{primaryState}</strong>
        {stateRegion ? <>, región <strong>{stateRegion}</strong>,</> : ""}{" "}
        se analiza a partir de <strong>{withData.length}</strong> variable{withData.length !== 1 ? "s" : ""} con datos disponibles.{" "}
        {goodPerformers.length === withData.length
          ? "El estado supera la media nacional en todas las variables analizadas."
          : badPerformers.length === withData.length
          ? "El estado se ubica por debajo de la media nacional en todas las variables analizadas."
          : <>
              <strong>{goodPerformers.length}</strong> {goodPerformers.length === 1 ? "presenta" : "presentan"} desempeño favorable frente a la media nacional
              y <strong>{badPerformers.length}</strong> {badPerformers.length === 1 ? "muestra" : "muestran"} oportunidad de mejora.
            </>
        }
      </p>

      {goodPerformers.length > 0 && (
        <p style={S}>
          {goodPerformers.length === 1
            ? <>La variable con mejor desempeño relativo es <strong>{goodPerformers[0].label}</strong> ({fmtPct(goodPerformers[0].delta)} vs media).</>
            : <>
                Las variables con mayor ventaja frente a la media nacional son{" "}
                <strong>{goodPerformers[0].label}</strong> ({fmtPct(goodPerformers[0].delta)})
                {goodPerformers[1] && <> y <strong>{goodPerformers[1].label}</strong> ({fmtPct(goodPerformers[1].delta)})</>}
                {goodPerformers.length > 2 && <>, entre otras {goodPerformers.length - 2}</>}.
              </>
          }
        </p>
      )}

      {badPerformers.length > 0 && (
        <p style={S}>
          {badPerformers.length === 1
            ? <>La variable con mayor brecha respecto a la media es <strong>{badPerformers[0].label}</strong> ({fmtPct(badPerformers[0].delta)} vs media).</>
            : <>
                Las variables con mayor brecha respecto a la media nacional son{" "}
                <strong>{badPerformers[0].label}</strong> ({fmtPct(badPerformers[0].delta)})
                {badPerformers[1] && <> y <strong>{badPerformers[1].label}</strong> ({fmtPct(badPerformers[1].delta)})</>}
                {badPerformers.length > 2 && <>, entre otras {badPerformers.length - 2}</>}.
              </>
          }
        </p>
      )}

      {rankingRow && rankingLabel && (
        <p style={S}>
          En <strong>{rankingLabel}</strong>, el estado ocupa el{" "}
          <strong>lugar {rankingRow.rank} de {totalStates}</strong>
          {rankTercile ? <> ({rankTercile} nacional)</> : ""},{" "}
          con un valor <strong>{fmtPct(rankingRow.pct_vs_mean)}</strong> respecto al promedio nacional.
        </p>
      )}

      {outliers.length > 0 && (
        <p style={{ ...S, margin: 0 }}>
          Se detecta comportamiento atípico (criterio IQR ×1.5) en:{" "}
          <strong>{outliers.map((c) => c.label).join(", ")}</strong>.{" "}
          {outliers.length === 1
            ? "El estado se aleja significativamente de la distribución del resto en esta variable, lo que puede reflejar una condición estructural o una política pública diferenciada."
            : "El estado se aleja de la distribución del resto en estas variables, lo que puede reflejar condiciones estructurales diferenciadas o efectos de políticas públicas específicas."
          }
        </p>
      )}
    </div>
  );
}

    