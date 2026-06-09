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
import ChartWrapper from "../charts/ChartWrapper";

type Props = {
  title: string;
  description: string;
  points: LorenzPoint[];
  gini: number;
  nationalGini?: number;
  tooltip?: React.ReactNode;
  aggregationLabel?: string;
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
  const nat = formatGiniValue(national);
  if (g < 0.01)
    return `Gini ${formatGiniValue(g)}: distribución prácticamente uniforme entre municipios. El estado está por debajo del promedio nacional (${nat}), lo que indica equidad territorial alta.`;

  if (g < 0.12) {
    const pos = delta > 0.02 ? `ligeramente por encima del promedio nacional (${nat})` : delta < -0.02 ? `por debajo del promedio nacional (${nat}), con mejor equidad relativa` : `en línea con el promedio nacional (${nat})`;
    return `Gini ${formatGiniValue(g)}: desigualdad baja. La mayor parte de los municipios tiene niveles similares. El estado se ubica ${pos}.`;
  }
  if (g < 0.25) {
    const pos = delta > 0.02 ? `por encima del promedio nacional (${nat})` : delta < -0.02 ? `por debajo del promedio nacional (${nat})` : `cerca del promedio nacional (${nat})`;
    return `Gini ${formatGiniValue(g)}: concentración moderada. Existe variación notable entre municipios. El estado queda ${pos}.`;
  }
  if (g < 0.45) {
    const cmp = delta > 0.02 ? `supera al promedio nacional (${nat}), lo que sugiere una problemática territorial más aguda que la norma` : delta < -0.02 ? `es menor que el promedio nacional (${nat}), aunque sigue siendo alta` : `es similar al promedio nacional (${nat})`;
    return `Gini ${formatGiniValue(g)}: concentración alta. La variable se distribuye de forma claramente desigual entre municipios. La desigualdad del estado ${cmp}.`;
  }
  const cmp = delta > 0.02 ? `notablemente superior al promedio nacional (${nat})` : delta < -0.02 ? `inferior al promedio nacional (${nat}), aunque en nivel crítico` : `en nivel similar al promedio nacional (${nat})`;
  return `Gini ${formatGiniValue(g)}: concentración crítica. El servicio se acumula en muy pocos municipios, señal de rezago estructural. Su nivel de desigualdad es ${cmp}.`;
}

export default function LorenzCurveChart({ title, description, points, gini, nationalGini, tooltip, aggregationLabel = "población" }: Props) {
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
    <ChartWrapper
      panelTitle="Curva de Lorenz"
      tooltip={tooltip}
      chartType="Curva de Lorenz"
      standalone
    >
    <div>
      {/* Header */}
      <div className="section-heading">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1 }}>
            {title ? <h2 style={{ margin: 0 }}>{title}</h2> : null}
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

      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", margin: "8px 0 4px" }}>
        {[
          { stroke: "#94a3b8", dash: "6 4", label: "Igualdad perfecta" },
          { stroke: "#2563eb", dash: undefined, label: "Distribución real" },
          { fill: colors.fill, label: "Brecha de desigualdad" },
        ].map(({ stroke, dash, fill, label }) => (
          <span key={label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--text-2)" }}>
            {fill ? (
              <span style={{ width: 14, height: 10, borderRadius: 2, background: fill, opacity: 0.7, display: "inline-block", flexShrink: 0 }} />
            ) : (
              <svg width={18} height={10} style={{ flexShrink: 0 }}>
                <line x1={0} y1={5} x2={18} y2={5} stroke={stroke} strokeWidth={2} strokeDasharray={dash} />
              </svg>
            )}
            {label}
          </span>
        ))}
      </div>

      {/* Chart */}
      <div className="chart-frame">
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
              label={{ value: `${aggregationLabel.charAt(0).toUpperCase() + aggregationLabel.slice(1)} acumulada →`, position: "insideBottom", offset: -4, fontSize: 11, fill: "#94a3b8" }}
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
              content={({ payload }) => {
                if (!payload?.length) return null;
                const d = payload[0]?.payload;
                if (!d || d.lorenz === undefined) return null;
                const gap = d.equality - d.lorenz;
                return (
                  <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", fontSize: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
                    <div style={{ fontWeight: 700, marginBottom: 6, color: "#1e293b" }}>
                      {(d.popShare * 100).toFixed(1)}% de {aggregationLabel}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 10, rowGap: 3 }}>
                      <span style={{ color: "#94a3b8" }}>Cobertura real:</span>
                      <span style={{ fontWeight: 600, color: "#2563eb" }}>{(d.lorenz * 100).toFixed(1)}%</span>
                      <span style={{ color: "#94a3b8" }}>Distribución parejo:</span>
                      <span style={{ color: "#64748b" }}>{(d.equality * 100).toFixed(1)}%</span>
                      <span style={{ color: "#94a3b8" }}>Brecha:</span>
                      <span style={{ fontWeight: 600, color: gap > 0.05 ? "#b91c1c" : gap > 0.02 ? "#b45309" : "#16a34a" }}>
                        {gap > 0 ? "−" : "+"}{(Math.abs(gap) * 100).toFixed(1)} pp
                      </span>
                    </div>
                  </div>
                );
              }}
            />

            {/* Lorenz base (transparent) — establishes stack baseline so giniGap renders above the curve */}
            <Area
              type="monotone"
              dataKey="lorenz"
              name="Lorenz"
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
              name="Lorenz"
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

      {Number.isFinite(gini) && nationalGini != null && Number.isFinite(nationalGini) ? (
        <p style={{ marginTop: 8, fontSize: "0.78rem", color: "#64748b", marginBottom: 0, lineHeight: 1.5 }}>
          {giniCompareSentence(gini, deltaNational, nationalGini)}
        </p>
      ) : (
        <p style={{ marginTop: 8, fontSize: "0.78rem", color: "#94a3b8", marginBottom: 0 }}>
          Punto azul = valor acumulado de la mitad con menor acceso. Más sombra = mayor diferencia entre municipios.
        </p>
      )}
    </div>
    </ChartWrapper>
  );
}
