import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { HistogramData } from "../../types/dataStandard";

type Props = {
  histogram: HistogramData;
  highlightValue?: number | null;
  nationalMean?: number | null;
  label?: string;
};

export default function DistributionHistogram({ histogram, highlightValue, nationalMean, label }: Props) {
  const { bins, counts } = histogram;
  const hasEdges = bins.length > counts.length; // n+1 edges vs n centers

  const data = counts.map((count, i) => {
    const lo = bins[i];
    const hi = hasEdges ? bins[i + 1] : bins[i];
    const center = hasEdges ? (lo + hi) / 2 : lo;
    return { center, count, lo, hi };
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
          <Tooltip
            formatter={(count: number, _: string, props: any) => {
              const d = props.payload;
              const range = hasEdges ? `${d.lo.toFixed(1)} – ${d.hi.toFixed(1)}` : d.center.toFixed(1);
              return [count, range];
            }}
          />
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
