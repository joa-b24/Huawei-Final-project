import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { LorenzPoint } from "../../utils/gini";

type Props = {
  title: string;
  description: string;
  points: LorenzPoint[];
};

export default function LorenzCurveChart({ title, description, points }: Props) {
  const data =
    points.length > 0
      ? points
      : [
          { popShare: 0, lorenz: 0, equality: 0 },
          { popShare: 1, lorenz: 1, equality: 1 }
        ];

  return (
    <div>
      <div className="section-heading">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <div className="chart-frame">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="popShare"
              domain={[0, 1]}
              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              name="Población acumulada"
            />
            <YAxis
              type="number"
              domain={[0, 1]}
              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              name="Cobertura acumulada"
            />
            <Tooltip
              formatter={(value: number) => `${(value * 100).toFixed(1)}%`}
              labelFormatter={(_, payload) =>
                payload?.[0]?.payload ? `Población acum.: ${(payload[0].payload.popShare * 100).toFixed(1)}%` : ""
              }
            />
            <Legend />
            <Line type="monotone" dataKey="lorenz" name="Lorenz (cobertura)" stroke="#2563eb" dot={false} strokeWidth={2} />
            <Line
              type="linear"
              dataKey="equality"
              name="Igualdad perfecta"
              stroke="#94a3b8"
              strokeDasharray="6 4"
              dot={false}
              strokeWidth={1.5}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
