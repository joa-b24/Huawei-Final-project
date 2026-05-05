import type { RankingEntry } from "../../types/dataStandard";
import { formatPValue } from "../../lib/format";
import MissingDataNote from "../feedback/MissingDataNote";

type Props = {
  rows: RankingEntry[];
  highlightState?: string;
  metricLabel: string;
  unit?: string;
  total?: number;
};

export default function RankingTable({ rows, highlightState, metricLabel, unit = "", total = 32 }: Props) {
  const topThird = Math.ceil(total / 3);
  const bottomThird = Math.floor((2 * total) / 3);
  const missing = total - rows.length;

  function rankClass(rank: number) {
    if (rank <= topThird) return "rank-good";
    if (rank > bottomThird) return "rank-poor";
    return "rank-mid";
  }

  return (
    <div>
      <div style={{ overflowY: "auto", maxHeight: 420 }}>
        <table className="ranking-table" aria-label={`Ranking: ${metricLabel}`}>
          <thead>
            <tr>
              <th>#</th>
              <th>Estado</th>
              <th>{metricLabel} {unit && `(${unit})`}</th>
              <th>vs media</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isHighlighted = highlightState && row.estado === highlightState;
              const deltaPositive = row.pct_vs_mean >= 0;
              return (
                <tr key={row.rank} className={isHighlighted ? "highlighted" : ""}>
                  <td>
                    <span className={rankClass(row.rank)}>{row.rank}</span>
                  </td>
                  <td style={{ fontWeight: isHighlighted ? 600 : undefined }}>{row.estado}</td>
                  <td style={{ fontFamily: "var(--font-mono)" }}>{row.value.toFixed(1)}</td>
                  <td style={{ color: deltaPositive ? "var(--green)" : "var(--red)", fontFamily: "var(--font-mono)" }}>
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
