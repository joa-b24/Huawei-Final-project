import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MetricDirection, RankingEntry } from "../../types/dataStandard";
import MissingDataNote from "../feedback/MissingDataNote";

type Props = {
  rows: RankingEntry[];
  highlightState?: string;
  metricLabel: string;
  unit?: string;
  total?: number;
  view?: "table" | "bars";
  direction?: MetricDirection;
};

export default function RankingTable({ rows, highlightState, metricLabel, unit = "", total = 32, view = "table", direction }: Props) {
  const topThird = Math.ceil(total / 3);
  const bottomThird = Math.floor((2 * total) / 3);
  const missing = total - rows.length;

  function rankClass(rank: number) {
    if (rank <= topThird) return "rank-good";
    if (rank > bottomThird) return "rank-poor";
    return "rank-mid";
  }

  function barFill(rank: number, isHighlighted: boolean) {
    if (isHighlighted) return "var(--blue)";
    if (rank <= topThird) return "var(--green)";
    if (rank > bottomThird) return "var(--red)";
    return "var(--amber)";
  }

  const barData = rows.map((row) => ({
    name: row.estado,
    value: row.value,
    rank: row.rank,
    pct: row.pct_vs_mean,
    isHighlighted: highlightState === row.estado,
  }));

  if (view === "bars") {
    return (
      <div>
        <ResponsiveContainer width="100%" height={Math.max(280, rows.length * 14)}>
          <BarChart data={barData} layout="vertical" margin={{ top: 4, right: 48, bottom: 4, left: 4 }}>
            <XAxis type="number" tick={{ fontSize: 10, fill: "var(--text-3)" }} axisLine={false} tickLine={false} />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 10, fill: "var(--text-2)" }}
              axisLine={false}
              tickLine={false}
              width={130}
            />
            <Tooltip
              formatter={(v: number, _: string, props: { payload?: { rank?: number; pct?: number } }) => {
                const rank = props.payload?.rank;
                const pct = props.payload?.pct;
                const unitStr = unit ? ` ${unit}` : "";
                const pctStr = pct !== undefined ? `  (${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% vs media)` : "";
                return [`#${rank}  ${v.toFixed(1)}${unitStr}${pctStr}`, metricLabel];
              }}
            />
            <Bar dataKey="value" radius={[0, 3, 3, 0]} isAnimationActive={false}>
              {barData.map((d, i) => (
                <Cell key={i} fill={barFill(d.rank, d.isHighlighted)} opacity={d.isHighlighted ? 1 : 0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <MissingDataNote count={missing} total={total} />
      </div>
    );
  }

  return (
    <div>
      <div style={{ overflowY: "auto", maxHeight: 420 }}>
        <table className="ranking-table" aria-label={`Ranking: ${metricLabel}`}>
          <thead>
            <tr>
              <th>#</th>
              <th>Estado</th>
              <th>{metricLabel}{unit && ` (${unit})`}</th>
              <th>vs media</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isHighlighted = highlightState && row.estado === highlightState;
              const deltaPositive = row.pct_vs_mean >= 0;
              const isGood = direction === "lower_better" ? !deltaPositive : deltaPositive;
              return (
                <tr key={row.rank} className={isHighlighted ? "highlighted" : ""}>
                  <td>
                    <span className={rankClass(row.rank)}>{row.rank}</span>
                  </td>
                  <td style={{ fontWeight: isHighlighted ? 600 : undefined }}>{row.estado}</td>
                  <td style={{ fontFamily: "var(--font-mono)" }}>{row.value.toFixed(1)}</td>
                  <td style={{ color: isGood ? "var(--green)" : "var(--red)", fontFamily: "var(--font-mono)" }}>
                    {deltaPositive ? "+" : ""}{row.pct_vs_mean.toFixed(1)} %
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <MissingDataNote count={missing} total={total} />
    </div>
  );
}
