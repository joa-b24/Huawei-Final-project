import type { MetricDefinition, StateMetricRecord } from "../../types/dataset";

type MetricHeatmapChartProps = {
  records: StateMetricRecord[];
  metricIds: string[];
  metricCatalog: MetricDefinition[];
  title: string;
  description: string;
};

export default function MetricHeatmapChart({
  records,
  metricIds,
  metricCatalog,
  title,
  description
}: MetricHeatmapChartProps) {
  const metrics = metricIds
    .map((metricId) => metricCatalog.find((metric) => metric.id === metricId))
    .filter((metric): metric is MetricDefinition => Boolean(metric));

  const ranges = Object.fromEntries(
    metrics.map((metric) => {
      const values = records.map((record) => record.metrics[metric.id] ?? 0);
      return [
        metric.id,
        {
          min: Math.min(...values),
          max: Math.max(...values)
        }
      ];
    })
  );

  return (
    <div>
      <div className="section-heading">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>

      <div className="metric-heatmap">
        <div className="metric-heatmap-header metric-heatmap-row">
          <div className="metric-heatmap-state">Estado</div>
          {metrics.map((metric) => (
            <div className="metric-heatmap-cell metric-heatmap-title" key={metric.id}>
              {metric.label}
            </div>
          ))}
        </div>

        {records.map((record) => (
          <div className="metric-heatmap-row" key={record.state}>
            <div className="metric-heatmap-state">{record.state}</div>
            {metrics.map((metric) => {
              const value = record.metrics[metric.id] ?? 0;
              const intensity = getIntensity(value, ranges[metric.id]);

              return (
                <div
                  className="metric-heatmap-cell"
                  key={`${record.state}-${metric.id}`}
                  style={{ backgroundColor: `rgba(37, 99, 235, ${0.12 + intensity * 0.68})` }}
                >
                  <strong>{formatHeatmapValue(value, metric.unit)}</strong>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function getIntensity(value: number, range: { min: number; max: number }) {
  if (range.max === range.min) {
    return 0.5;
  }

  return (value - range.min) / (range.max - range.min);
}

function formatHeatmapValue(value: number, unit: string) {
  return `${value.toFixed(1)}${unit ? ` ${unit}` : ""}`;
}
