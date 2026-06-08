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
import { GROUP_COLORS, NACIONAL_COLOR } from "../components/sidebar/ComparisonGroupSelector";

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
  const { primaryState, activeVariableIds, comparisonGroups } = appState;
  const { dataset, outliers, distributions, univariateStats } = appData;

  const primaryRecord = useMemo(
    () => dataset.records.find((r) => r.state === primaryState),
    [dataset.records, primaryState]
  );

  const secondaryGroup = comparisonGroups.find((g) => g !== "nacional") ?? null;

  const comparisonLabel: string | null = secondaryGroup
    ? secondaryGroup.startsWith("r:") ? `Región ${secondaryGroup.slice(2)}`
    : secondaryGroup.startsWith("c:")
      ? (appData.pcaResults?.cluster_stats[secondaryGroup.slice(2)]?.label ?? `Cluster ${secondaryGroup.slice(2)}`).replace(/:.*$/, "").trim()
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

  const groupColorMap = useMemo(() => {
    const map = new Map<string, string>();
    map.set("nacional", NACIONAL_COLOR);
    comparisonGroups
      .filter((g) => g !== "nacional")
      .forEach((g, i) => map.set(g, GROUP_COLORS[i] ?? GROUP_COLORS[GROUP_COLORS.length - 1]));
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
    if (g.startsWith("c:")) return (appData.pcaResults?.cluster_stats[g.slice(2)]?.label ?? `Cluster ${g.slice(2)}`).replace(/:.*$/, "").trim();
    return g;
  }

  const groupStateColors = useMemo((): Map<string, string> => {
    if (!nonNacionalGroups.length) return new Map();
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
  }, [nonNacionalGroups, groupColorMap, dataset.records, appData.pcaResults]);

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
      const groupComparisons = nonNacionalGroups.length > 0
        ? nonNacionalGroups.map((g) => {
            const gVal = computeGroupValue(g, varId);
            return {
              label: groupLabel(g),
              delta: value !== null && gVal !== null ? calcDelta(value, gVal) : null,
              color: groupColorMap.get(g) ?? "#6b7280",
            };
          })
        : undefined;
      const dir = getMetricPolaridad(varId, appData.variablesCatalog);
      const validForRank = dataset.records.filter(
        (r) => typeof r.metrics[varId] === "number" && !isNaN(r.metrics[varId])
      );
      const rankSorted =
        dir === "lower_better"
          ? [...validForRank].sort((a, b) => a.metrics[varId] - b.metrics[varId])
          : [...validForRank].sort((a, b) => b.metrics[varId] - a.metrics[varId]);
      const rankIdx = rankSorted.findIndex((r) => r.state === primaryState);
      const rank = rankIdx >= 0 ? rankIdx + 1 : null;
      return {
        label: metricDef?.label ?? varId,
        value,
        unit: metricDef?.unit,
        tipoValor: guessTipoValor(varId, metricDef?.unit ?? ""),
        delta,
        direction: dir,
        isOutlier: stateIsOutlier,
        rank,
        comparisonLabel: comparisonLabel ?? undefined,
        comparisonDelta: compDelta,
        groupComparisons,
        hasMunicipalData: munVarsAvailable.some((v) => v.id === varId),
      };
    });
  }, [primaryRecord, activeVariableIds, dataset, outliers, comparisonValues, comparisonLabel, nonNacionalGroups, groupColorMap, munVarsAvailable]);

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

  // Single source of truth for all 6 panels (histogram, map, ranking, mun-dist, mun-map, mun-ranking)
  const [activeChartVarId, setActiveChartVarId] = useState<string | null>(null);
  useEffect(() => { setActiveChartVarId(null); }, [primaryState]);
  const effectiveChartVarId =
    activeChartVarId && activeVariableIds.includes(activeChartVarId) ? activeChartVarId : primaryVarId;


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
    if (!effectiveChartVarId || !nonNacionalGroups.length) return [];
    return nonNacionalGroups.flatMap((g) => {
      const value = computeGroupValue(g, effectiveChartVarId);
      const color = groupColorMap.get(g) ?? "#6b7280";
      return value !== null ? [{ value, label: groupLabel(g), color }] : [];
    });
  }, [effectiveChartVarId, nonNacionalGroups, groupColorMap, dataset.records, appData.pcaResults]);

  const rankingGroupLines = useMemo((): GroupLine[] => {
    if (!effectiveChartVarId || !nonNacionalGroups.length) return [];
    return nonNacionalGroups.flatMap((g) => {
      if (!g.startsWith("r:") && !g.startsWith("c:")) return [];
      const value = computeGroupValue(g, effectiveChartVarId);
      const color = groupColorMap.get(g) ?? "#6b7280";
      return value !== null ? [{ value, label: groupLabel(g), color }] : [];
    });
  }, [effectiveChartVarId, nonNacionalGroups, groupColorMap, dataset.records, appData.pcaResults]);

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
        title={`Diagnóstico general de ${primaryState}${stateRegion ? ` · Región ${stateRegion}` : ""}`}
        description="Vista del estado seleccionado frente al conjunto nacional, regiones, clusters o estados."
      >
        {kpiCards.length > 0 ? (
          <DiagnosticoNarrative
            primaryState={primaryState}
            stateRegion={stateRegion}
            kpiCards={kpiCards}
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
          panelTitle="Perfil comparativo"
          tooltip={<InfoTooltip wide text={
            <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--text-2)" }}>
              <p style={{ fontWeight: 700, margin: "0 0 4px", color: "var(--text-1)" }}>Vista y normalización</p>
              <p style={{ margin: "0 0 10px" }}>
                Usa los botones <strong>Radar / Barras</strong> para cambiar el tipo de gráfico. Ambas vistas usan la misma escala de <strong>normalización</strong> (percentil 0-100) sobre los 32 estados. En variables de polaridad negativa (ej. pobreza) la escala se invierte: 100 = mejor desempeño.
              </p>
              <p style={{ fontWeight: 700, margin: "0 0 4px", color: "var(--text-1)" }}>¿Cómo interpretar?</p>
              <p style={{ margin: "0 0 8px" }}>
                En el radar: cuanto más alejado del centro, mayor ventaja relativa. El área encerrada refleja el desempeño agregado.
              </p>
                            <p style={{ margin: "0 0 8px" }}>
                En las barras: cuanto más alta la barra, mejor desempeño relativo. Las barras están en puntos normalizados, no en las unidades originales.
              </p>
              <p style={{ margin: 0 }}>
                Los <strong>grupos de comparación</strong> se configuran en el panel lateral izquierdo: puedes añadir el promedio nacional, una región, un cluster estructural o un estado específico. El hover muestra el valor real en unidades originales.
              </p>
            </div>
          } />}
        />
      </section>

      {primaryVarId && (
        <>
          {/* Section divider after Perfil comparativo */}
          <div style={{ margin: "32px 0 0", display: "flex", alignItems: "center" }}>
            <div style={{ flex: 1, height: 2, background: "var(--blue-mid)", borderRadius: 1 }} />
          </div>

          {/* Variable selector — standalone, outside narrative */}
          {activeVariableIds.length > 1 && effectiveChartVarId && (
            <div className="var-pill-row" style={{ marginTop: 16, marginBottom: 0 }}>
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

          {/* Narrative — no chips inside */}
          {effectiveChartVarId && (
            <TabNarrative
              title={municipalMode
                ? `Vista municipal — ${histMetricDef?.label ?? effectiveChartVarId}`
                : `Vista nacional: ${histMetricDef?.label ?? effectiveChartVarId}`}
              description={municipalMode
                ? `Distribución, mapa y ranking de municipios de ${primaryState ?? "este estado"} para la variable seleccionada.`
                : "Distribución entre los 32 estados, mapa coroplético y ranking nacional para la variable seleccionada."}
              style={{ marginTop: 10 }}
            >
              {!municipalMode && (
                <DistributionInsights
                  varId={effectiveChartVarId}
                  stateValue={highlightValue}
                  uniStat={univariateStats[effectiveChartVarId] ?? null}
                  normality={distribution?.normality ?? null}
                  primaryState={primaryState}
                  rankingRow={rankingRows.find((r) => r.state === primaryState) ?? null}
                  totalStates={dataset.records.length}
                  groupComparisons={nonNacionalGroups.flatMap((g) => {
                    const gVal = computeGroupValue(g, effectiveChartVarId);
                    return gVal !== null && highlightValue !== null
                      ? [{ label: groupLabel(g), delta: calcDelta(highlightValue, gVal), color: groupColorMap.get(g) ?? "#6b7280" }]
                      : [];
                  })}
                />
              )}
              {municipalMode && (
                <MunicipalNarrative
                  stateName={primaryState ?? "este estado"}
                  varLabel={histMetricDef?.label ?? effectiveChartVarId ?? ""}
                  varUnit={histMetricDef?.unit}
                  direction={histMetricDef ? getMetricPolaridad(histMetricDef.id) : "higher_better"}
                  activeGroupNames={nonNacionalGroups.map(groupLabel)}
                />
              )}
            </TabNarrative>
          )}

          {/* Municipal toggle — only when selected variable has municipal data */}
          {munVarsAvailable.some((v) => v.id === effectiveChartVarId) && (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
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
                {distribution ? (
                  <DistributionHistogram
                    histogram={distribution.histogram}
                    highlightValue={highlightValue}
                    nationalMean={nationalMeanHist}
                    binStates={histogramBinStates}
                    highlightState={primaryState}
                    comparisonValue={nonNacionalGroups.length > 0 ? null : comparisonHistValue}
                    comparisonLabel={nonNacionalGroups.length > 0 ? undefined : (comparisonLabel ?? undefined)}
                    groupLines={nonNacionalGroups.length > 0 ? histGroupLines : undefined}
                    label={histMetricDef?.label ?? effectiveChartVarId ?? ""}
                    panelTitle="Distribución nacional"
                    tooltip={<InfoTooltip wide text={
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
                          La <strong>caja</strong> enmarca el 50&nbsp;% central de los estados (Q₁ a Q₃). La línea sólida interior es la <strong>mediana</strong>; la línea punteada es la <strong>media nacional</strong>.
                        </p>
                        <p style={{ margin: "0 0 10px" }}>
                          Los <strong>bigotes</strong> cubren el rango esperado (1.5&nbsp;×&nbsp;IQR). Los <strong style={{ color: "var(--amber)" }}>puntos naranjas</strong> son estados atípicos; el <strong style={{ color: "var(--blue)" }}>punto azul</strong> es el estado seleccionado.
                        </p>
                        <p style={{ margin: 0, color: "var(--text-3)" }}>
                          Si la variable tiene datos municipales, el botón <strong>«Ver municipios →»</strong> (justo debajo) permite explorar la distribución interna del estado seleccionado.
                        </p>
                      </div>
                    } />}
                    footer={histStateValues.length >= 4 ? (
                      <div style={{ padding: "0 16px 0 28px", marginTop: 2 }}>
                        <InlineBoxplot
                          stateValues={histStateValues}
                          highlightState={primaryState}
                          domainMin={Math.min(...histStateValues.map((d) => d.value))}
                          domainMax={Math.max(...histStateValues.map((d) => d.value))}
                          nationalMean={nationalMeanHist ?? undefined}
                          groupMarkers={nonNacionalGroups.length > 0 ? histGroupLines : undefined}
                        />
                      </div>
                    ) : undefined}
                  />
                ) : (
                  <EmptyState
                    title="Sin histograma"
                    description="Ejecuta npm run pipeline:layer1 para generar distribuciones."
                  />
                )}
              </section>
            </div>

            {/* Right: choropleth map */}
            <section className="panel">
              <ChoroplethMap
                appData={appData}
                varId={effectiveChartVarId ?? ""}
                groupStateNames={groupStateColors}
                panelTitle="Mapa coroplético"
                tooltip={<InfoTooltip wide text={
                  <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--text-2)" }}>
                    <p style={{ fontWeight: 700, margin: "0 0 4px", color: "var(--text-1)" }}>Mapa coroplético nacional</p>
                    <p style={{ margin: "0 0 8px" }}>
                      Cada estado se colorea según su valor en la variable seleccionada: tono más claro = valor menor, más oscuro = valor mayor. Busca patrones espaciales, ya que estados contiguos con colores similares sugieren agrupamientos regionales.
                    </p>
                    <p style={{ margin: "0 0 8px" }}>
                      <strong>Haz clic en un estado</strong> para seleccionarlo como estado de análisis principal. Los grupos de comparación configurados en el panel lateral se destacan con bordes de color.
                    </p>
                    <p style={{ margin: 0, color: "var(--text-3)" }}>
                      Si la variable tiene datos municipales disponibles, usa el botón <strong>«Ver municipios →»</strong> encima del histograma para explorar la distribución interna del estado.
                    </p>
                  </div>
                } />}
              />
            </section>
          </div>

          {/* Ranking panel — full width */}
          <section className="panel ranking-panel">
            {rankingRows.length > 0 ? (
              <RankingTable
                rows={rankingRows}
                highlightState={primaryState}
                comparisonStates={comparisonGroups.filter(
                  (g) => g !== "nacional" && !g.startsWith("r:") && !g.startsWith("c:")
                )}
                groupStateColors={groupStateColors}
                metricLabel={rankingMetricDef?.label ?? effectiveChartVarId ?? ""}
                unit={rankingMetricDef?.unit}
                initialView="lollipop"
                direction={effectiveRankingDirection}
                groupLines={rankingGroupLines}
                showNational={comparisonGroups.includes("nacional")}
                panelTitle="Ranking nacional"
                tooltip={
                  <InfoTooltip wide text={
                    <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--text-2)" }}>
                      <p style={{ fontWeight: 700, margin: "0 0 4px", color: "var(--text-1)" }}>Ranking nacional</p>
                      <p style={{ margin: "0 0 8px" }}>
                        Los 32 estados ordenados de <strong>mejor a peor</strong> desempeño según la dirección de la variable. El <strong>% vs media</strong> indica cuánto se aleja el estado del promedio nacional: verde = favorable, rojo = desfavorable.
                      </p>
                      <p style={{ margin: "0 0 8px" }}>
                        El estado de análisis y los grupos de comparación configurados en el panel lateral se resaltan con su color correspondiente.
                      </p>
                      <p style={{ margin: 0, color: "var(--text-3)" }}>
                        Si la variable tiene datos municipales, usa el botón <strong>«Ver municipios →»</strong> en la sección superior para ver el ranking a nivel de municipio dentro del estado seleccionado.
                      </p>
                    </div>
                  } />
                }
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
  groupComparisons = [],
}: {
  varId: string;
  stateValue: number | null;
  uniStat: UnivariateStat | null;
  normality: DistributionEntry["normality"] | null;
  primaryState: string | null;
  rankingRow: import("../types/dataStandard").RankingEntry | null;
  totalStates: number;
  groupComparisons?: { label: string; delta: number | null; color: string }[];
}) {
  if (!uniStat || !primaryState || stateValue === null) return null;

  const { mean, std, skewness } = uniStat;
  if (mean === null || std === null || skewness === null) return null;

  const zScore = std > 0 ? (stateValue - mean) / std : null;
  const delta = mean !== 0 ? ((stateValue - mean) / Math.abs(mean)) * 100 : 0;
  const absDelta = Math.abs(delta).toFixed(1);
  const isBelow = delta < 0;
  const isNormal = normality?.is_normal;

  function ordinalRank(rank: number): string {
    if (rank === 1) return "primer lugar nacional";
    if (rank === 2) return "segundo lugar nacional";
    if (rank === 3) return "tercer lugar nacional";
    if (rank === totalStates) return "último lugar nacional";
    if (rank === totalStates - 1) return "penúltimo lugar nacional";
    return `lugar ${rank} de ${totalStates}`;
  }

  const rankPct = rankingRow ? (rankingRow.rank / totalStates) * 100 : null;
  const perfOpener =
    rankPct === null ? null
    : rankPct <= 10 ? "exhibe uno de los mejores desempeños del país."
    : rankPct <= 25 ? "se posiciona en el cuartil superior nacional."
    : rankPct <= 50 ? "se sitúa por encima de la mediana nacional."
    : rankPct <= 75 ? "se sitúa por debajo de la mediana nacional."
    : "exhibe uno de los rezagos más pronunciados del país.";

  const distDesc =
    Math.abs(skewness) < 0.5
      ? "distribuye de forma aproximadamente simétrica entre los estados, por lo que la media es un punto de referencia confiable"
      : skewness > 0
        ? "presenta cola derecha: algunos estados con valores muy altos elevan la media por encima del estado típico, por lo que la mediana refleja mejor al estado representativo"
        : "presenta cola izquierda: un grupo de estados rezagados arrastra la media hacia abajo, por lo que la mediana refleja mejor al estado representativo";

  const zAbs = zScore !== null ? Math.abs(zScore) : null;
  const zDesc =
    zAbs === null ? null
    : zAbs >= 2.5 ? "una desconexión crítica que lo aleja radicalmente del comportamiento del conjunto"
    : zAbs >= 2.0 ? "un comportamiento atípico que supera el umbral estándar de identificación de valores extremos"
    : zAbs >= 1.5 ? "una desviación notable respecto al patrón nacional"
    : zAbs >= 1.0 ? "una distancia moderada con respecto a la media"
    : "una posición cercana al promedio nacional";

  const nonNormalNote =
    isNormal === false && zAbs !== null
      ? `El test Shapiro-Wilk confirma que la distribución no sigue una curva normal (p = ${normality?.p_value?.toFixed(3)}): los extremos o la asimetría son más pronunciados de lo esperado. Esto significa que estar a ${zAbs.toFixed(1)} σ de la media no equivale al mismo percentil que en una distribución simétrica, por lo que la magnitud del z-score debe leerse junto con la posición en el ranking.`
      : null;

  const activeGroups = groupComparisons.filter((g) => g.delta !== null);

  const S = { lineHeight: 1.7, color: "#334155", margin: "0 0 10px" } as const;
  const Sfooter = { lineHeight: 1.5, color: "var(--text-3)", fontSize: 11, margin: 0, borderTop: "1px solid var(--border)", paddingTop: 6 } as const;

  return (
    <div style={{ marginTop: 12, padding: "0 4px" }}>
      <p style={S}>
        <strong>{primaryState}</strong>{perfOpener ? ` ${perfOpener}` : ","} Su valor de{" "}
        <strong>{stateValue.toFixed(2)}</strong> está un{" "}
        <strong>{absDelta}%</strong> {isBelow ? "por debajo" : "por encima"} del promedio nacional ({mean.toFixed(2)}),
        situándolo en el{" "}
        {rankingRow
          ? <strong>{ordinalRank(rankingRow.rank)}</strong>
          : "ranking sin posición calculada"
        }.
      </p>

      <p style={S}>
        La variable se <strong>{distDesc}</strong>.{" "}
        {zScore !== null && zDesc && (
          <>
            La posición de <strong>{primaryState}</strong> a{" "}
            <strong>{Math.abs(zScore).toFixed(2)} σ</strong> de la media confirma {zDesc}.
          </>
        )}
        {nonNormalNote && <> {nonNormalNote}</>}
      </p>

      {activeGroups.length > 0 && (
        <p style={S}>
          Respecto a los grupos activos:{" "}
          {activeGroups.map((g, i) => (
            <span key={g.label}>
              {i > 0 ? "; " : ""}
              <strong>{Math.abs(g.delta!).toFixed(1)}% {(g.delta ?? 0) >= 0 ? "por encima" : "por debajo"}</strong> de {g.label}
            </span>
          ))}.
        </p>
      )}

      <p style={Sfooter}>
        Media: <strong>{mean.toFixed(2)}</strong> · σ: <strong>{std.toFixed(2)}</strong>
        {zScore !== null && <> · z del estado: <strong>{zScore >= 0 ? "+" : ""}{zScore.toFixed(2)}</strong></>}
        {normality?.p_value != null && (
          <> · Shapiro-Wilk p = <strong>{normality.p_value.toFixed(3)}</strong>{isNormal === false ? " (no normal)" : " (normal)"}</>
        )}
      </p>
    </div>
  );
}

// ── Narrativa vista municipal ─────────────────────────────────────────────────

function MunicipalNarrative({
  stateName,
  varLabel,
  varUnit,
  direction,
  activeGroupNames = [],
}: {
  stateName: string;
  varLabel: string;
  varUnit?: string;
  direction: import("../types/dataStandard").MetricPolaridad;
  activeGroupNames?: string[];
}) {
  const S = { lineHeight: 1.7, color: "#334155", margin: "0 0 10px" } as const;
  const isLowerBetter = direction === "lower_better";
  const favorableAdj = isLowerBetter ? "bajos" : "altos";
  const leadersDesc = isLowerBetter ? "menor valor son las zonas líderes" : "mayor valor son las zonas líderes";
  const rezagoDesc = isLowerBetter ? "mayor valor representan los rezagos más críticos" : "menor valor representan los rezagos más críticos";
  const priorityInterv = isLowerBetter
    ? "mayor valor en esta variable requieren atención prioritaria"
    : "menor valor en esta variable requieren atención prioritaria";

  return (
    <div style={{ marginTop: 12, padding: "0 4px" }}>
      <p style={S}>
        Esta vista desagrega <strong>{varLabel}</strong>
        {varUnit ? ` (${varUnit})` : ""} a nivel municipal en{" "}
        <strong>{stateName}</strong> para identificar las brechas internas del estado.
        Dado que valores <strong>{favorableAdj}</strong> son favorables,
        los municipios con {leadersDesc}, mientras que los de {rezagoDesc} al interior del estado.
      </p>
      <p style={S}>
        Si el <strong>histograma</strong> muestra una distribución bimodal o muy dispersa,
        indica polarización interna significativa: la media estatal oculta contrastes extremos
        entre municipios y no debe usarse como referencia única.
        El <strong>mapa</strong> permite identificar si ese patrón sigue lógicas geográficas
        (norte/sur, sierra/costa, urbano/rural), lo que orienta intervenciones focalizadas
        hacia zonas con características territoriales compartidas.
      </p>
      <p style={{ lineHeight: 1.7, color: "#334155", margin: activeGroupNames.length > 0 ? "0 0 10px" : 0 }}>
        El <strong>ranking municipal</strong> es la herramienta clave para identificar prioridades
        de intervención: los municipios con {priorityInterv} para reducir las brechas internas
        y acercar al estado a una distribución más equitativa.
      </p>
      {activeGroupNames.length > 0 && (
        <p style={{ lineHeight: 1.7, color: "#334155", margin: 0 }}>
          Los grupos de comparación activos ({activeGroupNames.join(", ")}) están disponibles
          en la vista nacional. Para comparar el comportamiento de{" "}
          <strong>{stateName}</strong> frente a esos grupos en términos municipales,
          consulta el ranking y el mapa coroplético del estado seleccionado.
        </p>
      )}
    </div>
  );
}

// ── Narrativa automática ──────────────────────────────────────────────────────

type KpiCardSummary = {
  label: string;
  value: number | null;
  unit?: string;
  delta: number | null;
  direction: string;
  isOutlier: boolean;
  rank: number | null;
};

function DiagnosticoNarrative({
  primaryState,
  stateRegion,
  kpiCards,
  totalStates,
}: {
  primaryState: string;
  stateRegion: string | null;
  kpiCards: KpiCardSummary[];
  totalStates: number;
}) {
  const withData = kpiCards.filter((c) => c.value !== null && c.delta !== null);
  if (!withData.length) return null;

  const good = withData
    .filter((c) => c.direction === "lower_better" ? (c.delta! < 0) : (c.delta! > 0))
    .sort((a, b) => Math.abs(b.delta!) - Math.abs(a.delta!));
  const bad = withData
    .filter((c) => c.direction === "lower_better" ? (c.delta! > 0) : (c.delta! < 0))
    .sort((a, b) => Math.abs(b.delta!) - Math.abs(a.delta!));

  const worstBad = bad[0] ?? null;
  const worstIsOutlier = worstBad?.isOutlier ?? false;

  // Profile adjective
  const profileAdj =
    good.length === withData.length ? "altamente competitivo"
    : bad.length === withData.length ? "con rezago generalizado"
    : good.length / withData.length >= 0.75 ? "competitivo"
    : good.length / withData.length >= 0.5 ? "mixto, con predominio de fortalezas"
    : "mixto, con brechas relevantes";

  // Rule 2 — ordinal position: no "tercio" if % was already cited
  function ordinalRank(rank: number | null): string {
    if (!rank) return "";
    if (rank === 1) return "primer lugar nacional";
    if (rank === 2) return "segundo lugar nacional";
    if (rank === 3) return "tercer lugar nacional";
    if (rank === totalStates) return "último lugar nacional";
    if (rank === totalStates - 1) return "penúltimo lugar nacional";
    if (rank === totalStates - 2) return "antepenúltimo lugar nacional";
    return `lugar ${rank} de ${totalStates}`;
  }

  // Delta description (favorable / unfavorable)
  function deltaDesc(c: KpiCardSummary, favorable: boolean): React.ReactNode {
    const abs = Math.abs(c.delta!).toFixed(1);
    if (favorable) {
      return c.direction === "lower_better"
        ? <><strong>{abs}%</strong> menor a la media nacional</>
        : <><strong>{abs}%</strong> superior al promedio nacional</>;
    }
    return c.direction === "lower_better"
      ? <><strong>{abs}%</strong> por encima de la media nacional</>
      : <><strong>{abs}%</strong> por debajo de la media nacional</>;
  }

  const S = { lineHeight: 1.7, color: "#334155", margin: "0 0 10px" } as const;

  // Outliers NOT already covered as worstBad
  const residualOutliers = withData.filter((c) => c.isOutlier && c !== worstBad);

  return (
    <div>
      {/* Párrafo 1 — perfil general */}
      <p style={S}>
        El estado muestra un <strong>perfil {profileAdj}</strong>, con desempeño favorable en{" "}
        <strong>{good.length}</strong> de <strong>{withData.length}</strong>{" "}
        variable{withData.length !== 1 ? "s" : ""} analizadas frente a la media nacional
        {stateRegion ? ` dentro de la región ${stateRegion}` : ""}.
      </p>

      {/* Párrafo 2 — fortalezas */}
      {good.length > 0 && (
        <p style={S}>
          {good.length === 1 ? (
            <>
              Su principal fortaleza es <strong>{good[0].label}</strong>, con un valor {deltaDesc(good[0], true)}
              {good[0].rank && <>, situándolo en el <strong>{ordinalRank(good[0].rank)}</strong></>}.
            </>
          ) : (
            <>
              Su principal fortaleza radica en{" "}
              <strong>{good[0].label}</strong> ({deltaDesc(good[0], true)})
              {good[1] && <>, seguido de <strong>{good[1].label}</strong> ({deltaDesc(good[1], true)})</>}
              {good.length > 2 && <>, entre otras <strong>{good.length - 2}</strong> variable{good.length - 2 !== 1 ? "s" : ""}</>}.
            </>
          )}
        </p>
      )}

      {/* Párrafo 3 — brecha principal */}
      {worstBad && (
        <p style={S}>
          {worstIsOutlier ? (
            // Regla 1: Consolidación de outlier — lenguaje de rezago crítico/aislamiento
            <>
              Sin embargo, {good.length > 0 ? "este perfil contrasta con " : "el estado presenta "}
              un <strong>rezago crítico de carácter atípico</strong> en{" "}
              <strong>{worstBad.label}</strong>: la entidad se ubica un {deltaDesc(worstBad, false)},
              {worstBad.rank && <> situándola en el <strong>{ordinalRank(worstBad.rank)}</strong></>}.{" "}
              Este <strong>aislamiento estadístico</strong> —que supera el umbral IQR×1.5 de la distribución nacional—
              sugiere una condición estructural diferenciada o un déficit severo que no se explica
              por la tendencia general del país
              {stateRegion ? ` para los estados de la región ${stateRegion}` : ""}.
              {bad.length > 1 && (
                <> Adicionalmente, <strong>{bad.slice(1, 3).map((c) => c.label).join(" y ")}</strong>{" "}
                también registra{bad.slice(1, 3).length > 1 ? "n" : ""} valores desfavorables.</>
              )}
            </>
          ) : (
            // Sin outlier: brecha directa (Regla 2: ordinal en vez de absoluto+tercio)
            <>
              El principal déficit se observa en <strong>{worstBad.label}</strong>,
              que registra un {deltaDesc(worstBad, false)}
              {worstBad.rank && <> ({ordinalRank(worstBad.rank)})</>}.
              {bad.length > 1 && (
                <> Le siguen{" "}
                {bad.slice(1, 3).map((c, i) => (
                  <span key={c.label}>{i > 0 ? " y " : " "}<strong>{c.label}</strong> ({deltaDesc(c, false)})</span>
                ))}.
                </>
              )}
              {/* Regla 1: outliers residuales no cubiertos por worstBad */}
              {residualOutliers.length > 0 && (
                <> Se detecta además comportamiento atípico en{" "}
                <strong>{residualOutliers.map((c) => c.label).join(", ")}</strong>.</>
              )}
            </>
          )}
        </p>
      )}

      {/* Solo outliers positivos (buen desempeño pero atípico) */}
      {!worstBad && withData.some((c) => c.isOutlier) && (
        <p style={{ ...S, margin: 0 }}>
          A pesar del desempeño favorable, se detecta comportamiento atípico en{" "}
          <strong>{withData.filter((c) => c.isOutlier).map((c) => c.label).join(", ")}</strong>,
          lo que puede reflejar condiciones estructurales diferenciadas o políticas públicas específicas.
        </p>
      )}
    </div>
  );
}

    