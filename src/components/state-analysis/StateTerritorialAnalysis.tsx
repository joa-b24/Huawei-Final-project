import { useEffect, useMemo, useState } from "react";
import type { MunicipioAnalyticsRecord, StateAnalyticsPayload } from "../../types/analytics";
import { lorenzCurve, weightedGini } from "../../utils/gini";
import { spearmanSafe } from "../../utils/spearman";
import { giniPercentileAmongStates, strengthLabel } from "../../utils/stateAnalytics";
import { useAppContext } from "../../context/AppContext";
import EmptyState from "../EmptyState";
import TabNarrative from "../feedback/TabNarrative";
import InfoTooltip from "../feedback/InfoTooltip";
import LorenzCurveChart from "./LorenzCurveChart";
import MunicipioScatterExplore from "./MunicipioScatterExplore";
import MunicipioRfDiagnostico from "./MunicipioRfDiagnostico";
import {
  TERRITORIAL_VARIABLES,
  CONTEXTUAL_METRICS,
  VAR_ID_TO_SCATTER_KEY,
} from "./analysisMetrics";
import type { TerritorialVarKey, ScatterMetricKey } from "./analysisMetrics";

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

  const activeTerritorialKeys = useMemo(() => {
    const keys = new Set<TerritorialVarKey>();
    for (const id of activeVariableIds) {
      const key = VAR_ID_TO_SCATTER_KEY[id];
      if (key && TERRITORIAL_VARIABLES.some((v) => v.key === key)) {
        keys.add(key as TerritorialVarKey);
      }
    }
    return keys;
  }, [activeVariableIds]);

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
        if (!activeTerritorialKeys.has(v.key)) return false;
        const n = municipiosEstado.filter((m) => isFinite(getMunValue(m, v.key))).length;
        return n >= 5;
      }),
    [activeTerritorialKeys, municipiosEstado]
  );

  useEffect(() => {
    if (availableVars.length > 0 && !availableVars.some((v) => v.key === selectedVarKey)) {
      setSelectedVarKey(availableVars[0].key);
    }
  }, [availableVars, selectedVarKey]);

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

  if (availableVars.length === 0) {
    return (
      <EmptyState
        title="Sin variables territoriales disponibles"
        description="Activa en el panel lateral una variable con datos municipales disponible para analisis territorial."
      />
    );
  }

  const scatterAllowedKeys = Array.from(
    new Set<ScatterMetricKey>([
      ...availableVars.map((v) => v.key as ScatterMetricKey),
      ...CONTEXTUAL_METRICS.map((v) => v.key as ScatterMetricKey),
    ])
  );

  const hasRf = (stateRow.rf_feature_importances?.length ?? 0) > 0;

  return (
    <div className="tab-content">
      {/* ── Variable selector ── */}
      <div className="var-pill-row">
        {availableVars.map((v) => {
          const isSelected = v.key === selectedVarKey;
          return (
            <button
              key={v.key}
              className={`var-pill-btn${isSelected ? " active" : ""}`}
              onClick={() => setSelectedVarKey(v.key)}
              type="button"
            >
              {v.label}
            </button>
          );
        })}
      </div>

      <TabNarrative
        title={`Análisis territorial - ${selectedVar.label}`}
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

      <div className="two-col territorial-chart-grid">
        {/* Left: Gini + extremos */}
        <LorenzCurveChart
            title={`Desigualdad territorial - ${selectedVar.label}${lorenzInput.shifted ? " (desplazados ≥0)" : ""}`}
            description={`Distribución de ${selectedVar.label.toLowerCase()} ponderada por ${
              selectedVar.weight === "localidades_n" ? "número de localidades" : "población"
            }.`}
            points={lorenz}
            gini={giniClient}
            nationalGini={nationalGiniRef}
            tooltip={
              <InfoTooltip text={
                <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--text-2)" }}>
                  <p style={{ fontWeight: 700, margin: "0 0 4px", color: "var(--text-1)" }}>Curva de Lorenz</p>
                  <p style={{ margin: "0 0 8px" }}>
                    Muestra qué tan desigual es la distribución de {selectedVar.label.toLowerCase()} entre municipios.
                    La línea azul es la distribución real; cuanto más se aleja de la diagonal gris, mayor desigualdad.
                  </p>
                  <p style={{ fontWeight: 700, margin: "0 0 4px", color: "var(--text-1)" }}>Coeficiente de Gini</p>
                  <p style={{ margin: 0 }}>
                    Resumidor numérico: <strong>0</strong> = distribución perfectamente igualitaria entre municipios,{" "}
                    <strong>1</strong> = todo concentrado en un solo municipio.
                  </p>
                </div>
              } />
            }
        />

        {/* Right: Scatter + correlaciones */}
        <MunicipioScatterExplore
            municipios={municipiosEstado}
            fixedYKey={selectedVar.key as ScatterMetricKey}
            allowedMetricKeys={scatterAllowedKeys}
        />
      </div>

      <div className="two-col" style={{ alignItems: "stretch" }}>
        <section className="panel">
          <p className="panel-title">Extremos municipales — {selectedVar.label}</p>
          <ExtremeMunicipioCards
            municipios={municipiosEstado}
            varKey={selectedVar.key}
            varLabel={selectedVar.label}
            varUnit={selectedVar.unit}
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

function ExtremeMunicipioCards({
  municipios,
  varKey,
  varLabel,
  varUnit,
}: {
  municipios: MunicipioAnalyticsRecord[];
  varKey: string;
  varLabel: string;
  varUnit: string;
}) {
  const sorted = useMemo(() => {
    return municipios
      .map((m) => {
        const v = (m as Record<string, unknown>)[varKey];
        const value = typeof v === "number" && isFinite(v) ? v : null;
        return { name: m.nom_mun, value, pop: m.pobtot_iter };
      })
      .filter((m): m is { name: string; value: number; pop: number } => m.value !== null)
      .sort((a, b) => b.value - a.value);
  }, [municipios, varKey]);

  const k = Math.min(3, sorted.length);
  if (k === 0) {
    return <p style={{ color: "var(--text-3)", fontSize: 13, padding: "12px 0" }}>Sin datos para esta variable.</p>;
  }

  const top = sorted.slice(0, k);
  const bottom = sorted.slice(-k).reverse();
  const total = sorted.length;

  const lowerIsBetter = varKey === "brecha_4g_pp" || varKey === "irs_indice";

  const fmt = (v: number) =>
    varUnit === "%" || varUnit === "pp"
      ? `${v.toFixed(1)}${varUnit}`
      : varUnit === "Mbps"
      ? `${v.toFixed(1)} Mbps`
      : v.toLocaleString("es-MX", { maximumFractionDigits: 1 });

  const renderCards = (
    items: { name: string; value: number; pop: number }[],
    isTop: boolean,
    startRank: number
  ) => {
    const isGood = isTop !== lowerIsBetter;
    const bg = isGood
      ? "color-mix(in srgb, #22c55e 8%, transparent)"
      : "color-mix(in srgb, #ef4444 8%, transparent)";
    const border = isGood ? "#bbf7d0" : "#fecaca";
    const valueColor = isGood ? "#16a34a" : "#dc2626";

    return (
      <div style={{ display: "flex", gap: 8 }}>
        {items.map((m, i) => (
          <div
            key={m.name}
            style={{
              flex: 1,
              background: bg,
              border: `1px solid ${border}`,
              borderRadius: 8,
              padding: "10px 12px",
              minWidth: 0,
            }}
          >
            <p style={{ fontSize: 10, color: "var(--text-3)", margin: "0 0 2px" }}>
              #{startRank + i} de {total}
            </p>
            <p
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-1)",
                margin: "0 0 4px",
                lineHeight: 1.3,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={m.name}
            >
              {m.name}
            </p>
            <p style={{ fontSize: 16, fontWeight: 700, color: valueColor, margin: "0 0 2px" }}>
              {fmt(m.value)}
            </p>
            <p style={{ fontSize: 10, color: "var(--text-3)", margin: 0 }}>
              {m.pop.toLocaleString("es-MX")} hab.
            </p>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", margin: "0 0 8px" }}>
          {lowerIsBetter ? `Menor ${varLabel}` : `Mayor ${varLabel}`}
        </p>
        {renderCards(top, true, 1)}
      </div>
      <div>
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", margin: "0 0 8px" }}>
          {lowerIsBetter ? `Mayor ${varLabel}` : `Menor ${varLabel}`}
        </p>
        {renderCards(bottom, false, total - bottom.length + 1)}
      </div>
    </div>
  );
}

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

function giniInterpretLevel(g: number): { label: string; message: string } {
  if (g < 0.1)
    return {
      label: "muy baja",
      message: `La variable está distribuida de forma bastante uniforme entre los municipios - no hay concentración notable.`,
    };
  if (g < 0.25)
    return {
      label: "baja",
      message: `La distribución es relativamente homogénea. La mayor parte de los municipios tiene valores similares.`,
    };
  if (g < 0.35)
    return {
      label: "moderada",
      message: `Existe desigualdad intermunicipal perceptible. Algunos municipios concentran más la variable que el resto, aunque sin llegar a extremos.`,
    };
  if (g < 0.45)
    return {
      label: "alta",
      message: `La distribución es claramente desigual. Municipios con mayor acceso coexisten con zonas de rezago significativo dentro del mismo estado.`,
    };
  return {
    label: "crítica",
    message: `Existe una concentración crítica: la variable se acumula en muy pocos municipios. Esto señala rezago estructural en la mayor parte del territorio estatal y requiere atención diferenciada.`,
  };
}

function giniVsNationalMessage(gini: number, nationalGiniRef: number): string {
  const delta = gini - nationalGiniRef;
  if (Math.abs(delta) < 0.02)
    return `Su nivel de desigualdad intraestatal es similar al promedio del país (Gini nacional: ${nationalGiniRef.toFixed(3)}).`;
  if (delta > 0.08)
    return `Su desigualdad intraestatal es notablemente mayor que el promedio nacional (Gini nacional: ${nationalGiniRef.toFixed(3)}), lo que sugiere una distribución especialmente concentrada.`;
  if (delta > 0.02)
    return `Su nivel de desigualdad intraestatal supera al promedio nacional (Gini nacional: ${nationalGiniRef.toFixed(3)}).`;
  if (delta < -0.08)
    return `Su desigualdad intraestatal es notablemente menor que el promedio nacional (Gini nacional: ${nationalGiniRef.toFixed(3)}), indicando una distribución más equitativa que la norma.`;
  return `Su nivel de desigualdad intraestatal es menor que el promedio nacional (Gini nacional: ${nationalGiniRef.toFixed(3)}).`;
}

function percentileMessage(p: number): string {
  if (p >= 90)
    return `Se ubica entre los estados con mayor desigualdad intraestatal del país (percentil ${p}). La concentración territorial es una problemática central.`;
  if (p >= 75)
    return `Se encuentra en el cuarto más alto de desigualdad intraestatal (percentil ${p}). Hay municipios significativamente rezagados.`;
  if (p >= 50)
    return `Su posición en el ranking de desigualdad es media-alta (percentil ${p}).`;
  if (p >= 25)
    return `Su desigualdad intraestatal está por debajo de la mitad nacional (percentil ${p}).`;
  return `Se encuentra entre los estados con menor desigualdad intraestatal del país (percentil ${p}).`;
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

  const giniValid = isFinite(giniClient);
  const giniInterp = giniValid ? giniInterpretLevel(giniClient) : null;

  return (
    <div>
      <p style={S}>
        En <strong>{stateName}</strong> se analizan <strong>{nMunicipios}</strong> municipios
        para <strong>{varLabel}</strong>{varUnit ? ` (${varUnit})` : ""}.{" "}
        {giniValid ? (
          <>
            El coeficiente de Gini es <strong>{giniClient.toFixed(3)}</strong>, lo que refleja una
            desigualdad intraestatal <strong>{giniInterp!.label}</strong>.{" "}
            {giniInterp!.message}
          </>
        ) : (
          <>No se pudo calcular el coeficiente de Gini para esta variable.</>
        )}
        {lorenzShifted && (
          <>{" "}Los valores negativos fueron desplazados a ≥0 para el cálculo de Lorenz.</>
        )}
      </p>

      {giniValid && nationalGiniRef != null && (
        <p style={S}>
          {giniVsNationalMessage(giniClient, nationalGiniRef)}
          {percentileRank != null && <>{" "}{percentileMessage(percentileRank)}</>}
        </p>
      )}

      {strongest && Math.abs(strongest.rho) > 0.1 && (
        <p style={S}>
          {Math.abs(strongest.rho) >= 0.5
            ? <>La variable contextual con mayor asociación es <strong>{strongest.label}</strong>{" "}
                (ρ = {strongest.rho >= 0 ? "+" : ""}{strongest.rho.toFixed(2)}, correlación {strengthLabel(strongest.rho)}),
                lo que sugiere una relación relevante con la distribución territorial de {varLabel}.
              </>
            : <>La asociación más notable con variables contextuales es <strong>{strongest.label}</strong>{" "}
                (ρ = {strongest.rho >= 0 ? "+" : ""}{strongest.rho.toFixed(2)}, {strengthLabel(strongest.rho)}).
              </>
          }
        </p>
      )}
    </div>
  );
}
