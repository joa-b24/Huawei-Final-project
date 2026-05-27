import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MetricPolaridad, RankingEntry } from "../../types/dataStandard";
import MissingDataNote from "../feedback/MissingDataNote";

type Props = {
  rows: RankingEntry[];
  highlightState?: string;
  comparisonState?: string;
  comparisonStates?: string[];
  metricLabel: string;
  unit?: string;
  total?: number;
  view?: "table" | "bars" | "lollipop";
  direction?: MetricPolaridad;
  groupLines?: { value: number; label: string; color: string }[];
};

function LollipopTooltip({ active, payload, label, metricLabel, unit, direction }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const unitStr = unit ? ` ${unit}` : "";
  const isGood = direction === "lower_better" ? d.pct < 0 : d.pct >= 0;
  const pctColor = isGood ? "var(--green)" : "var(--red)";
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 8, padding: "10px 14px", fontSize: 12,
      boxShadow: "0 4px 12px rgba(0,0,0,0.1)", minWidth: 180,
    }}>
      <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: 14, color: d.isHighlighted ? "var(--blue)" : "var(--text-1)" }}>
        {label}
      </p>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-end", marginBottom: 6 }}>
        <div>
          <span style={{ display: "block", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-3)", marginBottom: 1 }}>Valor</span>
          <span style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "var(--text-1)" }}>
            {d.value.toFixed(1)}<span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-3)" }}>{unitStr}</span>
          </span>
        </div>
        <div style={{ paddingBottom: 2 }}>
          <span style={{ display: "block", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-3)", marginBottom: 1 }}>Posición</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-2)" }}>#{d.rank}</span>
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: pctColor }}>
        {d.pct >= 0 ? "+" : ""}{d.pct.toFixed(1)}% vs media nacional
      </p>
      <p style={{ margin: "3px 0 0", fontSize: 10, color: "var(--text-3)" }}>{metricLabel}</p>
    </div>
  );
}

function LollipopShapeColumn({ x, y, width, height, fill, isHighlighted }: any) {
  if (!height || height <= 0) return null;
  const cx = x + width / 2;
  const r = isHighlighted ? 7 : 5;
  return (
    <g>
      <line x1={cx} y1={y + height} x2={cx} y2={y} stroke={fill} strokeWidth={isHighlighted ? 3 : 2} opacity={0.9} />
      <circle cx={cx} cy={y} r={r} fill={fill} stroke="var(--surface)" strokeWidth={isHighlighted ? 2.5 : 1.5} />
      {isHighlighted && <circle cx={cx} cy={y} r={r + 3} fill="none" stroke={fill} strokeWidth={1} opacity={0.35} />}
    </g>
  );
}

export default function RankingTable({ rows, highlightState, comparisonState, comparisonStates, metricLabel, unit = "", total = 32, view = "table", direction, groupLines }: Props) {
  const topThird = Math.ceil(total / 3);
  const bottomThird = Math.floor((2 * total) / 3);
  const missing = total - rows.length;

  const allComparisonStates = new Set([
    ...(comparisonState ? [comparisonState] : []),
    ...(comparisonStates ?? []),
  ]);

  function rankClass(rank: number) {
    if (rank <= topThird) return "rank-good";
    if (rank > bottomThird) return "rank-poor";
    return "rank-mid";
  }

  function barFill(rank: number, isHighlighted: boolean, isComparison: boolean) {
    if (isHighlighted) return "var(--blue)";
    if (isComparison) return "#64748b";
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
    isComparison: allComparisonStates.has(row.estado) && highlightState !== row.estado,
  }));

  const chartTooltipFormatter = (v: number, _: string, props: { payload?: { rank?: number; pct?: number } }) => {
    const rank = props.payload?.rank;
    const pct = props.payload?.pct;
    const unitStr = unit ? ` ${unit}` : "";
    const pctStr = pct !== undefined ? `  (${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% vs media)` : "";
    return [`#${rank}  ${v.toFixed(1)}${unitStr}${pctStr}`, metricLabel];
  };

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
            <Tooltip formatter={chartTooltipFormatter} />
            <Bar dataKey="value" radius={[0, 3, 3, 0]} isAnimationActive={false}>
              {barData.map((d, i) => (
                <Cell key={i} fill={barFill(d.rank, d.isHighlighted, d.isComparison)} opacity={d.isHighlighted ? 1 : 0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <MissingDataNote count={missing} total={total} />
      </div>
    );
  }

  if (view === "lollipop") {
    return (
      <div>
        <ResponsiveContainer width="100%" height={480}>
          <BarChart data={barData} margin={{ top: 16, right: 16, bottom: 80, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 9, fill: "var(--text-2)" }}
              tickLine={false}
              axisLine={false}
              angle={-45}
              textAnchor="end"
              interval={0}
              height={80}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "var(--text-3)" }}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <Tooltip
              content={(props) => (
                <LollipopTooltip {...props} metricLabel={metricLabel} unit={unit} direction={direction} />
              )}
            />
            <Bar
              dataKey="value"
              isAnimationActive={false}
              shape={(props: any) => {
                const d = barData[props.index];
                const fill = d ? barFill(d.rank, d.isHighlighted, d.isComparison) : "var(--border)";
                return <LollipopShapeColumn {...props} fill={fill} isHighlighted={d?.isHighlighted} />;
              }}
            />
            {groupLines?.map((gl, i) => (
              <ReferenceLine
                key={`gl-${i}`}
                y={gl.value}
                stroke={gl.color}
                strokeDasharray="5 3"
                strokeWidth={1.5}
                label={{ value: gl.label, fontSize: 10, fill: gl.color, position: i % 2 === 0 ? "insideTopLeft" : "insideTopRight" }}
              />
            ))}
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
              <th>Variable{unit && ` (${unit})`}</th>
              <th>vs media</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isHighlighted = !!highlightState && row.estado === highlightState;
              const isComp = !isHighlighted && allComparisonStates.has(row.estado);
              const deltaPositive = row.pct_vs_mean >= 0;
              const isGood = direction === "lower_better" ? !deltaPositive : deltaPositive;
              return (
                <tr
                  key={row.rank}
                  className={isHighlighted ? "highlighted" : isComp ? "comparison" : ""}
                  style={
                    isHighlighted
                      ? { boxShadow: "inset 3px 0 0 var(--blue)", background: "color-mix(in srgb, var(--blue) 8%, transparent)" }
                      : isComp
                      ? { boxShadow: "inset 3px 0 0 #64748b", background: "color-mix(in srgb, #64748b 6%, transparent)" }
                      : undefined
                  }
                >
                  <td>
                    <span className={rankClass(row.rank)}>{row.rank}</span>
                  </td>
                  <td style={{ fontWeight: isHighlighted ? 700 : isComp ? 600 : undefined }}>{row.estado}</td>
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
