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
  selectedId?: string | null;
  onBarClick?: (variableId: string) => void;
};

export default function CorrelationBarChart({ rows, significanceThreshold = 0.05, maxRows = 20, selectedId, onBarClick }: Props) {
  if (!rows.length) {
    return <EmptyState title="Sin correlaciones" description="Selecciona una variable objetivo." />;
  }

  const sorted = [...rows]
    .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))
    .slice(0, maxRows);

  const data = sorted.map((row) => ({
    variableId: row.variableId,
    label: row.label.length > 36 ? row.label.slice(0, 36) + "…" : row.label,
    r: row.r,
    pValue: row.pValue,
    significant: row.pValue === undefined || row.pValue < significanceThreshold,
  }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(360, data.length * 28)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 40, bottom: 4, left: 4 }}
        onClick={(chartData) => {
          if (onBarClick && chartData?.activePayload?.[0]?.payload?.variableId) {
            onBarClick(chartData.activePayload[0].payload.variableId);
          }
        }}
        style={onBarClick ? { cursor: "pointer" } : undefined}
      >
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
          tick={(props: any) => {
            const { x, y, payload } = props;
            const rowData = data.find((d) => d.label === payload.value);
            const isSelected = rowData?.variableId === selectedId;
            return (
              <text
                x={x - 4} y={y} dy=".35em"
                textAnchor="end"
                fontSize={11}
                fill={isSelected ? "var(--blue)" : "var(--text-2)"}
                fontWeight={isSelected ? 700 : 400}
              >
                {payload.value}
              </text>
            );
          }}
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
        <Bar
          dataKey="r"
          radius={[0, 3, 3, 0]}
          isAnimationActive={false}
          background={(props: any) => {
            if (props.variableId !== selectedId) return <g />;
            return (
              <rect
                x={props.x}
                y={props.y}
                width={props.width}
                height={props.height}
                fill="var(--blue-light)"
                rx={3}
              />
            );
          }}
        >
          {data.map((d, i) => {
            const isSelected = d.variableId === selectedId;
            return (
              <Cell
                key={i}
                fill={d.r >= 0 ? "var(--green)" : "var(--red)"}
                fillOpacity={isSelected ? 1 : (d.significant ? 0.75 : 0.3)}
              />
            );
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
