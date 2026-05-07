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
import MunicipiosTable from "./MunicipiosTable";
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
          <h2>Análisis por estado (municipios + Gini + Spearman)</h2>
          <p>
            Compara la desigualdad de la cobertura 4G poblacional entre municipios y las asociaciones de
            rango (Spearman) con escolaridad, estructura por edades y composición por sexo. Cobertura:
            localidades 2024 (IFT/INEGI); demografía y sexo: Censo 2020 (ITER).
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
            percentileRank={percentileRank}
            nMunicipiosFiltrados={municipiosEstado.length}
          />
        </div>
      ) : null}

      <div className="grid-layout" style={{ marginBottom: 16 }}>
        <div className="panel panel-nested">
          <LorenzCurveChart
            title="Curva de Lorenz — cobertura 4G poblacional"
            description={`Municipios del estado ordenados por cobertura; población acumulada vs cobertura acumulada ponderada. Gini (cliente) ≈ ${Number.isFinite(giniClient) ? giniClient.toFixed(4) : "—"}; en JSON estatal: ${stateRow ? stateRow.gini_pob_pct_4g.toFixed(4) : "—"}.`}
            points={lorenz}
          />
        </div>
        <div className="panel panel-nested">
          <SpearmanHeatmap labels={ANALYSIS_METRICS.map((m) => m.label)} matrix={spearmanMatrix} />
        </div>
      </div>

      <div className="panel panel-nested" style={{ marginBottom: 16 }}>
        <MunicipioScatterExplore municipios={municipiosEstado} />
      </div>

      <div className="panel panel-nested">
        <MunicipiosTable municipios={municipiosEstado} />
      </div>
    </section>
  );
}

function StateNarrative({
  stateRow,
  national,
  giniClient,
  percentileRank,
  nMunicipiosFiltrados
}: {
  stateRow: import("../../types/analytics").StateAnalyticsRow;
  national: import("../../types/analytics").StateAnalyticsNational;
  giniClient: number;
  percentileRank: number | null;
  nMunicipiosFiltrados: number;
}) {
  const g = stateRow.gini_pob_pct_4g;
  const spE = stateRow.spearman_graproes_vs_pob_4g;
  const spM = stateRow.spearman_pct_mujeres_vs_pob_4g;
  const sp65 = stateRow.spearman_pct_pob_65_mas_vs_pob_4g;
  const sp014 = stateRow.spearman_pct_pob_0_14_vs_pob_4g;

  const pRankText =
    percentileRank !== null
      ? ` En desigualdad interna de cobertura 4G (Gini entre municipios), el percentil ${percentileRank} compara esta entidad con las demás: valores altos indican más dispersión relativa que la mayoría de los estados; valores bajos, más equidad relativa.`
      : "";

  const natGini = national.gini_pob_pct_4g;

  return (
    <div>
      <h3 style={{ marginTop: 0, fontSize: "1.05rem" }}>Lectura automática</h3>
      <p style={{ lineHeight: 1.65, color: "#334155" }}>
        En <strong>{stateRow.estado}</strong> se modelan <strong>{nMunicipiosFiltrados}</strong> municipios
        con población censal y cobertura 4G por localidades ({national.connectivity_year}). El coeficiente de
        Gini de la cobertura 4G poblacional entre municipios es <strong>{g.toFixed(4)}</strong> (referencia
        nacional <strong>{natGini.toFixed(4)}</strong>). Un Gini más bajo indica reparto más parejo de la
        cobertura entre municipios ponderado por población.{pRankText}
      </p>
      <p style={{ lineHeight: 1.65, color: "#334155" }}>
        Correlación de Spearman (asociación monótona, no causal) entre escolaridad promedio y cobertura 4G
        poblacional: <strong>{formatSpearman(spE)}</strong>
        {Number.isFinite(spE)
          ? ` (asociación ${strengthLabel(spE)} ${spE < 0 ? "negativa" : "positiva"})`
          : ""}
        . Respecto al porcentaje de mujeres:{" "}
        <strong>{formatSpearman(spM ?? null)}</strong>. Con % de población de 65 años y más:{" "}
        <strong>{formatSpearman(sp65 ?? null)}</strong>; con % de 0 a 14 años:{" "}
        <strong>{formatSpearman(sp014 ?? null)}</strong>.
      </p>
      <p style={{ fontSize: "0.85rem", color: "#64748b" }}>
        Gini recalculado en el navegador ({Number.isFinite(giniClient) ? giniClient.toFixed(4) : "—"}) debe
        coincidir con el del JSON; diferencias mínimas pueden deberse a redondeo.
      </p>
    </div>
  );
}
