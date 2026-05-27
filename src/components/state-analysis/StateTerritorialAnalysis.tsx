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
import MunicipiosTable from "./MunicipiosTable";
import MunicipioRfDiagnostico from "./MunicipioRfDiagnostico";
import SpearmanHeatmap from "./SpearmanHeatmap";
import { ANALYSIS_METRICS } from "./analysisMetrics";

export type { AnalysisMetricKey } from "./analysisMetrics";
export { ANALYSIS_METRICS } from "./analysisMetrics";

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
  const values4g = useMemo(() => municipiosEstado.map((m) => m.pob_pct_4g_garantizada), [municipiosEstado]);

  const giniClient = useMemo(() => weightedGini(values4g, weights), [values4g, weights]);
  const lorenz = useMemo(() => lorenzCurve(values4g, weights), [values4g, weights]);

  const spearmanMatrix = useMemo(() => {
    const keys = ANALYSIS_METRICS.map((x) => x.key);
    return keys.map((ki) =>
      keys.map((kj) => {
        if (ki === kj) return 1;
        const xi = municipiosEstado.map((m) => getMetric(m, ki) ?? NaN);
        const xj = municipiosEstado.map((m) => getMetric(m, kj) ?? NaN);
        const pi: number[] = [], pj: number[] = [];
        for (let k = 0; k < xi.length; k++) {
          if (isFinite(xi[k]) && isFinite(xj[k])) { pi.push(xi[k]); pj.push(xj[k]); }
        }
        return spearmanSafe(pi, pj);
      })
    );
  }, [municipiosEstado]);

  const percentileRank =
    stateAnalytics && stateRow && cveEnt ? giniPercentileAmongStates(stateAnalytics.states, cveEnt) : null;

  if (!stateAnalytics || municipios.length === 0) {
    return (
      <EmptyState
        title="Analítica territorial no disponible"
        description="Ejecuta npm run data:build:analytics y asegúrate de que public/data/municipios_master_analytics.json y state_analytics_dashboard.json existan."
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
        title="Análisis territorial"
        description="Desigualdad de cobertura 4G entre municipios, correlaciones de rango (Spearman) y diagnóstico por Random Forest."
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

      <section className="panel">
        <p className="panel-title">Tabla de municipios</p>
        <MunicipiosTable municipios={municipiosEstado} />
      </section>

      <section className="panel">
        <p className="panel-title">Diagnóstico por Random Forest</p>
        <MunicipioRfDiagnostico
          municipios={municipiosEstado}
          featureImportances={
            stateRow.rf_feature_importances ?? stateAnalytics.national.rf_feature_importances ?? []
          }
        />
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
  const g = stateRow.gini_pob_pct_4g;
  const spE = stateRow.spearman_graproes_vs_pob_4g;
  const spM = stateRow.spearman_pct_mujeres_vs_pob_4g;
  const sp65 = stateRow.spearman_pct_pob_65_mas_vs_pob_4g;
  const sp014 = stateRow.spearman_pct_pob_0_14_vs_pob_4g;

  const natGini = national.gini_pob_pct_4g;
  const gDelta = g - natGini;
  const gVsNational =
    Math.abs(gDelta) < 0.002 ? "muy similar al promedio nacional"
    : gDelta > 0 ? "por encima del promedio nacional"
    : "por debajo del promedio nacional";

  const spearmanDirection =
    Number.isFinite(spE) && spE !== 0 ? (spE > 0 ? "positiva" : "negativa") : "nula";

  const S = { lineHeight: 1.65, color: "#334155", margin: "0 0 8px" } as const;

  return (
    <div>
      <p style={S}>
        En <strong>{stateRow.estado}</strong> se analizan <strong>{nMunicipiosFiltrados}</strong> municipios
        con población censal y cobertura 4G ({national.connectivity_year}). El coeficiente de Gini es{" "}
        <strong>{g.toFixed(3)}</strong> ({gVsNational}; nacional <strong>{natGini.toFixed(3)}</strong>,
        delta {gDelta >= 0 ? "+" : ""}{gDelta.toFixed(3)}).
        {percentileRank !== null && (
          <> El percentil {percentileRank} en desigualdad interna de cobertura 4G entre estados indica{" "}
          {percentileRank >= 75 ? "mayor dispersión relativa que la mayoría de los estados"
           : percentileRank <= 25 ? "mayor equidad relativa que la mayoría de los estados"
           : "un nivel de desigualdad cercano a la mediana nacional"}.</>
        )}
      </p>
      <p style={S}>
        La correlación de Spearman entre escolaridad promedio y cobertura 4G es{" "}
        <strong>{formatSpearman(spE)}</strong>
        {Number.isFinite(spE) ? ` (${strengthLabel(spE)}, ${spearmanDirection})` : ""}.
        Con % de mujeres: <strong>{formatSpearman(spM ?? null)}</strong> ·
        % de 65+ años: <strong>{formatSpearman(sp65 ?? null)}</strong> ·
        % de 0–14 años: <strong>{formatSpearman(sp014 ?? null)}</strong>.
      </p>
      {Number.isFinite(giniClient) && Math.abs(giniClient - g) > 0.001 && (
        <p style={{ fontSize: 11, color: "var(--text-3)", margin: 0, borderTop: "1px solid var(--border)", paddingTop: 6 }}>
          Gini recalculado en navegador: {giniClient.toFixed(3)} · Diferencia mínima por redondeo.
        </p>
      )}
    </div>
  );
}
