import InterpretationHelp from "./InterpretationHelp";
import { getStrongestPairInterpretation } from "./pairInterpretations";
import { ANALYSIS_METRICS } from "./analysisMetrics";

function cellColor(r: number | null): string {
  if (r === null || Number.isNaN(r)) {
    return "#f1f5f9";
  }
  const t = Math.max(-1, Math.min(1, r));
  if (t < 0) {
    // negativo: rojo intenso -> rojo claro cercano a cero
    const x = Math.abs(t);
    const rCh = Math.round(185 + x * 35);
    const gCh = Math.round(60 + (1 - x) * 120);
    const bCh = Math.round(70 + (1 - x) * 120);
    return `rgb(${rCh}, ${gCh}, ${bCh})`;
  }
  // positivo: azul claro cercano a cero -> azul intenso
  const x = t;
  const rCh = Math.round(235 - x * 125);
  const gCh = Math.round(245 - x * 105);
  const bCh = Math.round(255 - x * 20);
  return `rgb(${rCh}, ${gCh}, ${bCh})`;
}

type Props = {
  labels: string[];
  matrix: (number | null)[][];
  title?: string;
  /** Número de municipios del estado (para texto dinámico en la ayuda). */
  nMunicipios?: number;
};

export default function SpearmanHeatmap({
  labels,
  matrix,
  title = "Spearman entre municipios del estado",
  nMunicipios
}: Props) {
  const pairs: { i: number; j: number; value: number }[] = [];
  for (let i = 0; i < matrix.length; i++) {
    for (let j = i + 1; j < matrix[i].length; j++) {
      const v = matrix[i][j];
      if (typeof v === "number" && Number.isFinite(v)) {
        pairs.push({ i, j, value: v });
      }
    }
  }
  const strongestPositive = pairs.filter((p) => p.value > 0).sort((a, b) => b.value - a.value)[0];
  const strongestNegative = pairs.filter((p) => p.value < 0).sort((a, b) => a.value - b.value)[0];

  return (
    <div>
      <div className="section-heading">
        <h2>{title}</h2>
        <p>
          Cada celda muestra la asociación de rangos entre dos variables municipales. Valores cercanos a +1
          implican que ambas variables tienden a subir juntas; cercanos a -1, que una sube cuando la otra baja.
          Es lectura asociativa (no causal) y requiere al menos 5 municipios con datos válidos por par.
        </p>
      </div>
      <InterpretationHelp
        topic="Matriz de correlaciones de Spearman entre variables municipales"
        caption="Ayuda: matriz Spearman"
        heading="Interpretación posible"
      >
        {typeof nMunicipios === "number" ? (
          <p>
            Calculada con <strong>{nMunicipios}</strong> municipios del estado. Con pocos municipios los
            coeficientes pueden ser sensibles a outliers, por lo que conviene leerlos junto a la dispersión.
          </p>
        ) : null}
        <p>
          Valores cerca de <strong>+1</strong> indicarían que las dos variables tienden a subir juntas;
          cerca de <strong>-1</strong>, que una sube cuando la otra baja; cerca de <strong>0</strong>,
          que no se observa relación monótona clara. <em>Asociación no implica causalidad</em>: estos números
          ayudan a describir patrones, no a confirmar mecanismos.
        </p>
        {(() => {
          const keys = ANALYSIS_METRICS.map((m) => m.key);
          const posInterp = getStrongestPairInterpretation(labels, keys, matrix, "positive");
          const negInterp = getStrongestPairInterpretation(labels, keys, matrix, "negative");
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {posInterp ? (
                <p style={{ background: "#f0fdf4", borderRadius: 8, padding: "8px 10px", border: "1px solid #bbf7d0" }}>
                  <strong>Asociación positiva más marcada:</strong> {posInterp}
                </p>
              ) : null}
              {negInterp ? (
                <p style={{ background: "#fef2f2", borderRadius: 8, padding: "8px 10px", border: "1px solid #fecaca" }}>
                  <strong>Asociación negativa más marcada:</strong> {negInterp}
                </p>
              ) : null}
            </div>
          );
        })()}
        <p style={{ fontSize: "0.82rem", color: "#64748b" }}>
          Las lecturas son indicativas: para validar un patrón conviene abrir la dispersión del par,
          revisar outliers y contrastar con conocimiento del territorio.
        </p>
      </InterpretationHelp>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", fontSize: "0.85rem", width: "100%", minWidth: 620 }}>
          <thead>
            <tr>
              <th
                style={{
                  border: "1px solid #e2e8f0",
                  padding: 6,
                  background: "#f8fafc",
                  position: "sticky",
                  left: 0,
                  zIndex: 1
                }}
              />
              {labels.map((lab) => (
                <th
                  key={lab}
                  style={{
                    border: "1px solid #e2e8f0",
                    padding: 8,
                    background: "#f8fafc",
                    maxWidth: 120,
                    fontWeight: 600,
                    lineHeight: 1.2
                  }}
                  title={lab}
                >
                  {lab.replace("% ", "").slice(0, 18)}
                  {lab.length > 18 ? "…" : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => (
              <tr key={labels[i]}>
                <th
                  style={{
                    border: "1px solid #e2e8f0",
                    padding: 8,
                    background: "#f8fafc",
                    textAlign: "left",
                    maxWidth: 160,
                    lineHeight: 1.2,
                    position: "sticky",
                    left: 0
                  }}
                  title={labels[i]}
                >
                  {labels[i]}
                </th>
                {row.map((cell, j) => (
                  <td
                    key={`${i}-${j}`}
                    style={{
                      border: "1px solid #e2e8f0",
                      textAlign: "center",
                      padding: 7,
                      background: cellColor(cell),
                      color: "#0f172a",
                      fontVariantNumeric: "tabular-nums",
                      fontWeight: i === j ? 700 : 500
                    }}
                    title={`${labels[i]} vs ${labels[j]}`}
                  >
                    {cell === null ? "—" : cell === 1 && i === j ? "1" : cell.toFixed(2)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: "0.8rem", color: "#64748b", marginTop: 8 }}>
        Escala divergente: rojo (negativo), claro (cercano a 0), azul (positivo). La diagonal vale 1 por definición.
      </p>
    </div>
  );
}
