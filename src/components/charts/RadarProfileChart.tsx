import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer
} from "recharts";
import type { MetricDefinition, StateMetricRecord } from "../../types/dataset";

type RadarProfileChartProps = {
  records: StateMetricRecord[];
  metricIds: string[];
  metricCatalog: MetricDefinition[];
  title: string;
  description: string;
};

const COLORS = ["#1d4ed8", "#0f766e", "#2563eb", "#1e40af", "#0891b2", "#334155"];

export default function RadarProfileChart({
  records,
  metricIds,
  metricCatalog,
  title,
  description
}: RadarProfileChartProps) {
  const chartData = metricIds.map((metricId) => {
    const metric = metricCatalog.find((item) => item.id === metricId);
    const point: Record<string, number | string> = {
      metric: metric?.label ?? metricId
    };

    records.forEach((record) => {
      point[record.state] = record.metrics[metricId];
    });

    return point;
  });

  return (
    <div>
      <div className="section-heading">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>

      <div className="chart-frame">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={chartData}>
            <PolarGrid />
            <PolarAngleAxis dataKey="metric" />
            <Legend />
            {records.map((record, index) => (
              <Radar
                key={record.state}
                dataKey={record.state}
                name={record.state}
                stroke={COLORS[index % COLORS.length]}
                fill={COLORS[index % COLORS.length]}
                fillOpacity={0.12}
              />
            ))}
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
