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

function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let i = 0;
  while (i < words.length && lines.length < maxLines) {
    let line = words[i++];
    while (i < words.length && `${line} ${words[i]}`.length <= maxChars) line += ` ${words[i++]}`;
    const isLast = lines.length === maxLines - 1;
    if (isLast && i < words.length) line = line.length <= maxChars - 1 ? `${line}…` : `${line.slice(0, maxChars - 1)}…`;
    lines.push(line);
  }
  return lines;
}

function BarAxisTick({ x, y, payload }: { x?: number; y?: number; payload?: { value?: string } }) {
  const lines = wrapText(payload?.value ?? "", 14, 2);
  return (
    <text x={x} y={(y ?? 0) + 6} textAnchor="middle" fill="var(--text-3)" fontSize={10}>
      {lines.map((line, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : 11}>{line}</tspan>
      ))}
    </text>
  );
}

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
            <XAxis dataKey="state" tickLine={false} axisLine={false} height={44} tick={<BarAxisTick />} interval={0} />
            <YAxis tickLine={false} axisLine={false} />
            <Tooltip />
            <Bar dataKey={`metrics.${metric.id}`} fill="#2563eb" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
