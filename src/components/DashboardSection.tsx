import type { ReactNode } from "react";

type MetricOption = {
  id: string;
  label: string;
  category: string;
};

type DashboardSectionProps = {
  sectionId: string;
  title: string;
  description: string;
  metricOptions: MetricOption[];
  selectedMetricId: string;
  onMetricChange: (metricId: string) => void;
  children: ReactNode;
};

export default function DashboardSection({
  sectionId,
  title,
  description,
  metricOptions,
  selectedMetricId,
  onMetricChange,
  children
}: DashboardSectionProps) {
  const selectId = `${sectionId}-metric-select`;

  return (
    <section className="dashboard-block">
      <div className="dashboard-block-header">
        <div className="section-heading">
          <h2>{title}</h2>
          <p>{description}</p>
        </div>

        <div className="metric-control">
          <label htmlFor={selectId}>Variable principal</label>
          <select
            id={selectId}
            value={selectedMetricId}
            onChange={(event) => onMetricChange(event.target.value)}
          >
            {metricOptions.map((metric) => (
              <option key={metric.id} value={metric.id}>
                {metric.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {children}
    </section>
  );
}
