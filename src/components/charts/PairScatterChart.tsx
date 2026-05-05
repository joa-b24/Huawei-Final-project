import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import EmptyState from "../EmptyState";

export type ScatterPoint = { state: string; x: number; y: number };

type Props = {
  data: ScatterPoint[];
  xLabel: string;
  yLabel: string;
  highlightState?: string;
  xUnit?: string;
  yUnit?: string;
};

function linearReg(pts: ScatterPoint[]) {
  const n = pts.length;
  if (n < 2) return { slope: 0, intercept: 0, r2: 0 };
  const xm = pts.reduce((s, p) => s + p.x, 0) / n;
  const ym = pts.reduce((s, p) => s + p.y, 0) / n;
  const ssxy = pts.reduce((s, p) => s + (p.x - xm) * (p.y - ym), 0);
  const ssx = pts.reduce((s, p) => s + (p.x - xm) ** 2, 0);
  const ssy = pts.reduce((s, p) => s + (p.y - ym) ** 2, 0);
  const slope = ssx === 0 ? 0 : ssxy / ssx;
  const r2 = ssx === 0 || ssy === 0 ? 0 : ssxy ** 2 / (ssx * ssy);
  return { slope, intercept: ym - slope * xm, r2 };
}

const CustomDot = (props: any) => {
  const { cx, cy, payload, highlightState } = props;
  const isHighlight = payload.state === highlightState;
  return (
    <g>
      {isHighlight && <circle cx={cx} cy={cy} r={10} fill="var(--blue)" opacity={0.15} />}
      <circle cx={cx} cy={cy} r={isHighlight ? 6 : 4} fill={isHighlight ? "var(--blue)" : "#93c5fd"} stroke="#fff" strokeWidth={1} />
      {isHighlight && (
        <text x={cx + 8} y={cy - 8} fontSize={10} fill="var(--text-2)" fontWeight={600}>
          {payload.state}
        </text>
      )}
    </g>
  );
};

export default function PairScatterChart({ data, xLabel, yLabel, highlightState, xUnit = "", yUnit = "" }: Props) {
  if (data.length < 3) {
    return <EmptyState title="Datos insuficientes" description="Se necesitan al menos 3 estados con dato en ambas variables." />;
  }

  const { slope, intercept, r2 } = linearReg(data);
  const xs = data.map((d) => d.x);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);

  // Trend line: 2 points merged into combined data (ComposedChart approach)
  const trendPoints = [
    { x: xMin, yTrend: slope * xMin + intercept },
    { x: xMax, yTrend: slope * xMax + intercept },
  ];

  // Merge: actual scatter data gets yTrend=undefined, trend points get y=undefined
  const combined = [
    ...data.map((d) => ({ x: d.x, y: d.y, state: d.state, yTrend: undefined as number | undefined })),
    ...trendPoints.map((t) => ({ x: t.x, y: undefined as number | undefined, state: "", yTrend: t.yTrend })),
  ];

  return (
    <div>
      <p style={{ textAlign: "center", fontSize: 12, color: "var(--text-3)", margin: "0 0 8px" }}>
        R² = {r2.toFixed(2)}
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={combined} margin={{ top: 8, right: 24, bottom: 24, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            type="number"
            dataKey="x"
            name={xLabel}
            label={{ value: `${xLabel}${xUnit ? ` (${xUnit})` : ""}`, position: "insideBottom", offset: -12, fontSize: 11, fill: "var(--text-3)" }}
            tick={{ fontSize: 11, fill: "var(--text-3)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="number"
            dataKey="y"
            name={yLabel}
            label={{ value: `${yLabel}${yUnit ? ` (${yUnit})` : ""}`, angle: -90, position: "insideLeft", fontSize: 11, fill: "var(--text-3)" }}
            tick={{ fontSize: 11, fill: "var(--text-3)" }}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <Tooltip
            content={({ payload }) => {
              const p = payload?.[0]?.payload;
              if (!p || !p.state) return null;
              return (
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "8px 12px", fontSize: 12 }}>
                  <strong>{p.state}</strong>
                  <div>{xLabel}: {p.x?.toFixed(1)}</div>
                  <div>{yLabel}: {p.y?.toFixed(1)}</div>
                </div>
              );
            }}
          />
          <Line
            dataKey="yTrend"
            dot={false}
            stroke="var(--text-3)"
            strokeDasharray="5 4"
            strokeWidth={1.5}
            isAnimationActive={false}
            connectNulls={false}
          />
          <Scatter
            dataKey="y"
            data={data}
            shape={(props: any) => <CustomDot {...props} highlightState={highlightState} />}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
