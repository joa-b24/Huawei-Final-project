import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import EmptyState from "../EmptyState";

const STATE_COLORS = ["#1d4ed8", "#7c3aed", "#0891b2", "#059669", "#dc2626"];
const NATIONAL_COLOR = "#9ca3af";

type StateEntry = { name: string; values: Record<string, number | null> };

type Props = {
  stateData: StateEntry[];
  nationalValues: Record<string, number | null>;
  variables: { id: string; label: string }[];
};

export default function ComparisonRadarChart({ stateData, nationalValues, variables }: Props) {
  if (!variables.length || !stateData.length) {
    return <EmptyState title="Sin datos" description="Selecciona al menos un estado y una variable." />;
  }

  const data = variables.map((v) => ({
    axis: v.label.length > 22 ? v.label.slice(0, 22) + "…" : v.label,
    Nacional: nationalValues[v.id] ?? 0,
    ...Object.fromEntries(stateData.map((s) => [s.name, s.values[v.id] ?? 0])),
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <RadarChart data={data} margin={{ top: 10, right: 40, bottom: 10, left: 40 }}>
        <PolarGrid stroke="var(--border)" />
        <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fill: "var(--text-3)" }} />
        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
        <Radar
          name="Nacional"
          dataKey="Nacional"
          stroke={NATIONAL_COLOR}
          fill={NATIONAL_COLOR}
          fillOpacity={0.08}
          strokeDasharray="5 4"
          strokeWidth={1.5}
        />
        {stateData.map((s, i) => (
          <Radar
            key={s.name}
            name={s.name}
            dataKey={s.name}
            stroke={STATE_COLORS[i % STATE_COLORS.length]}
            fill={STATE_COLORS[i % STATE_COLORS.length]}
            fillOpacity={0.18}
            strokeWidth={2}
          />
        ))}
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Tooltip formatter={(v: number) => `${v.toFixed(1)} pts (normalizado)`} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
