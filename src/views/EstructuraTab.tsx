import { useMemo, useState } from "react";
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
import type { AppData, PcaRecord, PcaResults } from "../services/DataService";
import EmptyState from "../components/EmptyState";
import RankingTable from "../components/charts/RankingTable";
import TabNarrative from "../components/feedback/TabNarrative";
import type { RankingEntry } from "../types/dataStandard";

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
            offset: 12,
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
}: {
  record: PcaRecord;
  pcaResults: PcaResults;
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
  const peerSample = peers.slice(0, 3).join(", ") + (peers.length > 3 ? "…" : "");

  const S = { lineHeight: 1.65, color: "#334155", margin: "0 0 8px" } as const;

  return (
    <div>
      <p style={S}>
        <strong>{record.state}</strong> ocupa el lugar{" "}
        <strong>
          {record.ranking} de {nStates}
        </strong>{" "}
        en el índice Digital-Territorial ({tier} nacional), con un puntaje de{" "}
        <strong>{record.index.toFixed(1)}/100</strong>.
      </p>
      {clusterStat && (
        <p style={S}>
          Pertenece al grupo <strong>{clusterStat.label}</strong>
          {peers.length > 0 && (
            <>
              , junto con <strong>{peers.length}</strong> estado
              {peers.length !== 1 ? "s" : ""} de perfil similar
              {peerSample ? ` (${peerSample})` : ""}
            </>
          )}
          . El índice promedio del grupo es{" "}
          <strong>{clusterStat.mean_index.toFixed(1)}</strong>.
        </p>
      )}
      {record.is_outlier && (
        <p style={{ ...S, margin: 0 }}>
          El estado muestra un perfil estructural <strong>atípico</strong> respecto al
          resto (distancia de Mahalanobis fuera del umbral χ² p=0.95), lo que sugiere
          una combinación inusual de fortalezas y rezagos en el espacio de componentes.
        </p>
      )}
    </div>
  );
}

// ── Tab principal ─────────────────────────────────────────────────────────────

type Props = { appData: AppData };

export default function EstructuraTab({ appData }: Props) {
  const { state: appState } = useAppContext();
  const { primaryState } = appState;
  const { pcaResults } = appData;

  const [rankingView, setRankingView] = useState<"table" | "lollipop">("lollipop");

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

  if (!pcaResults) {
    return (
      <EmptyState
        title="Análisis de estructura no disponible"
        description="Ejecuta scripts/analytics/pca.py para generar pca_results.json."
      />
    );
  }

  return (
    <div className="tab-content">
      <TabNarrative
        title="Estructura latente digital-territorial"
        description="Posición del estado en el espacio de componentes principales: índice compuesto, grupo estructural y perfil comparativo entre los 32 estados."
      >
        {primaryRecord ? (
          <EstructuraNarrative record={primaryRecord} pcaResults={pcaResults} />
        ) : (
          <p>Selecciona un estado en el panel lateral para ver su perfil estructural.</p>
        )}
      </TabNarrative>

      {primaryRecord && (
        <div className="kpi-grid-v2">
          <PcaStatCard
            label="Índice Digital-Territorial"
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

      <section className="panel">
        <p className="panel-title" style={{ marginBottom: 4 }}>PC1 vs PC2</p>
        <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--text-3)" }}>
          Cada punto es un estado, coloreado por grupo. El punto azul es{" "}
          {primaryState ?? "el estado seleccionado"}.
        </p>
        <PcaScatterChart
          data={scatterData}
          primaryState={primaryState}
          varExplained={pcaResults.variance_explained}
        />
      </section>

      <section className="panel ranking-panel">
        <div className="ranking-panel-header">
          <p className="panel-title" style={{ margin: 0 }}>Ranking por índice</p>
          <div className="toggle-pill ranking-panel__toggle" role="group">
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
        </div>
        <RankingTable
          rows={rankingRows}
          highlightState={primaryState ?? undefined}
          metricLabel="Índice Digital-Territorial"
          unit="/100"
          view={rankingView}
        />
      </section>
    </div>
  );
}
