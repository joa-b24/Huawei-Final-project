import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatPValue } from "../../lib/format";
import EmptyState from "../EmptyState";

export type CorrelationRow = {
  variableId: string;
  label: string;
  r: number;
  pValue?: number;
};

type Props = {
  rows: CorrelationRow[];
  significanceThreshold?: number;
  maxRows?: number;
};

export default function CorrelationBarChart({ rows, significanceThreshold = 0.05, maxRows = 20 }: Props) {
  if (!rows.length) {
    return <EmptyState title="Sin correlaciones" description="Selecciona una variable objetivo." />;
  }

  const sorted = [...rows]
    .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))
    .slice(0, maxRows);

  const data = sorted.map((row) => ({
    label: row.label.length > 36 ? row.label.slice(0, 36) + "…" : row.label,
    r: row.r,
    pValue: row.pValue,
    significant: row.pValue === undefined || row.pValue < significanceThreshold,
  }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(240, data.length * 28)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, bottom: 4, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis
          type="number"
          domain={[-1, 1]}
          tick={{ fontSize: 11, fill: "var(--text-3)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fontSize: 11, fill: "var(--text-2)" }}
          axisLine={false}
          tickLine={false}
          width={200}
        />
        <Tooltip
          formatter={(r: number, _: string, props: any) => {
            const sig = props.payload.pValue !== undefined ? ` (${formatPValue(props.payload.pValue)})` : "";
            return [`r = ${r.toFixed(2)}${sig}`, "Correlación"];
          }}
        />
        <Bar dataKey="r" radius={[0, 3, 3, 0]} isAnimationActive={false}>
          {data.map((d, i) => (
            <Cell
              key={i}
              fill={d.r >= 0 ? "var(--green)" : "var(--red)"}
              opacity={d.significant ? 1 : 0.35}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
