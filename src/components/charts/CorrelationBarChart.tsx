import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
  chartHeight?: number;
};

export default function CorrelationBarChart({ rows, significanceThreshold = 0.05, maxRows = 20, selectedId, onBarClick, chartHeight }: Props) {
  if (!rows.length) {
    return <EmptyState title="Sin correlaciones" description="Selecciona una variable objetivo." />;
  }

  const sorted = [...rows]
    .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))
    .slice(0, maxRows);

  const data = sorted.map((row) => ({
    variableId: row.variableId,
    label: row.label,
    r: row.r,
    pValue: row.pValue,
    significant: row.pValue === undefined || row.pValue < significanceThreshold,
  }));

  function wrapLabel(text: string, maxChars = 30): string[] {
    if (text.length <= maxChars) return [text];
    const words = text.split(" ");
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      if (!current) { current = word; continue; }
      if ((current + " " + word).length <= maxChars) {
        current += " " + word;
      } else {
        lines.push(current);
        current = word;
        if (lines.length === 1) break;
      }
    }
    if (current) lines.push(current);
    return lines.slice(0, 3);
  }

  return (
    <ResponsiveContainer width="100%" height={chartHeight ?? Math.max(400, data.length * 44)}>
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
            const lines = wrapLabel(payload.value);
            const lh = 13;
            const offsetY = lines.length > 1 ? -(lh / 2) : 0;
            return (
              <text
                x={x - 4} y={y + offsetY}
                textAnchor="end"
                fontSize={11}
                fill={isSelected ? "var(--blue)" : "var(--text-2)"}
                fontWeight={isSelected ? 700 : 400}
              >
                {lines.map((line, i) => (
                  <tspan key={i} x={x - 4} dy={i === 0 ? "0.35em" : lh}>{line}</tspan>
                ))}
              </text>
            );
          }}
          axisLine={false}
          tickLine={false}
          width={200}
        />
        <Tooltip
          content={({ payload }) => {
            if (!payload?.length) return null;
            const d = payload[0].payload;
            const abs = Math.abs(d.r);
            const strength = abs >= 0.7 ? "Fuerte" : abs >= 0.4 ? "Moderada" : abs >= 0.2 ? "Débil" : "Muy débil";
            const dir = d.r >= 0 ? "positiva" : "negativa";
            const pv = d.pValue;
            const sigText = pv === undefined ? null
              : pv < 0.001 ? "p < 0.001 ***"
              : pv < 0.01  ? `p = ${pv.toFixed(3)} **`
              : pv < 0.05  ? `p = ${pv.toFixed(3)} *`
              : `p = ${pv.toFixed(3)} ns`;
            return (
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "8px 12px", fontSize: 12, maxWidth: 230, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
                <strong style={{ display: "block", marginBottom: 5, color: "var(--text-1)", lineHeight: 1.3 }}>{d.label}</strong>
                <div style={{ fontWeight: 700, fontSize: 13, color: d.r >= 0 ? "var(--green)" : "var(--red)" }}>
                  r = {d.r.toFixed(3)}
                </div>
                <div style={{ color: "var(--text-2)", marginTop: 2 }}>{strength} · {dir}</div>
                {sigText && (
                  <div style={{ color: d.significant ? "var(--text-3)" : "var(--text-3)", fontSize: 11, marginTop: 4, fontStyle: d.significant ? "normal" : "italic" }}>
                    {sigText}
                  </div>
                )}
              </div>
            );
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
