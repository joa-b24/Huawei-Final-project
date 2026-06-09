import { useMemo, useRef, useState } from "react";
import { captureElementToPng, createZip, dataUrlToBytes, triggerDownload } from "../lib/chartExport";
import { useAppContext } from "../context/AppContext";
import type { AppData } from "../services/DataService";
import CorrelationBarChart from "../components/charts/CorrelationBarChart";
import ChartWrapper from "../components/charts/ChartWrapper";
import PairScatterChart from "../components/charts/PairScatterChart";
import MultivariateRegressionPlot from "../components/charts/MultivariateRegressionPlot";
import EmptyState from "../components/EmptyState";
import InfoTooltip from "../components/feedback/InfoTooltip";
import InsightBox from "../components/feedback/InsightBox";
import TabNarrative from "../components/feedback/TabNarrative";
import { corrPValue } from "../lib/stats";
import { GROUP_COLORS, NACIONAL_COLOR } from "../components/sidebar/ComparisonGroupSelector";
import type { StateCard } from "../types/dataStandard";
import type { StateMetricRecord } from "../types/dataset";

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
  const { primaryState, activeVariableIds, comparisonGroups } = appState;
  const { dataset, correlations } = appData;

  const effectiveStateCards = useMemo(
    () => buildStateCardsFromRecords(dataset.records),
    [dataset.records]
  );

  const [selectedX, setSelectedX] = useState<string | null>(null);
  const [selectedY, setSelectedY] = useState<string | null>(null);
  const [corrFullscreen, setCorrFullscreen] = useState(false);
  const corrBarRef = useRef<HTMLDivElement>(null);
  const corrScatterRef = useRef<HTMLDivElement>(null);
  const [regDownloadFn, setRegDownloadFn] = useState<(() => Promise<void>) | null>(null);

  const groupColorMap = useMemo(() => {
    const map = new Map<string, string>();
    map.set("nacional", NACIONAL_COLOR);
    comparisonGroups
      .filter((g) => g !== "nacional")
      .forEach((g, i) => map.set(g, GROUP_COLORS[i] ?? GROUP_COLORS[GROUP_COLORS.length - 1]));
    return map;
  }, [comparisonGroups]);

  const nonNacionalGroups = comparisonGroups.filter((g) => g !== "nacional");

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

  const groupLegend = useMemo(() => {
    if (!nonNacionalGroups.length) return undefined;
    return nonNacionalGroups.map((g) => {
      let label: string;
      if (g.startsWith("r:")) label = g.slice(2);
      else if (g.startsWith("c:")) label = appData.pcaResults?.cluster_stats[g.slice(2)]?.label ?? `Cluster ${g.slice(2)}`;
      else label = g;
      return { label, color: groupColorMap.get(g) ?? "#6b7280" };
    });
  }, [nonNacionalGroups, groupColorMap, appData.pcaResults]);

  const hasCorrData = correlations.pearson.variables.length > 0;

  const fsChartH = corrFullscreen
    ? Math.max(480, Math.floor(window.innerHeight - 400))
    : undefined;

  async function handleCorrDownload() {
    const barEl = corrBarRef.current;
    const scatterEl = corrScatterRef.current;
    if (!barEl || !scatterEl) return;
    function slug(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30); }
    const [barUrl, scatterUrl] = await Promise.all([
      captureElementToPng(barEl),
      captureElementToPng(scatterEl),
    ]);
    const zipBytes = createZip([
      { name: `correlaciones-${slug(yLabel)}.png`, data: dataUrlToBytes(barUrl) },
      { name: `dispersion-${slug(xLabel)}-vs-${slug(yLabel)}.png`, data: dataUrlToBytes(scatterUrl) },
    ]);
    const url = URL.createObjectURL(new Blob([zipBytes.buffer as ArrayBuffer], { type: "application/zip" }));
    triggerDownload(url, `correlacion-${slug(yLabel)}.zip`);
  }

  return (
    <div className="tab-content">
      <TabNarrative
        title="Análisis de impacto"
        description="Relaciones estadísticas entre variables activas: correlación de Pearson, dispersión por par de variables y regresión multivariada."
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
          {/* Unified correlation panel */}
          <ChartWrapper
            standalone
            panelTitle="Correlación"
            title={`Impacto de ${yLabel}`}
            description={`Coeficientes de Pearson. El botón de descarga exporta las 2 gráficas en un archivo ZIP.`}
            chartType="Correlación"
            onDownload={handleCorrDownload}
            onFullscreenChange={setCorrFullscreen}
            tooltip={
              <InfoTooltip wide text={
                <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--text-2)" }}>
                  <p style={{ fontWeight: 700, margin: "0 0 6px", color: "var(--text-1)" }}>Coeficientes de correlación</p>
                  <p style={{ margin: "0 0 8px" }}>
                    Mide la asociación <strong>lineal</strong> (Pearson) entre cada variable y la variable objetivo seleccionada. Rango: −1 a +1. El signo indica dirección (directa o inversa); el valor absoluto indica intensidad.
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
                  <p style={{ fontWeight: 700, margin: "0 0 4px", color: "var(--text-1)" }}>Diagrama de dispersión</p>
                  <p style={{ margin: "0 0 8px" }}>
                    Muestra cada estado como un punto según sus valores en dos variables. Permite ver si la relación es realmente lineal, si hay estados atípicos que distorsionan el coeficiente r, o si el patrón cambia en distintos rangos de valores. <strong>Haz clic en una barra</strong> del gráfico de correlación para actualizar qué par de variables se muestra aquí.
                  </p>
                  <p style={{ margin: 0, color: "var(--text-3)", fontSize: 11 }}>
                    Correlación no implica causalidad. Una r alta puede reflejar un factor subyacente común, como el nivel general de desarrollo del estado.
                  </p>
                </div>
              } />
            }
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8}}>
                <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-3)" }}>
                  Variable objetivo
                </span>
                <select
                  className="comparison-select comparison-select--sm"
                  value={yVarId ?? ""}
                  onChange={(e) => setSelectedY(e.target.value)}
                  style={{ maxWidth: 400 }}
                >
                  {activeVariableIds.map((id) => (
                    <option key={id} value={id}>{getLabelAndUnit(id).label}</option>
                  ))}
                </select>
              </div>

              <div className="two-col corr-charts">
                <div ref={corrBarRef}>
                  <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: "var(--text-2)" }}>
                    Correlaciones con {yLabel}
                  </p>
                  {corrRows.length > 0 ? (
                    <CorrelationBarChart
                      rows={corrRows}
                      selectedId={xVarId}
                      onBarClick={setSelectedX}
                      chartHeight={fsChartH}
                    />
                  ) : hasCorrData ? (
                    <EmptyState title="Variable no encontrada" description="La variable seleccionada no está en la matriz de correlaciones." />
                  ) : (
                    <EmptyState title="Sin correlaciones precalculadas" description="Ejecuta npm run pipeline:layer1 para generar correlations.json." />
                  )}
                </div>

                <div ref={corrScatterRef}>
                  <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: "var(--text-2)" }}>
                    {xLabel} vs {yLabel}
                  </p>
                  <PairScatterChart
                    data={scatterData}
                    xLabel={xLabel}
                    yLabel={yLabel}
                    highlightState={primaryState ?? undefined}
                    xUnit={xUnit}
                    yUnit={yUnit}
                    groupStateColors={nonNacionalGroups.length > 0 ? groupStateColors : undefined}
                    groupLegend={groupLegend}
                    chartHeight={fsChartH}
                  />
                </div>
              </div>
            </div>
          </ChartWrapper>

          <ChartWrapper
            standalone
            panelTitle="Regresión OLS"
            title="Coeficientes β y ajuste del modelo"
            description="Modelo OLS múltiple calculado en cliente sobre los 32 estados. Coeficientes β estandarizados con intervalos de confianza al 95%. La descarga exporta coeficientes PNG, tabla CSV y ajuste del modelo PNG en un ZIP."
            chartType="Regresión OLS"
            onDownload={regDownloadFn ?? undefined}
            tooltip={
              <InfoTooltip wide text={
                <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--text-2)" }}>
                  <p style={{ fontWeight: 700, margin: "0 0 4px", color: "var(--text-1)" }}>Funcionalidad del panel</p>
                  <p style={{ margin: "0 0 10px" }}>
                    Permite construir un modelo estadístico que estima cuánto y en qué dirección influye un conjunto de variables sobre una variable objetivo, analizando todos los factores al mismo tiempo. A diferencia de la correlación simple, controla el efecto de cada variable mientras mantiene las demás constantes, lo que da una visión más completa de las relaciones entre indicadores.
                  </p>
                  <p style={{ fontWeight: 700, margin: "0 0 4px", color: "var(--text-1)" }}>Limitaciones</p>
                  <p style={{ margin: 0, color: "var(--text-3)" }}>
                    Con solo 32 observaciones (estados), el modelo puede sobreajustarse si se incluyen demasiadas variables. Interpretar los resultados como asociación estadística, no como causalidad.
                  </p>
                </div>
              } />
            }
          >
            <MultivariateRegressionPlot
              stateCards={effectiveStateCards}
              metricOptions={metricOptions}
              defaultDependentVar={xVarId}
              onDownloadFn={(fn) => setRegDownloadFn(fn !== null ? () => fn : null)}
            />
          </ChartWrapper>
        </>
      )}
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

function corrLabel(r: number): string {
  const str = corrStrength(r);
  return r > 0 ? `${str} y directa` : `${str} e inversa`;
}

function dirInterpretation(r: number, label: string, yLabel: string): string {
  return r > 0
    ? `Los estados con mayor ${label} tienden a presentar también mayor ${yLabel}, lo que apunta a que ambos indicadores se mueven en la misma dirección.`
    : `Los estados con mayor ${label} tienden a presentar menor ${yLabel}, evidenciando que ambos indicadores se mueven en sentidos opuestos.`;
}

const TRANSITIONS = ["En contraparte,", "Asimismo,", "Por su parte,", "Finalmente,"];
const DETAIL_THRESHOLD = 4; // por debajo de este número se describe cada variable individualmente

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
  const significant = sorted.filter((c) => c.pValue < 0.05);
  const nonSignificant = sorted.filter((c) => c.pValue >= 0.05);
  const minR = (1.96 / Math.sqrt(n - 2 + 1.96 ** 2 / n)).toFixed(2);
  const manyVars = corrRows.length > DETAIL_THRESHOLD;

  const S = { lineHeight: 1.7, color: "#334155", margin: "0 0 10px" } as const;
  const Slist = { lineHeight: 1.6, color: "#334155", margin: "0 0 6px", fontSize: 13 } as const;

  const sigPhrase = significant.length === 0
    ? "Ninguna alcanza una asociación estadísticamente clara con los datos disponibles."
    : significant.length === corrRows.length
    ? `Las ${corrRows.length} alcanzan asociación estadísticamente clara (p < 0.05).`
    : `De ellas, ${significant.length} ${significant.length === 1 ? "alcanza" : "alcanzan"} asociación estadísticamente clara (p < 0.05).`;

  return (
    <div>
      {/* Apertura */}
      <p style={S}>
        Analizando el comportamiento de los <strong>{n} estados</strong>, se estudió la relación
        entre <strong>{corrRows.length} variable{corrRows.length !== 1 ? "s" : ""}</strong> y{" "}
        <strong>{yLabel}</strong>. {sigPhrase}
      </p>

      {/* Modo compacto (> DETAIL_THRESHOLD variables): listas agrupadas por significancia */}
      {manyVars ? (
        <>
          {significant.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <p style={{ ...S, margin: "0 0 6px", fontWeight: 600 }}>
                Con asociación estadísticamente clara (p &lt; 0.05):
              </p>
              {significant.map((c) => (
                <p key={c.label} style={Slist}>
                  <strong>{c.label}</strong> — correlación {corrLabel(c.r)} (r&nbsp;=&nbsp;{c.r.toFixed(2)}).{" "}
                  {dirInterpretation(c.r, c.label, yLabel)}
                </p>
              ))}
            </div>
          )}
          {nonSignificant.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <p style={{ ...S, margin: "0 0 6px", fontWeight: 600 }}>
                Sin significancia estadística (|r| &lt; {minR} con {n} estados):
              </p>
              <p style={Slist}>
                {nonSignificant.map((c, i) => (
                  <span key={c.label}>
                    {i > 0 && ", "}
                    <strong>{c.label}</strong> (r&nbsp;=&nbsp;{c.r.toFixed(2)})
                  </span>
                ))}.{" "}
                Los patrones son indicativos pero no concluyentes con el tamaño de muestra disponible.
              </p>
            </div>
          )}
        </>
      ) : (
        /* Modo detallado (≤ DETAIL_THRESHOLD variables): párrafo por variable */
        sorted.map((c, i) => {
          const isSig = c.pValue < 0.05;
          const isWeak = Math.abs(c.r) < 0.35;
          const transition = i === 0 ? null : TRANSITIONS[i - 1] ?? "Además,";
          return (
            <p key={c.label} style={S}>
              {transition && <>{transition} </>}
              <strong>{c.label}</strong> muestra una correlación {corrLabel(c.r)} (r&nbsp;=&nbsp;{c.r.toFixed(2)}
              {isSig ? ", p < 0.05" : null}).{" "}
              {isSig
                ? dirInterpretation(c.r, c.label, yLabel)
                : isWeak
                ? `La asociación no supera el umbral de significancia para muestras de este tamaño (se requiere |r| > ${minR} con ${n} estados). Conviene revisar el diagrama de dispersión para verificar que no haya estados atípicos distorsionando el coeficiente.`
                : `El patrón es indicativo pero no alcanza significancia estadística con n = ${n} estados.`
              }
            </p>
          );
        })
      )}

      <p style={{ lineHeight: 1.55, color: "var(--text-3)", fontSize: 12, margin: 0 }}>
        Correlación no implica causalidad: una asociación alta puede reflejar un factor subyacente
        común, como el nivel general de desarrollo del estado.
      </p>
    </div>
  );
}
