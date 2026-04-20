import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis
} from "recharts";

type ScatterDatum = {
  state: string;
  x: number;
  y: number;
  z: number;
};

type CorrelationScatterProps = {
  data: ScatterDatum[];
  title: string;
  description: string;
  xLabel: string;
  xUnit: string;
  yLabel: string;
  yUnit: string;
};

export default function CorrelationScatter({
  data,
  title,
  description,
  xLabel,
  xUnit,
  yLabel,
  yUnit
}: CorrelationScatterProps) {
  return (
    <div>
      <div className="section-heading">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>

      <div className="chart-frame">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart>
            <CartesianGrid />
            <XAxis
              type="number"
              dataKey="x"
              name={xLabel}
              unit={xUnit}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="number"
              dataKey="y"
              name={yLabel}
              unit={yUnit}
              tickLine={false}
              axisLine={false}
            />
            <ZAxis type="number" dataKey="z" range={[90, 460]} name="Tamano relativo" />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} />
            <Scatter data={data} fill="#1d4ed8" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
