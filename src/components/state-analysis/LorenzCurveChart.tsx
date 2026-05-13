import { Area, ComposedChart, CartesianGrid, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { LorenzPoint } from "../../utils/gini";
import InterpretationHelp from "./InterpretationHelp";

type Props = {
  title: string;
  description: string;
  points: LorenzPoint[];
  gini: number;
  nationalGini: number;
};

function coverageShareAtHalfPopulation(points: LorenzPoint[]): number | null {
  if (points.length < 2) {
    return null;
  }
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a.popShare <= 0.5 && b.popShare >= 0.5) {
      const range = b.popShare - a.popShare;
      if (range <= 0) {
        return a.lorenz;
      }
      const t = (0.5 - a.popShare) / range;
      return a.lorenz + t * (b.lorenz - a.lorenz);
    }
  }
  return null;
}

export default function LorenzCurveChart({ title, description, points, gini, nationalGini }: Props) {
  const data =
    points.length > 0
      ? points.map((p) => ({ ...p, giniGap: Math.max(0, p.equality - p.lorenz) }))
      : [
          { popShare: 0, lorenz: 0, equality: 0, giniGap: 0 },
          { popShare: 1, lorenz: 1, equality: 1, giniGap: 0 }
        ];
  const halfCoverage = coverageShareAtHalfPopulation(data);
  const deltaNational =
    Number.isFinite(gini) && Number.isFinite(nationalGini) ? gini - nationalGini : Number.NaN;

  return (
    <div>
      <div className="section-heading">
        <h2>{title}</h2>
        <p>{description}</p>
        <p style={{ marginTop: 6, color: "#1e293b" }}>
          <strong>Gini estatal: {Number.isFinite(gini) ? gini.toFixed(3) : "—"}</strong>
          {" · "}
          Nacional: {Number.isFinite(nationalGini) ? nationalGini.toFixed(3) : "—"}
          {" · "}
          Delta: {Number.isFinite(deltaNational) ? `${deltaNational >= 0 ? "+" : ""}${deltaNational.toFixed(3)}` : "—"}
        </p>
        <p style={{ marginTop: 4, fontSize: "0.85rem", color: "#475569" }}>
          {halfCoverage !== null
            ? `El 50% de la población con menor cobertura concentra ${(
                halfCoverage * 100
              ).toFixed(1)}% de la cobertura 4G acumulada.`
            : "No hay suficientes puntos para calcular la lectura al 50%."}
        </p>
      </div>
      <InterpretationHelp
        topic="Curva de Lorenz y coeficiente de Gini (cobertura 4G poblacional)"
        caption="Ayuda: Lorenz y Gini"
        heading="Interpretación posible"
      >
        <p>
          <strong>La diagonal</strong> representaría el escenario de igualdad perfecta: todos los municipios
          con la misma cobertura. Mientras más se aleje la curva azul de esa diagonal, más concentrada parecería
          estar la cobertura en una parte de los municipios.
        </p>
        <p>
          <strong>El área sombreada</strong> equivale al Gini visualmente: más área tiende a indicar mayor
          desigualdad territorial, aunque el valor por sí solo no explica las causas.
        </p>
        {Number.isFinite(gini) && Number.isFinite(nationalGini) ? (
          <p style={{ background: "#eff6ff", borderRadius: 8, padding: "8px 10px", border: "1px solid #bfdbfe" }}>
            <strong>Lectura indicativa:</strong>{" "}
            {gini < 0.05
              ? "el indicador apunta a una distribución prácticamente homogénea entre los municipios del estado. Esto podría interpretarse como que la cobertura 4G estaría llegando de forma relativamente pareja, sin un grupo claramente rezagado en términos relativos."
              : gini < 0.15
                ? "se observaría una distribución moderadamente homogénea, con algunas diferencias entre municipios. El grueso parecería estar cubierto en proporciones similares, mientras que un subconjunto se quedaría algo por debajo."
                : gini < 0.3
                  ? "el indicador sugeriría una brecha territorial perceptible: una parte del estado concentraría la cobertura mientras otra quedaría rezagada. La forma exacta dependería de qué municipios componen cada extremo."
                  : "el indicador apuntaría a una concentración alta de la cobertura en pocos municipios, con una cola significativa que estaría poco cubierta en términos relativos."}
            {" "}(Gini estatal {gini.toFixed(3)} · nacional {nationalGini.toFixed(3)} · delta{" "}
            {gini - nationalGini >= 0 ? "+" : ""}
            {(gini - nationalGini).toFixed(3)}
            {Number.isFinite(deltaNational) && Math.abs(deltaNational) > 0.01
              ? deltaNational > 0
                ? ", por encima del promedio nacional"
                : ", por debajo del promedio nacional"
              : ", cercano al promedio nacional"}
            ).
          </p>
        ) : null}
        {halfCoverage !== null ? (
          <p style={{ background: "#fefce8", borderRadius: 8, padding: "8px 10px", border: "1px solid #fde68a" }}>
            <strong>Dato puntual:</strong> el 50% de la población con menor cobertura acumularía{" "}
            <strong>{(halfCoverage * 100).toFixed(1)}%</strong> de la cobertura 4G del estado.
            {halfCoverage < 0.35
              ? " Es una proporción que estaría bastante por debajo de lo que correspondería en una repartición pareja, lo que reforzaría la idea de concentración."
              : halfCoverage < 0.45
                ? " Hay un sesgo moderado: la mitad menos cubierta recibiría algo menos de la mitad proporcional."
                : " Esa proporción se acercaría bastante a una repartición proporcional entre municipios."}
          </p>
        ) : null}
        <p style={{ fontSize: "0.82rem", color: "#64748b" }}>
          El Gini resume desigualdad pero no explica sus causas. Conviene contrastarlo con otras variables
          (escolaridad, estructura etaria, geografía) antes de derivar conclusiones.
        </p>
      </InterpretationHelp>
      <div className="chart-frame">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="popShare"
              domain={[0, 1]}
              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              name="Población acumulada"
            />
            <YAxis
              type="number"
              domain={[0, 1]}
              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              name="Cobertura acumulada"
            />
            <Tooltip
              formatter={(value: number) => `${(value * 100).toFixed(1)}%`}
              labelFormatter={(_, payload) =>
                payload?.[0]?.payload ? `Población acum.: ${(payload[0].payload.popShare * 100).toFixed(1)}%` : ""
              }
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="giniGap"
              name="Área que determina el Gini"
              fill="#93c5fd"
              stroke="none"
              fillOpacity={0.45}
              isAnimationActive={false}
            />
            <Line type="monotone" dataKey="lorenz" name="Lorenz (cobertura)" stroke="#2563eb" dot={false} strokeWidth={2} />
            <Line
              type="linear"
              dataKey="equality"
              name="Igualdad perfecta"
              stroke="#94a3b8"
              strokeDasharray="6 4"
              dot={false}
              strokeWidth={1.5}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p style={{ marginTop: 8, fontSize: "0.82rem", color: "#64748b" }}>
        La zona sombreada entre la diagonal y la curva resume la desigualdad: a mayor área, mayor concentración de cobertura.
      </p>
    </div>
  );
}
