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
  nationalGini: number;
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

function giniBadge(g: number): { badge: string; label: string } {
  if (g < 0.01) return { badge: "#16a34a", label: "Casi parejo" };
  if (g < 0.12) return { badge: "#15803d", label: "Poco desigual" };
  if (g < 0.25) return { badge: "#b45309", label: "Algo desigual" };
  return { badge: "#b91c1c", label: "Bastante desigual" };
}

function vsNationalLabel(delta: number): string {
  if (delta > 0.02) return "por encima de";
  if (delta < -0.02) return "por debajo de";
  return "cerca de";
}

function giniCompareSentence(g: number, delta: number, national: number): string {
  const gText = formatGiniValue(g);
  const natText = formatGiniValue(national);
  const vs = vsNationalLabel(delta);
  if (g < 0.01) {
    return `Gini ${gText} (muy bajo). En este indicador, el estado queda ${vs} el promedio del país (${natText}).`;
  }
  return `Gini ${gText}. En este indicador, el estado queda ${vs} el promedio del país (${natText}).`;
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
    Number.isFinite(gini) && Number.isFinite(nationalGini) ? gini - nationalGini : Number.NaN;
  const badge = giniBadge(gini);
  const giniText = formatGiniValue(gini);
  const nationalText = formatGiniValue(nationalGini);

  return (
    <div>
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
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                background: badge.badge,
                color: "#fff",
                borderRadius: 12,
                padding: "10px 18px",
                minWidth: 90,
              }}
            >
              <span style={{ fontSize: "1.9rem", fontWeight: 800, lineHeight: 1 }}>{giniText}</span>
              <span style={{ fontSize: "0.7rem", fontWeight: 600, opacity: 0.9, marginTop: 2, textAlign: "center" }}>
                Gini
              </span>
              <span style={{ fontSize: "0.65rem", opacity: 0.85, marginTop: 4, textAlign: "center" }}>
                {badge.label}
              </span>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
          {Number.isFinite(nationalGini) && (
            <div style={{ background: "#f1f5f9", borderRadius: 8, padding: "6px 12px", fontSize: "0.82rem", color: "#334155" }}>
              <span style={{ color: "#94a3b8" }}>País </span>
              <strong>{nationalText}</strong>
            </div>
          )}
          {Number.isFinite(deltaNational) && (
            <div
              style={{
                background: deltaNational > 0.02 ? "#fef2f2" : deltaNational < -0.02 ? "#f0fdf4" : "#f8fafc",
                borderRadius: 8,
                padding: "6px 12px",
                fontSize: "0.82rem",
                color: deltaNational > 0.02 ? "#b91c1c" : deltaNational < -0.02 ? "#15803d" : "#334155",
                fontWeight: 600,
              }}
            >
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

      <InterpretationHelp topic="Cobertura 4G entre municipios" caption="¿Qué veo aquí?" heading="¿Qué veo aquí?">
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7, color: "#334155" }}>
          <li>
            <strong>Línea gris</strong> = todos los municipios con la misma cobertura (lo ideal).
          </li>
          <li>
            <strong>Línea azul</strong> = lo que pasa en realidad.
          </li>
          <li>
            <strong>Sombra</strong> = la diferencia entre ambas. Más sombra = mayor diferencia entre municipios.
          </li>
        </ul>
        {Number.isFinite(gini) && Number.isFinite(nationalGini) ? (
          <p style={{ background: "#eff6ff", borderRadius: 8, padding: "8px 10px", border: "1px solid #bfdbfe", marginTop: 10, marginBottom: 0 }}>
            {giniCompareSentence(gini, deltaNational, nationalGini)}
          </p>
        ) : null}
        {halfCoverage !== null ? (
          <p style={{ background: "#fefce8", borderRadius: 8, padding: "8px 10px", border: "1px solid #fde68a", marginTop: 10, marginBottom: 0 }}>
            La mitad de la población con menos cobertura concentra el{" "}
            <strong>{(halfCoverage * 100).toFixed(1)}%</strong> del total. En un reparto más parejo, sería cerca del 50%.
          </p>
        ) : null}
      </InterpretationHelp>

      <div className="chart-frame" style={{ height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 12, right: 20, left: 0, bottom: 8 }}>
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
              label={{ value: "Cobertura →", angle: -90, position: "insideLeft", offset: 12, fontSize: 11, fill: "#94a3b8" }}
              tick={{ fontSize: 11 }}
              width={48}
            />
            <Tooltip
              formatter={(value: number, name: string) =>
                name === "Desigualdad" || name === "_base" ? null : [`${(value * 100).toFixed(1)}%`, name]
              }
              labelFormatter={(_, payload) =>
                payload?.[0]?.payload
                  ? `Población: ${(payload[0].payload.popShare * 100).toFixed(1)}%`
                  : ""
              }
              contentStyle={{ fontSize: "0.82rem", borderRadius: 8 }}
            />

            {/* Sombra = franja entre curva real (lorenz) e igualdad (equality), vía stack */}
            <Area
              type="monotone"
              dataKey="lorenz"
              name="_base"
              stackId="lorenzBand"
              stroke="none"
              fill="transparent"
              fillOpacity={0}
              isAnimationActive={false}
              legendType="none"
            />
            <Area
              type="monotone"
              dataKey="giniGap"
              name="Desigualdad"
              stackId="lorenzBand"
              stroke="none"
              fill="#93c5fd"
              fillOpacity={0.45}
              isAnimationActive={false}
              legendType="none"
            />

            <Line
              type="linear"
              dataKey="equality"
              name="Todos iguales"
              stroke="#94a3b8"
              strokeDasharray="6 4"
              dot={false}
              strokeWidth={1.5}
              isAnimationActive={false}
            />

            <Line
              type="monotone"
              dataKey="lorenz"
              name="Cobertura real"
              stroke="#2563eb"
              dot={false}
              strokeWidth={2.5}
              isAnimationActive={false}
            />

            <ReferenceLine
              x={0.5}
              stroke="#cbd5e1"
              strokeDasharray="4 3"
              label={{ value: "50%", position: "top", fontSize: 10, fill: "#94a3b8" }}
            />

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
        Punto azul = cobertura de la mitad con menos acceso. Más sombra = mayor diferencia entre municipios.
      </p>
    </div>
  );
}
