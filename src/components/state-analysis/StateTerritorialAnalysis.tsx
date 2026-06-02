import { useEffect, useMemo, useState } from "react";
import type { MunicipioAnalyticsRecord, StateAnalyticsPayload } from "../../types/analytics";
import { lorenzCurve, weightedGini } from "../../utils/gini";
import { spearmanSafe } from "../../utils/spearman";
import { giniPercentileAmongStates, strengthLabel } from "../../utils/stateAnalytics";
import { useAppContext } from "../../context/AppContext";
import EmptyState from "../EmptyState";
import TabNarrative from "../feedback/TabNarrative";
import LorenzCurveChart from "./LorenzCurveChart";
import MunicipioScatterExplore from "./MunicipioScatterExplore";
import MunicipiosTable from "./MunicipiosTable";
import MunicipioRfDiagnostico from "./MunicipioRfDiagnostico";
import {
  TERRITORIAL_VARIABLES,
  CONTEXTUAL_METRICS,
  VAR_ID_TO_SCATTER_KEY,
} from "./analysisMetrics";
import type { TerritorialVarKey } from "./analysisMetrics";

export type { AnalysisMetricKey } from "./analysisMetrics";
export { ANALYSIS_METRICS } from "./analysisMetrics";

type Props = {
  stateAnalytics: StateAnalyticsPayload | null;
  municipios: MunicipioAnalyticsRecord[];
  activeVariableIds?: string[];
};

function getMunValue(m: MunicipioAnalyticsRecord, key: string): number {
  const v = (m as Record<string, unknown>)[key];
  return typeof v === "number" && isFinite(v) ? v : NaN;
}

export default function StateTerritorialAnalysis({ stateAnalytics, municipios, activeVariableIds = [] }: Props) {
  const { state: appState } = useAppContext();
  const { primaryState } = appState;

  // ── variable selector ────────────────────────────────────────────────────
  const [selectedVarKey, setSelectedVarKey] = useState<TerritorialVarKey>("pob_pct_4g_garantizada");

  useEffect(() => {
    const firstMatch = activeVariableIds
      .map((id) => VAR_ID_TO_SCATTER_KEY[id])
      .find((key) => key && TERRITORIAL_VARIABLES.some((v) => v.key === key));
    if (firstMatch) setSelectedVarKey(firstMatch as TerritorialVarKey);
  }, [activeVariableIds]);

  const selectedVar = TERRITORIAL_VARIABLES.find((v) => v.key === selectedVarKey) ?? TERRITORIAL_VARIABLES[0];

  // ── state lookup ─────────────────────────────────────────────────────────
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

  // ── available variables (≥5 finite non-null values in this state) ────────
  const availableVars = useMemo(
    () =>
      TERRITORIAL_VARIABLES.filter((v) => {
        const n = municipiosEstado.filter((m) => isFinite(getMunValue(m, v.key))).length;
        return n >= 5;
      }),
    [municipiosEstado]
  );

  // ── values & weights ─────────────────────────────────────────────────────
  const selectedValues = useMemo(
    () => municipiosEstado.map((m) => getMunValue(m, selectedVar.key)),
    [municipiosEstado, selectedVar.key]
  );

  const weights = useMemo(() => {
    if (selectedVar.weight === "localidades_n") {
      return municipiosEstado.map((m) => (m.localidades_n != null && m.localidades_n > 0 ? m.localidades_n : 1));
    }
    return municipiosEstado.map((m) => (m.pobtot_iter > 0 ? m.pobtot_iter : 1));
  }, [municipiosEstado, selectedVar.weight]);

  // ── lorenz / gini (shift to ≥0 if needed) ───────────────────────────────
  const lorenzInput = useMemo(() => {
    const finiteVals = selectedValues.filter((v) => isFinite(v));
    if (finiteVals.length === 0) return { values: selectedValues, shifted: false };
    const rawMin = Math.min(...finiteVals);
    if (rawMin < 0) {
      return { values: selectedValues.map((v) => (isFinite(v) ? v - rawMin : 0)), shifted: true };
    }
    return { values: selectedValues, shifted: false };
  }, [selectedValues]);

  const giniClient = useMemo(() => weightedGini(lorenzInput.values, weights), [lorenzInput.values, weights]);
  const lorenz = useMemo(() => lorenzCurve(lorenzInput.values, weights), [lorenzInput.values, weights]);

  // ── spearman vector: selected var vs each contextual (excluding itself) ──
  const contextualCorrelations = useMemo(() => {
    return CONTEXTUAL_METRICS.filter((c) => c.key !== selectedVar.key).map((c) => {
      const xj = municipiosEstado.map((m) => getMunValue(m, c.key));
      const pi: number[] = [], pj: number[] = [];
      for (let k = 0; k < selectedValues.length; k++) {
        if (isFinite(selectedValues[k]) && isFinite(xj[k])) {
          pi.push(selectedValues[k]);
          pj.push(xj[k]);
        }
      }
      return { label: c.label, rho: spearmanSafe(pi, pj) ?? NaN, n: pi.length };
    });
  }, [municipiosEstado, selectedValues, selectedVar.key]);

  // ── national reference (only for 4G) ────────────────────────────────────
  const nationalGiniRef =
    selectedVar.key === "pob_pct_4g_garantizada"
      ? (stateAnalytics?.national.gini_pob_pct_4g ?? undefined)
      : undefined;

  const percentileRank =
    selectedVar.key === "pob_pct_4g_garantizada" && stateAnalytics && stateRow && cveEnt
      ? giniPercentileAmongStates(stateAnalytics.states, cveEnt)
      : null;

  // ── guards ───────────────────────────────────────────────────────────────
  if (!stateAnalytics || municipios.length === 0) {
    return (
      <EmptyState
        title="Analítica territorial no disponible"
        description="Ejecuta npm run data:build:analytics y verifica que state_analytics_dashboard.json exista."
      />
    );
  }

  if (!cveEnt || !stateRow) {
    return (
      <EmptyState
        title="Estado sin datos municipales"
        description="El estado seleccionado no tiene registros de analítica municipal."
      />
    );
  }

  const hasRf = (stateRow.rf_feature_importances?.length ?? 0) > 0;

  return (
    <div className="tab-content">
      {/* ── Variable selector ── */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
        {availableVars.map((v) => {
          const isActive = activeVariableIds.some((id) => VAR_ID_TO_SCATTER_KEY[id] === v.key);
          const isSelected = v.key === selectedVarKey;
          return (
            <button
              key={v.key}
              onClick={() => setSelectedVarKey(v.key)}
              style={{
                padding: "5px 12px",
                borderRadius: 6,
                border: isSelected
                  ? "2px solid var(--accent, #2563eb)"
                  : "1px solid var(--border, #e2e8f0)",
                background: isSelected
                  ? "var(--accent, #2563eb)"
                  : isActive
                  ? "var(--accent-soft, #eff6ff)"
                  : "white",
                color: isSelected ? "white" : "var(--text-1, #0f172a)",
                fontSize: 12,
                fontWeight: isSelected ? 600 : 400,
                cursor: "pointer",
              }}
            >
              {isActive && !isSelected ? "★ " : ""}
              {v.label}
            </button>
          );
        })}
      </div>

      <TabNarrative
        title={`Análisis territorial — ${selectedVar.label}`}
        description={`Desigualdad intraestatal de ${selectedVar.label.toLowerCase()} entre municipios de ${primaryState ?? "este estado"}.`}
      >
        <TerritorialNarrative
          stateName={stateRow.estado}
          varLabel={selectedVar.label}
          varUnit={selectedVar.unit}
          nMunicipios={municipiosEstado.length}
          giniClient={giniClient}
          nationalGiniRef={nationalGiniRef}
          percentileRank={percentileRank}
          contextualCorrelations={contextualCorrelations}
          lorenzShifted={lorenzInput.shifted}
        />
      </TabNarrative>

      <div className="two-col">
        <section className="panel">
          <p className="panel-title">
            Curva de Lorenz — {selectedVar.label}
            {lorenzInput.shifted && (
              <span style={{ fontSize: 10, color: "var(--text-3)", marginLeft: 6 }}>
                (valores desplazados a ≥0)
              </span>
            )}
          </p>
          <LorenzCurveChart
            title=""
            description={`Distribución de ${selectedVar.label.toLowerCase()} ponderada por ${
              selectedVar.weight === "localidades_n" ? "número de localidades" : "población"
            }.`}
            points={lorenz}
            gini={giniClient}
            nationalGini={nationalGiniRef}
          />
        </section>
        <section className="panel">
          <p className="panel-title">Correlaciones contextuales (Spearman)</p>
          <SpearmanVector
            varLabel={selectedVar.label}
            correlations={contextualCorrelations}
            nMunicipios={municipiosEstado.length}
          />
        </section>
      </div>

      <section className="panel">
        <p className="panel-title">Explorador de dispersión municipal</p>
        <MunicipioScatterExplore municipios={municipiosEstado} activeVariableIds={activeVariableIds} />
      </section>

      <section className="panel">
        <p className="panel-title">Tabla de municipios</p>
        <MunicipiosTable municipios={municipiosEstado} />
      </section>

      {hasRf && (
        <section className="panel">
          <p className="panel-title">Diagnóstico por Random Forest (cobertura 4G)</p>
          <MunicipioRfDiagnostico
            municipios={municipiosEstado}
            featureImportances={stateRow.rf_feature_importances ?? []}
          />
        </section>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SpearmanVector({
  varLabel,
  correlations,
  nMunicipios,
}: {
  varLabel: string;
  correlations: { label: string; rho: number; n: number }[];
  nMunicipios: number;
}) {
  return (
    <div>
      <p style={{ fontSize: 11, color: "var(--text-3, #94a3b8)", marginBottom: 14, marginTop: 0 }}>
        Correlación de <strong>{varLabel}</strong> con variables contextuales · {nMunicipios} municipios
      </p>
      {correlations.map(({ label, rho }) => {
        const ok = isFinite(rho);
        const abs = ok ? Math.abs(rho) : 0;
        const color = !ok ? "#94a3b8" : rho > 0.4 ? "#16a34a" : rho < -0.4 ? "#dc2626" : "#64748b";
        return (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 12, width: 160, flexShrink: 0, color: "var(--text-2, #475569)" }}>
              {label}
            </span>
            <div style={{ flex: 1, height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: `${abs * 100}%`, height: "100%", background: color, borderRadius: 4 }} />
            </div>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color,
                width: 44,
                textAlign: "right",
                fontVariantNumeric: "tabular-nums",
                flexShrink: 0,
              }}
            >
              {ok ? `${rho >= 0 ? "+" : ""}${rho.toFixed(2)}` : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function TerritorialNarrative({
  stateName,
  varLabel,
  varUnit,
  nMunicipios,
  giniClient,
  nationalGiniRef,
  percentileRank,
  contextualCorrelations,
  lorenzShifted,
}: {
  stateName: string;
  varLabel: string;
  varUnit: string;
  nMunicipios: number;
  giniClient: number;
  nationalGiniRef: number | undefined;
  percentileRank: number | null;
  contextualCorrelations: { label: string; rho: number; n: number }[];
  lorenzShifted: boolean;
}) {
  const S = { lineHeight: 1.65, color: "#334155", margin: "0 0 8px" } as const;

  const strongest = contextualCorrelations
    .filter((c) => isFinite(c.rho))
    .sort((a, b) => Math.abs(b.rho) - Math.abs(a.rho))[0];

  return (
    <div>
      <p style={S}>
        En <strong>{stateName}</strong> se analizan <strong>{nMunicipios}</strong> municipios
        para <strong>{varLabel}</strong>
        {varUnit ? ` (${varUnit})` : ""}.{" "}
        Coeficiente de Gini: <strong>{isFinite(giniClient) ? giniClient.toFixed(3) : "—"}</strong>
        {nationalGiniRef != null && ` · referencia nacional: ${nationalGiniRef.toFixed(3)}`}.
        {percentileRank != null && (
          <>{" "}Percentil {percentileRank} en desigualdad intraestatal entre los 32 estados.</>
        )}
        {lorenzShifted && (
          <>{" "}Los valores negativos fueron desplazados a ≥0 para el cálculo de Lorenz.</>
        )}
      </p>
      {strongest && Math.abs(strongest.rho) > 0.1 && (
        <p style={S}>
          Correlación más fuerte con variables contextuales: <strong>{strongest.label}</strong>{" "}
          (ρ = {strongest.rho >= 0 ? "+" : ""}
          {strongest.rho.toFixed(2)}, {strengthLabel(strongest.rho)}).
        </p>
      )}
    </div>
  );
}
