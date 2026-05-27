import { useMemo, useState } from "react";
import type { MunicipioAnalyticsRecord, StateAnalyticsPayload } from "../../types/analytics";
import { lorenzCurve, weightedGini } from "../../utils/gini";
import { spearmanSafe } from "../../utils/spearman";
import {
  formatSpearman,
  giniPercentileAmongStates,
  strengthLabel
} from "../../utils/stateAnalytics";
import { ANALYSIS_METRICS } from "./analysisMetrics";
import EmptyState from "../EmptyState";
import LorenzCurveChart from "./LorenzCurveChart";
import MunicipioScatterExplore from "./MunicipioScatterExplore";
import SpearmanHeatmap from "./SpearmanHeatmap";

const DEFAULT_CVE_ENT = "19";

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
  const [cveEnt, setCveEnt] = useState(DEFAULT_CVE_ENT);

  const stateRow = useMemo(
    () => stateAnalytics?.states.find((s) => s.cve_ent === cveEnt) ?? null,
    [stateAnalytics, cveEnt]
  );

  const municipiosEstado = useMemo(
    () => municipios.filter((m) => m.cve_ent === cveEnt),
    [municipios, cveEnt]
  );

  const weights = useMemo(
    () => municipiosEstado.map((m) => m.pobtot_iter),
    [municipiosEstado]
  );
  const values4g = useMemo(
    () => municipiosEstado.map((m) => m.pob_pct_4g_garantizada),
    [municipiosEstado]
  );

  const giniClient = useMemo(() => weightedGini(values4g, weights), [values4g, weights]);
  const lorenz = useMemo(() => lorenzCurve(values4g, weights), [values4g, weights]);

  const spearmanMatrix = useMemo(() => {
    const keys = ANALYSIS_METRICS.map((x) => x.key);
    const cols: (number | null)[][] = [];
    for (let i = 0; i < keys.length; i++) {
      const row: (number | null)[] = [];
      for (let j = 0; j < keys.length; j++) {
        if (i === j) {
          row.push(1);
        } else {
          const xi = municipiosEstado.map((m) => getMetric(m, keys[i])).map((v) => v ?? Number.NaN);
          const xj = municipiosEstado.map((m) => getMetric(m, keys[j])).map((v) => v ?? Number.NaN);
          const pairedI: number[] = [];
          const pairedJ: number[] = [];
          for (let k = 0; k < xi.length; k++) {
            if (Number.isFinite(xi[k]) && Number.isFinite(xj[k])) {
              pairedI.push(xi[k]);
              pairedJ.push(xj[k]);
            }
          }
          row.push(spearmanSafe(pairedI, pairedJ));
        }
      }
      cols.push(row);
    }
    return cols;
  }, [municipiosEstado]);

  const percentileRank =
    stateAnalytics && stateRow ? giniPercentileAmongStates(stateAnalytics.states, cveEnt) : null;

  if (!stateAnalytics || municipios.length === 0) {
    return (
      <EmptyState
        title="Analítica territorial no disponible"
        description="Ejecuta npm run data:build:analytics y asegúrate de que public/data/municipios_master_analytics.json y state_analytics_dashboard.json existan."
      />
    );
  }

  return (
    <section className="dashboard-block">
      <div className="dashboard-block-header">
        <div className="section-heading">
          <h2>Análisis territorial por estado</h2>
          <p>
            Tres lecturas complementarias: desigualdad de cobertura (Gini y Lorenz), agrupamiento municipal
            en tres perfiles (alta, media y baja cobertura 4G dentro del estado) y asociaciones con
            escolaridad, edad y composición por sexo (Spearman y dispersión).
          </p>
          <p style={{ marginTop: 8, fontSize: "0.88rem", color: "#475569" }}>
            <strong>Tip:</strong> junto a cada gráfico o tabla verás el texto <em>«Ayuda: …»</em> y un botón circular con
            la letra <strong>i</strong>: pulsa el botón para ver la explicación técnica (dinámica según el estado y las variables).
          </p>
        </div>
        <div className="metric-control">
          <label htmlFor="state-territorial-select">Estado</label>
          <select
            id="state-territorial-select"
            value={cveEnt}
            onChange={(e) => setCveEnt(e.target.value)}
          >
            {[...stateAnalytics.states]
              .sort((a, b) => a.estado.localeCompare(b.estado, "es"))
              .map((s) => (
                <option key={s.cve_ent} value={s.cve_ent}>
                  {s.estado} ({s.n_municipios} municipios)
                </option>
              ))}
          </select>
        </div>
      </div>

      {stateRow ? (
        <div className="panel panel-nested" style={{ marginBottom: 16 }}>
          <StateNarrative
            stateRow={stateRow}
            national={stateAnalytics.national}
            giniClient={giniClient}
            spearmanMatrix={spearmanMatrix}
            percentileRank={percentileRank}
            nMunicipiosFiltrados={municipiosEstado.length}
          />
        </div>
      ) : null}

      <div className="grid-layout" style={{ marginBottom: 16 }}>
        <div className="panel panel-nested">
          <LorenzCurveChart
            title="Curva de Lorenz — cobertura 4G poblacional"
            description="Eje X: población acumulada (municipios ordenados de menor a mayor cobertura). Eje Y: cobertura 4G acumulada. Mayor separación respecto a la diagonal implica mayor desigualdad territorial."
            points={lorenz}
            gini={giniClient}
            nationalGini={stateAnalytics.national.gini_pob_pct_4g}
          />
        </div>
        <div className="panel panel-nested">
          <SpearmanHeatmap
            labels={ANALYSIS_METRICS.map((m) => m.label)}
            matrix={spearmanMatrix}
            nMunicipios={municipiosEstado.length}
          />
        </div>
      </div>

      <div className="panel panel-nested">
        <MunicipioScatterExplore municipios={municipiosEstado} />
      </div>
    </section>
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

  const pRankText =
    percentileRank !== null
      ? ` En desigualdad interna de cobertura 4G (Gini entre municipios), el percentil ${percentileRank} compara esta entidad con las demás: valores altos indican más dispersión relativa que la mayoría de los estados; valores bajos, más equidad relativa.`
      : "";

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

  return (
    <div>
      <h3 style={{ marginTop: 0, fontSize: "1.05rem" }}>Resumen estadístico del estado</h3>
      <p style={{ lineHeight: 1.65, color: "#334155" }}>
        En <strong>{stateRow.estado}</strong> se modelan <strong>{nMunicipiosFiltrados}</strong> municipios
        con población censal y cobertura 4G por localidades ({national.connectivity_year}). El coeficiente de
        Gini es <strong>{g.toFixed(3)}</strong> ({gVsNational}; nacional <strong>{natGini.toFixed(3)}</strong>,
        delta {gDelta >= 0 ? "+" : ""}
        {gDelta.toFixed(3)}).{pRankText}
      </p>
      <p style={{ lineHeight: 1.65, color: "#334155" }}>
        La correlación de Spearman entre escolaridad promedio y cobertura 4G es{" "}
        <strong>{formatSpearman(spE)}</strong>
        {Number.isFinite(spE)
          ? ` (${strengthLabel(spE)} y ${spearmanDirection})`
          : ""}
        . Para contexto, con % de mujeres es <strong>{formatSpearman(spM ?? null)}</strong>; con % de
        población de 65 años y más es{" "}
        <strong>{formatSpearman(sp65 ?? null)}</strong>; con % de 0 a 14 años:{" "}
        <strong>{formatSpearman(sp014 ?? null)}</strong>.
      </p>
      <p style={{ fontSize: "0.85rem", color: "#64748b" }}>
        Gini y Spearman se calculan con los mismos municipios y definiciones que la curva de Lorenz y la matriz
        de abajo (población ponderada en Gini; pares con datos válidos en Spearman).
      </p>
    </div>
  );
}
