import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { MetricDefinition, StateMetricRecord } from "../../types/dataset";

type ComparisonBarChartProps = {
  records: StateMetricRecord[];
  metric: MetricDefinition;
  title: string;
  description: string;
};

export default function ComparisonBarChart({
  records,
  metric,
  title,
  description
}: ComparisonBarChartProps) {
  const chartData = [...records].sort(
    (left, right) => (right.metrics[metric.id] ?? 0) - (left.metrics[metric.id] ?? 0)
  );

  return (
    <div>
      <div className="section-heading">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>

      <div className="chart-frame">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="state" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} />
            <Tooltip />
            <Bar dataKey={`metrics.${metric.id}`} fill="#ff6b00" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
