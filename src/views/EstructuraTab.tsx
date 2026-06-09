import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAppContext } from "../context/AppContext";
import type { AppData, PcaManifest, PcaRecord, PcaResults } from "../services/DataService";
import EmptyState from "../components/EmptyState";
import RankingTable from "../components/charts/RankingTable";
import ChoroplethMap from "../components/charts/ChoroplethMap";
import ChartWrapper from "../components/charts/ChartWrapper";
import TabNarrative from "../components/feedback/TabNarrative";
import InfoTooltip from "../components/feedback/InfoTooltip";
import { humanizeVarId } from "../utils/humanize";
import type { RankingEntry } from "../types/dataStandard";
import PcaWizard from "../components/estructura/PcaWizard";

const CLUSTER_COLORS = ["#0d3d73", "#2E7D32", "#F57F17", "#B71C1C", "#6A1B9A"];
const clusterColor = (id: number) => CLUSTER_COLORS[id % CLUSTER_COLORS.length];

// ── KPI card simple ───────────────────────────────────────────────────────────

function PcaStatCard({
  label,
  primary,
  secondary,
  highlight = false,
  warn = false,
}: {
  label: string;
  primary: string;
  secondary?: string;
  highlight?: boolean;
  warn?: boolean;
}) {
  return (
    <article className={`kpi-card-v2${warn ? " is-outlier" : ""}`}>
      <p className="kpi-card-v2__label">{label}</p>
      <p
        className="kpi-card-v2__value"
        style={highlight ? { color: "var(--blue)" } : undefined}
      >
        {primary}
      </p>
      {secondary && (
        <p className="kpi-card-v2__delta" style={{ color: "var(--text-3)" }}>
          {secondary}
        </p>
      )}
      {warn && (
        <p className="kpi-card-v2__outlier" role="status">
          ⚠ Perfil atípico
        </p>
      )}
    </article>
  );
}

// ── Scatter PC1 vs PC2 ────────────────────────────────────────────────────────

type ScatterDot = {
  x: number;
  y: number;
  state: string;
  cluster: number;
  index: number;
  is_outlier: boolean;
};

function ScatterTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d: ScatterDot = payload[0]?.payload;
  if (!d) return null;
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "10px 14px",
        fontSize: 12,
        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        minWidth: 160,
      }}
    >
      <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: 13, color: "var(--text-1)" }}>
        {d.state}
      </p>
      <p style={{ margin: "0 0 2px", color: "var(--text-2)" }}>
        Índice: <strong>{d.index.toFixed(1)}</strong>
      </p>
      <p style={{ margin: 0, color: "var(--text-3)", fontSize: 11 }}>
        PC1: {d.x.toFixed(3)} · PC2: {d.y.toFixed(3)}
        {d.is_outlier && " · ⚠ atípico"}
      </p>
    </div>
  );
}

function PcaScatterChart({
  data,
  primaryState,
  varExplained,
}: {
  data: ScatterDot[];
  primaryState: string | null;
  varExplained: [number, number];
}) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <ScatterChart margin={{ top: 8, right: 16, bottom: 24, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="x"
          type="number"
          name="PC1"
          tick={{ fontSize: 11, fill: "var(--text-3)" }}
          tickLine={false}
          axisLine={false}
          label={{
            value: `PC1 (${(varExplained[0] * 100).toFixed(1)} %)`,
            position: "insideBottom",
            offset: -12,
            fontSize: 11,
            fill: "var(--text-3)",
          }}
        />
        <YAxis
          dataKey="y"
          type="number"
          name="PC2"
          tick={{ fontSize: 11, fill: "var(--text-3)" }}
          tickLine={false}
          axisLine={false}
          width={40}
          label={{
            value: `PC2 (${(varExplained[1] * 100).toFixed(1)} %)`,
            angle: -90,
            position: "insideLeft",
            offset: 4,
            fontSize: 11,
            fill: "var(--text-3)",
          }}
        />
        <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: "3 3" }} />
        <Scatter
          data={data}
          isAnimationActive={false}
          shape={(props: any) => {
            const d: ScatterDot = props;
            const isPrimary = d.state === primaryState;
            return (
              <circle
                cx={props.cx}
                cy={props.cy}
                r={isPrimary ? 8 : 5}
                fill={isPrimary ? "var(--blue)" : clusterColor(d.cluster)}
                stroke={isPrimary ? "var(--surface)" : "none"}
                strokeWidth={isPrimary ? 2 : 0}
                opacity={isPrimary ? 1 : 0.8}
              />
            );
          }}
        >
          {data.map((d, i) => (
            <Cell
              key={i}
              fill={d.state === primaryState ? "var(--blue)" : clusterColor(d.cluster)}
            />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}

// ── Narrativa automática ──────────────────────────────────────────────────────

function EstructuraNarrative({
  record,
  pcaResults,
  indexName,
}: {
  record: PcaRecord;
  pcaResults: PcaResults;
  indexName: string;
}) {
  const nStates = pcaResults.records.length;
  const tier =
    record.ranking <= Math.ceil(nStates / 3)
      ? "tercio superior"
      : record.ranking <= Math.ceil((2 * nStates) / 3)
      ? "tercio medio"
      : "tercio inferior";

  const clusterStat = pcaResults.cluster_stats[String(record.cluster)];
  const peers = clusterStat?.states.filter((s) => s !== record.state) ?? [];
  const peerSample = peers.slice(0, 3).join(", ") + (peers.length > 3 ? " y otros" : "");

  const [v1, v2] = pcaResults.variance_explained;
  const v1pct = (v1 * 100).toFixed(0);
  const v2pct = (v2 * 100).toFixed(0);

  const pc1Dir = record.pc1 >= 0 ? "por encima" : "por debajo";
  const pc2Dir = record.pc2 >= 0 ? "por encima" : "por debajo";

  const indexVsGroup = clusterStat
    ? record.index - clusterStat.mean_index
    : null;

  const S = { lineHeight: 1.65, color: "#334155", margin: "0 0 8px" } as const;

  return (
    <div>
      <p style={S}>
        <strong>{record.state}</strong> ocupa el lugar{" "}
        <strong>{record.ranking} de {nStates}</strong> en el {indexName}
        ({tier} nacional), con una puntuación de <strong>{record.index.toFixed(1)}/100</strong>.
        {indexVsGroup !== null && (
          <> Esto es <strong>{indexVsGroup >= 0 ? "+" : ""}{indexVsGroup.toFixed(1)} puntos</strong>{" "}
          {indexVsGroup >= 0 ? "por encima" : "por debajo"} del promedio de su grupo estructural.</>
        )}
      </p>

      {clusterStat && (
        <p style={S}>
          Forma parte del grupo <strong>"{clusterStat.label}"</strong>
          {peers.length > 0 ? (
            <>, que agrupa a <strong>{peers.length + 1}</strong> estados con perfil latente similar
            {peerSample ? ` — entre ellos ${peerSample}` : ""}</>
          ) : (
            <>, el único estado con este perfil estructural</>
          )}. El índice promedio del grupo es <strong>{clusterStat.mean_index.toFixed(1)}</strong>.
        </p>
      )}

      <p style={S}>
        En el espacio de componentes principales, el estado se ubica{" "}
        <strong>{pc1Dir} del centro</strong> en PC1 (el eje que concentra el{" "}
        <strong>{v1pct}&nbsp;%</strong> de la variación entre estados) y{" "}
        <strong>{pc2Dir} del centro</strong> en PC2 (<strong>{v2pct}&nbsp;%</strong> de varianza).
        Juntos, ambos ejes resumen{" "}
        <strong>{(Number(v1pct) + Number(v2pct)).toFixed(0)}&nbsp;%</strong> de la información multivariada.
      </p>

      {record.is_outlier && (
        <p style={{ ...S, margin: 0, padding: "8px 12px", background: "color-mix(in srgb, var(--amber) 10%, transparent)", borderRadius: 6, borderLeft: "3px solid var(--amber)" }}>
          <strong>Perfil atípico:</strong> la distancia de Mahalanobis de este estado supera el umbral
          esperado (χ² p&nbsp;=&nbsp;0.95), lo que indica una combinación <em>inusual</em> de fortalezas
          y rezagos que no encaja completamente con ningún grupo.
        </p>
      )}
    </div>
  );
}

// ── Nota metodológica (colapsable) ────────────────────────────────────────────

function MethodologyNote({
  pcaResults,
  varCatalog,
  indexName,
}: {
  pcaResults: PcaResults;
  varCatalog: { id: string; label: string }[];
  indexName: string;
}) {
  const [open, setOpen] = useState(false);

  const varLabels = useMemo(
    () => pcaResults.loadings.variables.map((id) => varCatalog.find((v) => v.id === id)?.label ?? humanizeVarId(id)),
    [pcaResults.loadings.variables, varCatalog]
  );

  const [v1, v2] = pcaResults.variance_explained;
  const nClusters = Object.keys(pcaResults.cluster_stats).length;
  const nStates = pcaResults.records.length;
  const clusterList = Object.values(pcaResults.cluster_stats).sort(
    (a, b) => b.mean_index - a.mean_index
  );

  const S = { lineHeight: 1.65, color: "#334155", margin: "0 0 8px", fontSize: 13 } as const;
  const Sh = { ...S, fontWeight: 600, color: "var(--text-1)", margin: "12px 0 4px" } as const;

  return (
    <div style={{ marginBottom: 16 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "none",
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: "6px 12px",
          fontSize: 12,
          color: "var(--text-2)",
          cursor: "pointer",
          width: "100%",
          textAlign: "left",
        }}
      >
        <span style={{ fontSize: 10 }}>{open ? "▲" : "▼"}</span>
        Nota metodológica — cómo se calculó este análisis
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-3)" }}>
          {open ? "Ocultar" : "Mostrar"}
        </span>
      </button>
      {open && (
        <div style={{ marginTop: 8, padding: "12px 14px", background: "color-mix(in srgb, var(--blue) 5%, transparent)", borderRadius: 6, borderLeft: "3px solid var(--blue-mid)" }}>
          <p style={{ ...S, fontWeight: 700, color: "var(--text-1)", margin: "0 0 10px", fontSize: 14 }}>
            ¿Cómo se calculó este análisis?
          </p>

          <p style={Sh}>Reducción de dimensiones (PCA)</p>
          <p style={S}>
            El análisis parte de {nStates} estados y {varLabels.length} indicadores de conectividad,
            adopción digital y contexto socioeconómico. El <strong>Análisis de Componentes Principales</strong>{" "}
            reduce esa información a unos pocos "ejes" sin perder lo esencial: encuentra combinaciones
            lineales que capturan la mayor variación posible entre estados. Todos los indicadores se
            normalizan primero para tener el mismo peso independientemente de su unidad.
          </p>

          <p style={Sh}>Variables incluidas ({varLabels.length})</p>
          <ul style={{ margin: "0 0 8px", paddingLeft: 18, columns: 2, lineHeight: 1.8, color: "#334155", fontSize: 12 }}>
            {varLabels.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>

          <p style={Sh}>PC1 — eje principal ({(v1 * 100).toFixed(1)} % de la varianza total)</p>
          <p style={S}>
            El primer componente concentra el <strong>{(v1 * 100).toFixed(1)} %</strong> de toda la
            diferencia entre estados. El <strong>{indexName} (0–100)</strong> es la proyección
            sobre PC1, reescalada para que el mayor valor sea 100.
          </p>

          <p style={Sh}>PC2 — contraste secundario ({(v2 * 100).toFixed(1)} % de la varianza total)</p>
          <p style={S}>
            Captura <em>diferencias dentro de un mismo nivel</em> de desarrollo digital. Juntos,
            PC1 + PC2 explican el <strong>{((v1 + v2) * 100).toFixed(0)} %</strong> de la variación
            entre los {nStates} estados.
          </p>

          <p style={Sh}>Grupos estructurales (K-Means, {nClusters} clusters)</p>
          <ul style={{ margin: "0 0 8px", paddingLeft: 18, lineHeight: S.lineHeight, color: S.color, fontSize: S.fontSize }}>
            {clusterList.map((c) => (
              <li key={c.label} style={{ marginBottom: 4 }}>
                <strong>{c.label}</strong> — {c.states.length} estados, índice promedio {c.mean_index.toFixed(1)}/100
              </li>
            ))}
          </ul>
          <p style={{ ...S, margin: 0, fontSize: 12, color: "var(--text-3)", borderTop: "1px solid var(--border)", paddingTop: 8 }}>
            Los estados marcados como <strong>atípicos</strong> tienen una{" "}
            <em>distancia de Mahalanobis</em> inusualmente alta respecto al centroide de su grupo.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Cargas PC1 ────────────────────────────────────────────────────────────────

function LoadingsPanel({
  pcaResults,
  varCatalog,
}: {
  pcaResults: PcaResults;
  varCatalog: { id: string; label: string }[];
}) {
  const sorted = useMemo(() => {
    return pcaResults.loadings.variables
      .map((id, i) => ({
        label: varCatalog.find((v) => v.id === id)?.label ?? humanizeVarId(id),
        pc1: pcaResults.loadings.pc1[i] ?? 0,
      }))
      .sort((a, b) => Math.abs(b.pc1) - Math.abs(a.pc1));
  }, [pcaResults.loadings, varCatalog]);

  const maxAbs = useMemo(() => Math.max(...sorted.map((r) => Math.abs(r.pc1))), [sorted]);

  return (
    <ChartWrapper
      panelTitle="Cargas PC1"
      title="Influencia de variables en PC1"
      description="Ordenado por influencia absoluta. Azul = positivo con el índice · Rojo = inverso."
      tooltip={
        <InfoTooltip
          wide
          text={
            <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--text-2)" }}>
              <p style={{ fontWeight: 700, margin: "0 0 4px", color: "var(--text-1)" }}>Qué son las cargas (loadings)</p>
              <p style={{ margin: "0 0 8px" }}>
                La <strong>carga PC1</strong> de una variable indica cuánto contribuye al primer componente
                principal. Valores absolutos mayores = más influyente en el índice.
              </p>
              <p style={{ fontWeight: 700, margin: "0 0 4px", color: "var(--text-1)" }}>Signo</p>
              <p style={{ margin: 0 }}>
                <strong style={{ color: "#2563eb" }}>Positivo</strong> → la variable sube con el índice
                (mayor cobertura, mayor acceso). <strong style={{ color: "#dc2626" }}>Negativo</strong> → va
                en sentido contrario (p. ej. rezago social sube cuando el índice baja).
              </p>
            </div>
          }
        />
      }
      standalone
    >
      <div style={{ maxHeight: 360, overflowY: "auto", paddingRight: 4 }}>
        {sorted.map(({ label, pc1 }) => {
          const pct = maxAbs > 0 ? (Math.abs(pc1) / maxAbs) * 100 : 0;
          const color = pc1 >= 0 ? "#2563eb" : "#dc2626";
          return (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span
                style={{
                  fontSize: 11,
                  width: 200,
                  flexShrink: 0,
                  color: "var(--text-2)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={label}
              >
                {label}
              </span>
              <div style={{ flex: 1, height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3 }} />
              </div>
              <span
                style={{
                  fontSize: 11,
                  width: 52,
                  textAlign: "right",
                  color,
                  fontVariantNumeric: "tabular-nums",
                  flexShrink: 0,
                }}
              >
                {pc1 >= 0 ? "+" : ""}{pc1.toFixed(3)}
              </span>
            </div>
          );
        })}
      </div>
    </ChartWrapper>
  );
}

// ── Estados del mismo grupo ───────────────────────────────────────────────────

function PeersSection({
  primaryRecord,
  pcaResults,
}: {
  primaryRecord: PcaRecord;
  pcaResults: PcaResults;
}) {
  const clusterStat = pcaResults.cluster_stats[String(primaryRecord.cluster)];
  const peers = useMemo(
    () =>
      pcaResults.records
        .filter((r) => r.cluster === primaryRecord.cluster)
        .sort((a, b) => b.index - a.index),
    [pcaResults.records, primaryRecord.cluster]
  );

  const nationalMean = useMemo(
    () => pcaResults.records.reduce((s, r) => s + r.index, 0) / pcaResults.records.length,
    [pcaResults.records]
  );

  const groupLabel = clusterStat?.label ?? `Grupo ${primaryRecord.cluster}`;

  return (
    <ChartWrapper
      panelTitle="Grupo estructural"
      title={groupLabel}
      description={`${peers.length} estado${peers.length !== 1 ? "s" : ""} · media del grupo: ${clusterStat?.mean_index.toFixed(1) ?? "—"}`}
      standalone
      tooltip={
        <InfoTooltip wide text={
          <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--text-2)" }}>
            <p style={{ fontWeight: 700, margin: "0 0 6px", color: "var(--text-1)", fontSize: 13 }}>
              Desempeño Interno del Cluster
            </p>
            <p style={{ margin: "0 0 8px" }}>
              Muestra la jerarquía de las entidades que integran el grupo seleccionado según el <em>análisis activo</em>. La columna de rendimiento evalúa la posición de cada estado frente al índice compuesto.
            </p>
            <p style={{ margin: "0 0 4px" }}>
              • <strong>Índice:</strong> Puntuación estandarizada del estado en una escala relativa.
            </p>
            <p style={{ margin: "0 0 8px" }}>
              • <strong>VS Media Nacional:</strong> La brecha en puntos porcentuales respecto al promedio de todo el país. Los valores en <strong style={{ color: "var(--green)" }}>verde</strong> indican mejor desempeño. Mientras que los valores en <strong style={{ color: "var(--red)" }}>rojo</strong> muestran rezago frente al promedio nacional.
            </p>
          </div>
        } />
      }
    >
      <table className="ranking-table" style={{ marginTop: 4, width: "100%" }}>
        <thead>
          <tr>
            <th style={{ width: 32 }}>#</th>
            <th>Estado</th>
            <th>Índice</th>
            <th>vs media nacional</th>
          </tr>
        </thead>
        <tbody>
          {peers.map((r, i) => {
            const diff = r.index - nationalMean;
            const isPrimary = r.state === primaryRecord.state;
            return (
              <tr
                key={r.state}
                style={
                  isPrimary
                    ? { fontWeight: 700, background: "var(--accent-soft, #eff6ff)" }
                    : undefined
                }
              >
                <td style={{ color: "var(--text-3)" }}>{i + 1}</td>
                <td style={{ color: isPrimary ? "var(--blue)" : undefined }}>
                  {r.state}
                  {isPrimary && <span style={{ fontSize: 10, marginLeft: 4 }}>●</span>}
                </td>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>{r.index.toFixed(1)}</td>
                <td
                  style={{
                    color: diff >= 0 ? "var(--green)" : "var(--red)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {diff >= 0 ? "+" : ""}{diff.toFixed(1)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </ChartWrapper>
  );
}

// ── Tab principal ─────────────────────────────────────────────────────────────

type Props = { appData: AppData };

export default function EstructuraTab({ appData }: Props) {
  const { state: appState } = useAppContext();
  const { primaryState } = appState;

  // ── Estado local: análisis activo y wizard ────────────────────────────────
  const [manifest, setManifest] = useState<PcaManifest | null>(appData.pcaManifest);
  const [activePca, setActivePca] = useState<PcaResults | null>(appData.pcaResults);
  const [loadingPca, setLoadingPca] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  const pcaResults = activePca;
  const indexName = pcaResults?.index_name ?? "Índice PCA";
  const analysisName = pcaResults?.analysis_name ?? "Análisis";

  // Cambiar análisis activo
  const switchAnalysis = useCallback(async (id: string) => {
    setLoadingPca(true);
    try {
      const res = await fetch(`/data/outputs/pca/${id}/pca_results.json`);
      if (res.ok) {
        const data: PcaResults = await res.json();
        setActivePca(data);
        // Actualizar manifest.active localmente (sin guardar en disco)
        setManifest((prev) => prev ? { ...prev, active: id } : prev);
      }
    } finally {
      setLoadingPca(false);
    }
  }, []);

  const varCatalog = useMemo(
    () => appData.dataset.metricCatalog.map((m) => ({
      id: m.id,
      label: m.label && m.label !== m.id ? m.label : humanizeVarId(m.id),
    })),
    [appData.dataset.metricCatalog]
  );

  // Variables disponibles para el wizard (tienen datos completos = están en univariateStats)
  const availableVars = useMemo(
    () => Object.keys(appData.univariateStats),
    [appData.univariateStats]
  );

  const varLabelsMap = useMemo(() => {
    const m: Record<string, string> = {};
    varCatalog.forEach((v) => { m[v.id] = v.label; });
    return m;
  }, [varCatalog]);

  const primaryRecord = useMemo(
    () => pcaResults?.records.find((r) => r.state === primaryState) ?? null,
    [pcaResults, primaryState]
  );

  const rankingRows = useMemo<RankingEntry[]>(() => {
    if (!pcaResults) return [];
    const mean =
      pcaResults.records.reduce((s, r) => s + r.index, 0) / pcaResults.records.length;
    return pcaResults.records
      .map((r) => ({
        rank: r.ranking,
        state: r.state,
        estado: r.state,
        value: r.index,
        pct_vs_mean: mean > 0 ? ((r.index - mean) / mean) * 100 : 0,
      }))
      .sort((a, b) => a.rank - b.rank);
  }, [pcaResults]);

  const scatterData = useMemo<ScatterDot[]>(
    () =>
      pcaResults?.records.map((r) => ({
        x: r.pc1,
        y: r.pc2,
        state: r.state,
        cluster: r.cluster,
        index: r.index,
        is_outlier: r.is_outlier,
      })) ?? [],
    [pcaResults]
  );

  const clusterColorOverrides = useMemo(() => {
    if (!pcaResults) return undefined;
    const map = new Map<string, string>();
    pcaResults.records.forEach((r) => map.set(r.state, clusterColor(r.cluster)));
    return map;
  }, [pcaResults]);

  const clusterLabelOverrides = useMemo(() => {
    if (!pcaResults) return undefined;
    const map = new Map<string, string>();
    pcaResults.records.forEach((r) => {
      const label = pcaResults.cluster_stats[String(r.cluster)]?.label ?? `Cluster ${r.cluster}`;
      map.set(r.state, label);
    });
    return map;
  }, [pcaResults]);

  const clusterLegend = useMemo(() => {
    if (!pcaResults) return [];
    return Object.entries(pcaResults.cluster_stats)
      .map(([id, stat]) => ({ id: Number(id), label: stat.label, color: clusterColor(Number(id)) }))
      .sort((a, b) => a.id - b.id);
  }, [pcaResults]);

  if (!pcaResults && !manifest) {
    return (
      <EmptyState
        title="Análisis de estructura no disponible"
        description="Ejecuta scripts/analytics/pca.py para generar los archivos en public/data/outputs/pca/."
      />
    );
  }

  return (
    <div className="tab-content">
      {/* ── Selector de análisis ── */}
      {manifest && manifest.analyses.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-3)", flexShrink: 0 }}>
            Análisis activo
          </span>
          <select
            value={manifest.active}
            onChange={(e) => switchAnalysis(e.target.value)}
            disabled={loadingPca}
            className="comparison-select comparison-select--sm"
            style={{ flex: 1, minWidth: 200, maxWidth: 420 }}
          >
            {manifest.analyses.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          {loadingPca && (
            <span style={{ fontSize: 11, color: "var(--text-3)" }}>Cargando…</span>
          )}
          {import.meta.env.DEV && (
            <button
              type="button"
              onClick={() => setShowWizard(true)}
              className="btn-ghost"
              style={{ fontSize: 12, padding: "5px 12px" }}
            >
              + Nuevo análisis
            </button>
          )}
        </div>
      )}

      {/* ── Wizard (solo DEV) ── */}
      {showWizard && manifest && import.meta.env.DEV && (
        <PcaWizard
          availableVariables={availableVars}
          varLabels={varLabelsMap}
          manifest={manifest}
          onClose={() => setShowWizard(false)}
          onDone={(newManifest, newResults) => {
            setManifest(newManifest);
            setActivePca(newResults);
            setShowWizard(false);
          }}
        />
      )}

      {pcaResults && (
        <>
          <TabNarrative
            title={analysisName}
            description="Grupos estructurales e índice compuesto derivados de análisis multivariado sobre los 32 estados."
          >
            <MethodologyNote pcaResults={pcaResults} varCatalog={varCatalog} indexName={indexName} />
            {primaryRecord ? (
              <EstructuraNarrative record={primaryRecord} pcaResults={pcaResults} indexName={indexName} />
            ) : (
              <p>Selecciona un estado en el panel lateral para ver su perfil estructural.</p>
            )}
          </TabNarrative>

          {/* ── KPI grid ── */}
          {primaryRecord && (
            <div className="kpi-grid-v2">
              <PcaStatCard
                label={indexName}
                primary={`${primaryRecord.index.toFixed(1)} / 100`}
                highlight
              />
              <PcaStatCard
                label="Posición nacional"
                primary={`#${primaryRecord.ranking}`}
                secondary={`de ${pcaResults.records.length} estados`}
              />
              <PcaStatCard
                label="Grupo estructural"
                primary={primaryRecord.cluster_label}
              />
              <PcaStatCard
                label="Perfil atípico"
                primary={primaryRecord.is_outlier ? "Sí" : "No"}
                warn={primaryRecord.is_outlier}
              />
            </div>
          )}

          {/* ── Mapa | Estados del mismo cluster (70 / 30) ── */}
          <div style={{ display: "grid", gridTemplateColumns: "7fr 3fr", gap: 16, alignItems: "start" }}>
            <ChoroplethMap
              appData={appData}
              varId=""
              stateColorOverrides={clusterColorOverrides}
              stateLabelOverrides={clusterLabelOverrides}
              panelTitle="Mapa de grupos"
              title="Distribución geográfica por grupo"
              description="Cada estado coloreado según su grupo k-means. Clic en un estado para seleccionarlo."
              legend={clusterLegend.map((c) => ({ color: c.color, label: c.label }))}
              standalone
              tooltip={
                <InfoTooltip wide text={
                  <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--text-2)" }}>
                    <p style={{ fontWeight: 700, margin: "0 0 6px", color: "var(--text-1)", fontSize: 13 }}>
                      Análisis de Conglomerados (Clustering)
                    </p>
                    <p style={{ margin: "0 0 8px" }}>
                      Los estados se agrupan mediante el algoritmo estadístico <strong>K-Means</strong> basado en el <em>análisis activo</em>. Este método identifica entidades con características similares, con base en las variables seleccionadas para el análisis (puedes revisar la nota metodológica en la narrativa) para segmentar el país sin sesgos intuitivos.
                    </p>
                    <p style={{ margin: 0, fontSize: 11, color: "var(--text-3)" }}>
                      <strong>Utilidad:</strong> Permite diseñar políticas públicas regionales o estrategias de mercado diferenciadas, reconociendo que estados de distintas geografías pueden compartir los mismos retos estructurales.
                    </p>
                  </div>
                } />
              }
            />

            {primaryRecord ? (
              <PeersSection primaryRecord={primaryRecord} pcaResults={pcaResults} />
            ) : (
              <div className="panel" style={{ padding: 24, color: "var(--text-3)", fontSize: 13 }}>
                Selecciona un estado para ver su grupo estructural.
              </div>
            )}
          </div>

          {/* ── Ranking por índice ── */}
          <RankingTable
            rows={rankingRows}
            highlightState={primaryState ?? undefined}
            metricLabel={indexName}
            unit="/100"
            initialView="lollipop"
            standalone
            tooltip={
              <InfoTooltip wide text={
                <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--text-2)" }}>
                  <p style={{ fontWeight: 700, margin: "0 0 4px", color: "var(--text-1)" }}>{indexName}</p>
                  <p style={{ margin: 0 }}>
                    Puntuación compuesta (0–100) calculada como proyección sobre PC1, reescalada para que
                    el mayor valor sea 100.
                  </p>
                </div>
              } />
            }
          />

          {/* ── Cargas PC1 | Posición estructural (50 / 50) ── */}
          <div className="two-col" style={{ alignItems: "stretch" }}>
            <LoadingsPanel pcaResults={pcaResults} varCatalog={varCatalog} />

            <ChartWrapper
              panelTitle="Posición estructural"
              title={`PC1 vs PC2 — ${analysisName}`}
              description={`Cada punto es un estado, coloreado por grupo. El punto azul es ${primaryState ?? "el estado seleccionado"}.`}
              tooltip={
                <InfoTooltip wide text={
                  <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--text-2)" }}>
                    <p style={{ fontWeight: 700, margin: "0 0 4px", color: "var(--text-1)" }}>Cómo leer este gráfico</p>
                    <p style={{ margin: "0 0 10px" }}>
                      Cada <strong>punto</strong> es un estado en el espacio de componentes principales.
                      Estados <strong>cercanos entre sí</strong> tienen perfiles multivariados similares.
                    </p>
                    <p style={{ fontWeight: 700, margin: "0 0 4px", color: "var(--text-1)" }}>Grupos y atípicos</p>
                    <p style={{ margin: 0 }}>
                      El <strong>color</strong> indica el grupo k-means. El <strong style={{ color: "#2563eb" }}>punto azul</strong> es el estado seleccionado.
                    </p>
                  </div>
                } />
              }
              legend={clusterLegend.map((c) => ({ color: c.color, label: c.label }))}
              standalone
            >
              <PcaScatterChart
                data={scatterData}
                primaryState={primaryState}
                varExplained={pcaResults.variance_explained}
              />
            </ChartWrapper>
          </div>
        </>
      )}
    </div>
  );
}
