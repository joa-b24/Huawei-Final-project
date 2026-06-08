import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { HistogramData } from "../../types/dataStandard";
import ChartWrapper from "./ChartWrapper";

type GroupLine = { value: number; label: string; color: string };

type Props = {
  histogram: HistogramData;
  highlightValue?: number | null;
  nationalMean?: number | null;
  label?: string;
  panelTitle?: string;
  tooltip?: React.ReactNode;
  footer?: React.ReactNode;
  binStates?: string[][];
  highlightState?: string | null;
  comparisonValue?: number | null;
  comparisonLabel?: string;
  groupLines?: GroupLine[];
};

function BinTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const range = d.hi !== undefined ? `${d.lo.toFixed(2)} – ${d.hi.toFixed(2)}` : d.center.toFixed(2);
  const states: string[] = d.states ?? [];
  const selected: string | null = d.highlightState;
  const sorted = [...states].sort((a, b) => {
    if (a === selected) return -1;
    if (b === selected) return 1;
    return a.localeCompare(b, "es");
  });
  const twoCol = sorted.length > 5;
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 8, padding: "10px 12px", fontSize: 12,
      maxWidth: twoCol ? 300 : 200,
      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    }}>
      <p style={{ margin: "0 0 1px", fontWeight: 700, color: "var(--text-1)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Intervalo: {range}
      </p>
      <p style={{ margin: "0 0 8px", color: "var(--text-3)", fontSize: 11 }}>
        {d.count} estado{d.count !== 1 ? "s" : ""}
      </p>
      {sorted.length > 0 && (
        <div style={twoCol ? { display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 10, rowGap: 1 } : {}}>
          {sorted.map((s) => (
            <span
              key={s}
              style={{
                display: "block",
                fontSize: 11,
                lineHeight: 1.7,
                fontWeight: s === selected ? 700 : 400,
                color: s === selected ? "var(--blue)" : "var(--text-2)",
              }}
            >
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DistributionHistogram({ histogram, highlightValue, nationalMean, label, panelTitle, tooltip, footer, binStates, highlightState, comparisonValue, comparisonLabel, groupLines }: Props) {
  const { bins, counts } = histogram;
  const hasEdges = bins.length > counts.length; // n+1 edges vs n centers

  const data = counts.map((count, i) => {
    const lo = bins[i];
    const hi = hasEdges ? bins[i + 1] : bins[i];
    const center = hasEdges ? (lo + hi) / 2 : lo;
    return { center, count, lo, hi, states: binStates?.[i] ?? [], highlightState: highlightState ?? null };
  });

  const highlightIdx =
    highlightValue !== null && highlightValue !== undefined
      ? data.findIndex((d, i) => {
          if (hasEdges) {
            return highlightValue >= d.lo && (highlightValue < d.hi || i === data.length - 1);
          }
          return (
            i ===
            data.reduce(
              (best, _, j) =>
                Math.abs(data[j].center - highlightValue) < Math.abs(data[best].center - highlightValue)
                  ? j
                  : best,
              0
            )
          );
        })
      : -1;

  return (
    <ChartWrapper
      panelTitle={panelTitle}
      tooltip={tooltip}
      title={label ?? "Distribución"}
      description="Distribución de valores entre los 32 estados de la variable seleccionada."
      chartType="Histograma"
    >
      <div>
      <div className="chart-rc-wrap" style={{ height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="center"
            tickFormatter={(v: number) => v.toFixed(0)}
            tick={{ fontSize: 11, fill: "var(--text-3)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis tick={{ fontSize: 11, fill: "var(--text-3)" }} axisLine={false} tickLine={false} width={28} />
          <Tooltip content={<BinTooltip />} />
          {nationalMean !== null && nationalMean !== undefined && (
            <ReferenceLine
              x={nationalMean}
              stroke="var(--text-3)"
              strokeDasharray="4 4"
            />
          )}
          {comparisonValue != null && (
            <ReferenceLine
              x={comparisonValue}
              stroke="#64748b"
              strokeDasharray="6 3"
              label={{ value: comparisonLabel ?? "Comp.", fontSize: 10, fill: "#64748b", position: "insideTopLeft" }}
            />
          )}
          {groupLines?.map((gl, i) => (
            <ReferenceLine
              key={`gl-${i}`}
              x={gl.value}
              stroke={gl.color}
              strokeDasharray="6 3"
              strokeWidth={2}
            />
          ))}
          <Bar dataKey="count" radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {data.map((_, i) => (
              <Cell
                key={i}
                fill={i === highlightIdx ? "var(--blue)" : "var(--blue-mid)"}
                opacity={i === highlightIdx ? 1 : 0.7}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      </div>
      {footer}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 14px", padding: "8px 28px 2px", fontSize: 10.5, color: "var(--text-3)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ display: "inline-block", width: 18, height: 2, background: "var(--text-3)", borderRadius: 1 }} />
          Bigotes
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ display: "inline-block", width: 14, height: 12, background: "var(--blue-light)", border: "1.5px solid var(--blue-mid)", borderRadius: 1 }} />
          RIC (Q₁–Q₃)
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ display: "inline-block", width: 2.5, height: 14, background: "var(--blue)", borderRadius: 1 }} />
          Mediana
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <svg width="18" height="10" style={{ flexShrink: 0 }}><line x1="0" y1="5" x2="18" y2="5" stroke="var(--text-3)" strokeDasharray="4 2" strokeWidth="1.5" /></svg>
          Media nac.
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "var(--blue)" }} />
          {highlightState ?? "Estado selec."}
        </span>
        {groupLines?.map((gl, i) => (
          <span key={`leg-gl-${i}`} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <svg width="18" height="10" style={{ flexShrink: 0 }}>
              <line x1="0" y1="5" x2="18" y2="5" stroke={gl.color} strokeDasharray="6 3" strokeWidth="2" />
            </svg>
            {gl.label}
          </span>
        ))}
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", border: "2.5px solid var(--amber)", background: "transparent" }} />
          Atípico
        </span>
      </div>
      </div>
    </ChartWrapper>
  );
}
