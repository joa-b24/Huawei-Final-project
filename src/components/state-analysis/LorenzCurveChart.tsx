import {
  Area,
  ComposedChart,
  CartesianGrid,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LorenzPoint } from "../../utils/gini";
import InterpretationHelp from "./InterpretationHelp";

type Props = {
  title: string;
  description: string;
  points: LorenzPoint[];
  gini: number;
  nationalGini?: number;
};

function coverageShareAtHalfPopulation(points: { popShare: number; lorenz: number }[]): number | null {
  if (points.length < 2) return null;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a.popShare <= 0.5 && b.popShare >= 0.5) {
      const range = b.popShare - a.popShare;
      if (range <= 0) return a.lorenz;
      const t = (0.5 - a.popShare) / range;
      return a.lorenz + t * (b.lorenz - a.lorenz);
    }
  }
  return null;
}

function formatGiniValue(g: number): string {
  if (!Number.isFinite(g)) return "—";
  if (g < 0.001) return "<0.001";
  return g.toFixed(3);
}

function giniColor(g: number): { fill: string; badge: string; label: string } {
  if (g < 0.01) return { fill: "#86efac", badge: "#16a34a", label: "Casi parejo" };
  if (g < 0.12) return { fill: "#86efac", badge: "#15803d", label: "Poco desigual" };
  if (g < 0.25) return { fill: "#fcd34d", badge: "#b45309", label: "Algo desigual" };
  return { fill: "#fca5a5", badge: "#b91c1c", label: "Bastante desigual" };
}

function vsNationalLabel(delta: number): string {
  if (delta > 0.02) return "por encima de";
  if (delta < -0.02) return "por debajo de";
  return "cerca de";
}

function giniCompareSentence(g: number, delta: number, national: number): string {
  const vs = vsNationalLabel(delta);
  if (g < 0.01) {
    return `Gini ${formatGiniValue(g)} (muy bajo). El estado queda ${vs} el promedio del país (${formatGiniValue(national)}).`;
  }
  return `Gini ${formatGiniValue(g)}. El estado queda ${vs} el promedio del país (${formatGiniValue(national)}).`;
}

export default function LorenzCurveChart({ title, description, points, gini, nationalGini }: Props) {
  const data =
    points.length > 0
      ? points.map((p) => ({ ...p, giniGap: Math.max(0, p.equality - p.lorenz) }))
      : [
          { popShare: 0, lorenz: 0, equality: 0, giniGap: 0 },
          { popShare: 1, lorenz: 1, equality: 1, giniGap: 0 },
        ];

  const halfCoverage = coverageShareAtHalfPopulation(data);
  const deltaNational =
    Number.isFinite(gini) && nationalGini != null && Number.isFinite(nationalGini)
      ? gini - nationalGini
      : Number.NaN;
  const colors = giniColor(gini);

  return (
    <div>
      {/* Header */}
      <div className="section-heading">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1 }}>
            {title ? <h2 style={{ margin: 0 }}>{title}</h2> : null}
            {description ? (
              <p style={{ marginTop: title ? 4 : 0, marginBottom: 0, color: "#475569", fontSize: "0.88rem" }}>
                {description}
              </p>
            ) : null}
          </div>
          {Number.isFinite(gini) && (
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              background: colors.badge,
              color: "#fff",
              borderRadius: 12,
              padding: "10px 18px",
              minWidth: 90,
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            }}>
              <span style={{ fontSize: "1.9rem", fontWeight: 800, lineHeight: 1 }}>{formatGiniValue(gini)}</span>
              <span style={{ fontSize: "0.7rem", fontWeight: 600, opacity: 0.9, marginTop: 2, textAlign: "center" }}>
                Gini
              </span>
              <span style={{ fontSize: "0.65rem", opacity: 0.85, marginTop: 4, textAlign: "center" }}>
                {colors.label}
              </span>
            </div>
          )}
        </div>

        {/* KPI strip */}
        <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
          {Number.isFinite(nationalGini) && (
            <div style={{ background: "#f1f5f9", borderRadius: 8, padding: "6px 12px", fontSize: "0.82rem", color: "#334155" }}>
              <span style={{ color: "#94a3b8" }}>País </span>
              <strong>{formatGiniValue(nationalGini!)}</strong>
            </div>
          )}
          {Number.isFinite(deltaNational) && (
            <div style={{
              background: deltaNational > 0.02 ? "#fef2f2" : deltaNational < -0.02 ? "#f0fdf4" : "#f8fafc",
              borderRadius: 8,
              padding: "6px 12px",
              fontSize: "0.82rem",
              color: deltaNational > 0.02 ? "#b91c1c" : deltaNational < -0.02 ? "#15803d" : "#334155",
              fontWeight: 600,
            }}>
              {Math.abs(deltaNational).toFixed(3)} {vsNationalLabel(deltaNational)} el país
            </div>
          )}
          {halfCoverage !== null && (
            <div style={{ background: "#eff6ff", borderRadius: 8, padding: "6px 12px", fontSize: "0.82rem", color: "#1d4ed8" }}>
              Mitad menos cubierta: <strong>{(halfCoverage * 100).toFixed(1)}%</strong>
            </div>
          )}
        </div>
      </div>

      <InterpretationHelp
        topic="Curva de Lorenz y coeficiente de Gini"
        caption="¿Qué veo aquí?"
        heading="¿Qué veo aquí?"
      >
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7, color: "#334155" }}>
          <li><strong>Línea gris</strong> = todos los municipios con el mismo valor (distribución ideal).</li>
          <li><strong>Línea azul</strong> = distribución real entre municipios.</li>
          <li><strong>Sombra</strong> = diferencia entre ambas. Más sombra = mayor desigualdad territorial.</li>
        </ul>
        {Number.isFinite(gini) && nationalGini != null && Number.isFinite(nationalGini) ? (
          <p style={{ background: "#eff6ff", borderRadius: 8, padding: "8px 10px", border: "1px solid #bfdbfe", marginTop: 10, marginBottom: 0 }}>
            {giniCompareSentence(gini, deltaNational, nationalGini)}
          </p>
        ) : null}
        {halfCoverage !== null ? (
          <p style={{ background: "#fefce8", borderRadius: 8, padding: "8px 10px", border: "1px solid #fde68a", marginTop: 10, marginBottom: 0 }}>
            La mitad de la población con menor valor acumula{" "}
            <strong>{(halfCoverage * 100).toFixed(1)}%</strong> del total. En un reparto parejo sería cerca del 50%.
          </p>
        ) : null}
      </InterpretationHelp>

      {/* Chart */}
      <div className="chart-frame" style={{ height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 12, right: 20, left: 0, bottom: 8 }}>
            <defs>
              <linearGradient id="lorenzFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.fill} stopOpacity={0.8} />
                <stop offset="100%" stopColor={colors.fill} stopOpacity={0.2} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              type="number"
              dataKey="popShare"
              domain={[0, 1]}
              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              label={{ value: "Población →", position: "insideBottom", offset: -4, fontSize: 11, fill: "#94a3b8" }}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              type="number"
              domain={[0, 1]}
              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              label={{ value: "Valor acum. →", angle: -90, position: "insideLeft", offset: 12, fontSize: 11, fill: "#94a3b8" }}
              tick={{ fontSize: 11 }}
              width={48}
            />
            <Tooltip
              formatter={(value: number, name: string) =>
                name === "Área Gini" ? null : [`${(value * 100).toFixed(1)}%`, name]
              }
              labelFormatter={(_, payload) =>
                payload?.[0]?.payload
                  ? `Pob. acum.: ${(payload[0].payload.popShare * 100).toFixed(1)}%`
                  : ""
              }
              contentStyle={{ fontSize: "0.82rem", borderRadius: 8 }}
            />

            {/* Lorenz base (transparent) — establishes stack baseline so giniGap renders above the curve */}
            <Area
              type="monotone"
              dataKey="lorenz"
              name="Lorenz (cobertura)"
              stackId="gini"
              fill="transparent"
              fillOpacity={0}
              stroke="none"
              dot={false}
              isAnimationActive={false}
              legendType="none"
            />
            {/* Gini shaded area — stacked on top of lorenz baseline */}
            <Area
              type="monotone"
              dataKey="giniGap"
              name="Área Gini"
              stackId="gini"
              fill="url(#lorenzFill)"
              stroke="none"
              fillOpacity={1}
              isAnimationActive={false}
              legendType="none"
            />

            {/* Perfect equality line */}
            <Line
              type="linear"
              dataKey="equality"
              name="Igualdad perfecta"
              stroke="#94a3b8"
              strokeDasharray="6 4"
              dot={false}
              strokeWidth={1.5}
              isAnimationActive={false}
            />

            {/* Lorenz curve */}
            <Line
              type="monotone"
              dataKey="lorenz"
              name="Lorenz (cobertura 4G)"
              stroke="#2563eb"
              dot={false}
              strokeWidth={2.5}
              isAnimationActive={false}
            />

            {/* Lorenz curve */}
            <Line
              type="monotone"
              dataKey="lorenz"
              name="Cobertura real"
              stroke="#2563eb"
              dot={false}
              strokeWidth={2.5}
              isAnimationActive={false}
            />

            {/* 50% population reference */}
            <ReferenceLine
              x={0.5}
              stroke="#cbd5e1"
              strokeDasharray="4 3"
              label={{ value: "50% pob.", position: "top", fontSize: 10, fill: "#94a3b8" }}
            />

            {/* Half-coverage dot */}
            {halfCoverage !== null && (
              <ReferenceDot
                x={0.5}
                y={halfCoverage}
                r={5}
                fill="#2563eb"
                stroke="#fff"
                strokeWidth={2}
                label={{
                  value: `${(halfCoverage * 100).toFixed(1)}%`,
                  position: "right",
                  fontSize: 11,
                  fill: "#1d4ed8",
                  fontWeight: 700,
                }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p style={{ marginTop: 8, fontSize: "0.78rem", color: "#94a3b8", marginBottom: 0 }}>
        Punto azul = valor acumulado de la mitad con menor acceso. Más sombra = mayor diferencia entre municipios.
      </p>
    </div>
  );
}
