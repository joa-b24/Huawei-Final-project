import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { HistogramData } from "../../types/dataStandard";

type GroupLine = { value: number; label: string; color: string };

type Props = {
  histogram: HistogramData;
  highlightValue?: number | null;
  nationalMean?: number | null;
  label?: string;
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

export default function DistributionHistogram({ histogram, highlightValue, nationalMean, label, binStates, highlightState, comparisonValue, comparisonLabel, groupLines }: Props) {
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
    <div>
      <ResponsiveContainer width="100%" height={300}>
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
              label={{ value: "Media", fontSize: 10, fill: "var(--text-3)", position: "insideTopRight" }}
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
              label={{ value: gl.label, fontSize: 10, fill: gl.color, position: i % 2 === 0 ? "insideBottomLeft" : "insideBottomRight" }}
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
      {label && (
        <p style={{ textAlign: "center", fontSize: 11, color: "var(--text-3)", margin: "2px 0 0" }}>{label}</p>
      )}
    </div>
  );
}
