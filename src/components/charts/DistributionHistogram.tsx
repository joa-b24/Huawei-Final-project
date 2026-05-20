import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { HistogramData } from "../../types/dataStandard";

type Props = {
  histogram: HistogramData;
  highlightValue?: number | null;
  nationalMean?: number | null;
  label?: string;
  binStates?: string[][];
  highlightState?: string | null;
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
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 8, padding: "8px 12px", fontSize: 12, maxWidth: 240,
    }}>
      <p style={{ margin: "0 0 2px", fontWeight: 700, color: "var(--text-1)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Intervalo: {range}
      </p>
      <p style={{ margin: "0 0 6px", color: "var(--text-3)", fontSize: 11 }}>
        {d.count} estado{d.count !== 1 ? "s" : ""}
      </p>
      {sorted.length > 0 && (
        <p style={{ margin: 0, color: "var(--text-2)", lineHeight: 1.65, fontSize: 12 }}>
          {sorted.map((s, i) => (
            <span key={s}>
              {i > 0 && <span style={{ color: "var(--border)", margin: "0 2px" }}>·</span>}
              {s === selected
                ? <strong style={{ color: "var(--blue)" }}>{s}</strong>
                : s}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

export default function DistributionHistogram({ histogram, highlightValue, nationalMean, label, binStates, highlightState }: Props) {
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
      <ResponsiveContainer width="100%" height={220}>
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
