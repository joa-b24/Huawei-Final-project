import { useMemo } from "react";
import type { MunicipioAnalyticsRecord, StateAnalyticsPayload } from "../../types/analytics";
import { lorenzCurve, weightedGini } from "../../utils/gini";
import { spearmanSafe } from "../../utils/spearman";
import {
  formatSpearman,
  giniPercentileAmongStates,
  strengthLabel
} from "../../utils/stateAnalytics";
import { useAppContext } from "../../context/AppContext";
import EmptyState from "../EmptyState";
import TabNarrative from "../feedback/TabNarrative";
import LorenzCurveChart from "./LorenzCurveChart";
import MunicipioScatterExplore from "./MunicipioScatterExplore";
import SpearmanHeatmap from "./SpearmanHeatmap";
import { ANALYSIS_METRICS } from "./analysisMetrics";

export type { AnalysisMetricKey } from "./analysisMetrics";
export { ANALYSIS_METRICS };

function getMetric(m: MunicipioAnalyticsRecord, k: import("./analysisMetrics").AnalysisMetricKey): number | undefined {
  const v = m[k];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

type Props = {
  stateAnalytics: StateAnalyticsPayload | null;
  municipios: MunicipioAnalyticsRecord[];
};

export default function StateTerritorialAnalysis({ stateAnalytics, municipios }: Props) {
  const { state: appState } = useAppContext();
  const { primaryState } = appState;

  const cveEnt = useMemo(() => {
    if (!stateAnalytics || !primaryState) return null;
    return stateAnalytics.states.find((s) => s.estado === primaryState)?.cve_ent ?? null;
  }, [stateAnalytics, primaryState]);

  const stateRow = useMemo(
    () => (stateAnalytics && cveEnt ? stateAnalytics.states.find((s) => s.cve_ent === cveEnt) ?? null : null),
    [stateAnalytics, cveEnt]
  );

  const municipiosEstado = useMemo(
    () => (cveEnt ? municipios.filter((m) => m.cve_ent === cveEnt) : []),
    [municipios, cveEnt]
  );

  const weights = useMemo(() => municipiosEstado.map((m) => m.pobtot_iter), [municipiosEstado]);
  const values4g = useMemo(
    () => municipiosEstado.map((m) => m.pob_pct_4g_garantizada),
    [municipiosEstado]
  );

  const giniClient = useMemo(() => weightedGini(values4g, weights), [values4g, weights]);
  const lorenz = useMemo(() => lorenzCurve(values4g, weights), [values4g, weights]);

  const spearmanMatrix = useMemo(() => {
    const keys = ANALYSIS_METRICS.map((x) => x.key);
    return keys.map((ki) =>
      keys.map((kj) => {
        if (ki === kj) return 1;
        const xi = municipiosEstado.map((m) => getMetric(m, ki) ?? Number.NaN);
        const xj = municipiosEstado.map((m) => getMetric(m, kj) ?? Number.NaN);
        const pi: number[] = [];
        const pj: number[] = [];
        for (let k = 0; k < xi.length; k++) {
          if (Number.isFinite(xi[k]) && Number.isFinite(xj[k])) {
            pi.push(xi[k]);
            pj.push(xj[k]);
          }
        }
        return spearmanSafe(pi, pj);
      })
    );
  }, [municipiosEstado]);

  const percentileRank =
    stateAnalytics && stateRow && cveEnt
      ? giniPercentileAmongStates(stateAnalytics.states, cveEnt)
      : null;

  if (!stateAnalytics || municipios.length === 0) {
    return (
      <EmptyState
        title="Analítica territorial no disponible"
        description="Ejecuta npm run data:build:analytics y asegúrate de que public/data/municipios_master_analytics.json y state_analytics_dashboard.json existan."
      />
    );
  }

  if (!primaryState) {
    return (
      <EmptyState
        title="Sin estado seleccionado"
        description="Selecciona un estado en el panel lateral."
      />
    );
  }

  if (!cveEnt || !stateRow) {
    return (
      <EmptyState
        title="Estado sin datos municipales"
        description="El estado seleccionado no tiene registros de analítica municipal. Selecciona otro estado en el panel lateral."
      />
    );
  }

  return (
    <div className="tab-content">
      <TabNarrative
        title={`Análisis territorial — ${stateRow.estado}`}
        description="Desigualdad de cobertura 4G entre municipios (Gini y Lorenz), tres perfiles municipales de cobertura y asociaciones con escolaridad, edad y composición por sexo (Spearman y dispersión)."
      >
        <StateNarrative
          stateRow={stateRow}
          national={stateAnalytics.national}
          giniClient={giniClient}
          spearmanMatrix={spearmanMatrix}
          percentileRank={percentileRank}
          nMunicipiosFiltrados={municipiosEstado.length}
        />
      </TabNarrative>

      <div className="two-col">
        <section className="panel">
          <p className="panel-title">Curva de Lorenz — cobertura 4G</p>
          <LorenzCurveChart
            title=""
            description="Eje X: población acumulada (municipios de menor a mayor cobertura). Eje Y: cobertura 4G acumulada. Mayor separación de la diagonal = mayor desigualdad territorial."
            points={lorenz}
            gini={giniClient}
            nationalGini={stateAnalytics.national.gini_pob_pct_4g}
          />
        </section>
        <section className="panel">
          <p className="panel-title">Correlaciones de rango (Spearman)</p>
          <SpearmanHeatmap
            title=""
            labels={ANALYSIS_METRICS.map((m) => m.label)}
            matrix={spearmanMatrix}
            nMunicipios={municipiosEstado.length}
          />
        </section>
      </div>

      <section className="panel">
        <p className="panel-title">Explorador de dispersión municipal</p>
        <MunicipioScatterExplore municipios={municipiosEstado} />
      </section>
    </div>
  );
}

function spearmanFromMatrix(
  matrix: (number | null)[][],
  keys: import("./analysisMetrics").AnalysisMetricKey[],
  a: import("./analysisMetrics").AnalysisMetricKey,
  b: import("./analysisMetrics").AnalysisMetricKey
): number | null {
  const i = keys.indexOf(a);
  const j = keys.indexOf(b);
  if (i < 0 || j < 0) return null;
  const v = matrix[i][j];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function StateNarrative({
  stateRow,
  national,
  giniClient,
  spearmanMatrix,
  percentileRank,
  nMunicipiosFiltrados
}: {
  stateRow: import("../../types/analytics").StateAnalyticsRow;
  national: import("../../types/analytics").StateAnalyticsNational;
  giniClient: number;
  spearmanMatrix: (number | null)[][];
  percentileRank: number | null;
  nMunicipiosFiltrados: number;
}) {
  const keys = ANALYSIS_METRICS.map((m) => m.key);
  const g = Number.isFinite(giniClient) ? giniClient : stateRow.gini_pob_pct_4g;
  const spE = spearmanFromMatrix(spearmanMatrix, keys, "graproes", "pob_pct_4g_garantizada");
  const spM = spearmanFromMatrix(spearmanMatrix, keys, "pct_mujeres", "pob_pct_4g_garantizada");
  const sp65 = spearmanFromMatrix(spearmanMatrix, keys, "pct_pob_65_mas", "pob_pct_4g_garantizada");
  const sp014 = spearmanFromMatrix(spearmanMatrix, keys, "pct_pob_0_14", "pob_pct_4g_garantizada");

  const natGini = national.gini_pob_pct_4g;
  const gDelta = g - natGini;
  const gVsNational =
    Math.abs(gDelta) < 0.002
      ? "muy similar al promedio nacional"
      : gDelta > 0
        ? "por encima del promedio nacional"
        : "por debajo del promedio nacional";

  const spearmanDirection =
    Number.isFinite(spE) && spE !== 0 ? (spE > 0 ? "positiva" : "negativa") : "nula";

  const S = { lineHeight: 1.65, color: "#334155", margin: "0 0 8px" } as const;

  return (
    <div>
      <p style={S}>
        Se analizan <strong>{nMunicipiosFiltrados}</strong> municipios con población censal y cobertura 4G (
        {national.connectivity_year}). El coeficiente de Gini es <strong>{g.toFixed(3)}</strong> ({gVsNational};
        nacional <strong>{natGini.toFixed(3)}</strong>, delta {gDelta >= 0 ? "+" : ""}
        {gDelta.toFixed(3)}).
        {percentileRank !== null && (
          <>
            {" "}
            En desigualdad interna de cobertura 4G, el percentil <strong>{percentileRank}</strong> entre estados
            indica{" "}
            {percentileRank >= 75
              ? "mayor dispersión relativa que la mayoría"
              : percentileRank <= 25
                ? "mayor equidad relativa que la mayoría"
                : "un nivel cercano a la mediana nacional"}
            .
          </>
        )}
      </p>
      <p style={S}>
        Spearman (escolaridad vs cobertura 4G): <strong>{formatSpearman(spE)}</strong>
        {Number.isFinite(spE) ? ` (${strengthLabel(spE)}, ${spearmanDirection})` : ""}. Contexto: % mujeres{" "}
        <strong>{formatSpearman(spM ?? null)}</strong> · % 65+ <strong>{formatSpearman(sp65 ?? null)}</strong> ·
        % 0–14 <strong>{formatSpearman(sp014 ?? null)}</strong>.
      </p>
      <p style={{ fontSize: "0.85rem", color: "#64748b", margin: 0 }}>
        Gini y Spearman usan los mismos municipios y definiciones que la curva de Lorenz y la matriz de abajo.
      </p>
    </div>
  );
}
