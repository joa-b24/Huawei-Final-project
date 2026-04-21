import type { StateMetricRecord } from "../../types/dataset";

type DumbbellComparisonChartProps = {
  records: StateMetricRecord[];
  leftMetricId: string;
  leftLabel: string;
  rightMetricId: string;
  rightLabel: string;
  title: string;
  description: string;
  unit: string;
};

export default function DumbbellComparisonChart({
  records,
  leftMetricId,
  leftLabel,
  rightMetricId,
  rightLabel,
  title,
  description,
  unit
}: DumbbellComparisonChartProps) {
  const chartData = [...records]
    .map((record) => ({
      state: record.state,
      left: record.metrics[leftMetricId] ?? 0,
      right: record.metrics[rightMetricId] ?? 0
    }))
    .sort((left, right) => right.right - left.right);

  return (
    <div>
      <div className="section-heading">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>

      <div className="dumbbell-chart">
        <div className="dumbbell-legend">
          <span className="dumbbell-legend-item">
            <i className="dumbbell-dot dumbbell-dot-left" />
            {leftLabel}
          </span>
          <span className="dumbbell-legend-item">
            <i className="dumbbell-dot dumbbell-dot-right" />
            {rightLabel}
          </span>
        </div>

        {chartData.map((item) => {
          const left = clampPercent(item.left);
          const right = clampPercent(item.right);
          const start = Math.min(left, right);
          const width = Math.max(Math.abs(right - left), 2);

          return (
            <div className="dumbbell-row" key={item.state}>
              <div className="dumbbell-state">{item.state}</div>
              <div className="dumbbell-track">
                <div
                  className="dumbbell-link"
                  style={{ left: `${start}%`, width: `${width}%` }}
                />
                <div className="dumbbell-point dumbbell-point-left" style={{ left: `${left}%` }} />
                <div className="dumbbell-point dumbbell-point-right" style={{ left: `${right}%` }} />
              </div>
              <div className="dumbbell-values">
                <span>{formatValue(item.left, unit)}</span>
                <span>{formatValue(item.right, unit)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function formatValue(value: number, unit: string) {
  return `${value.toFixed(1)}${unit ? ` ${unit}` : ""}`;
}
