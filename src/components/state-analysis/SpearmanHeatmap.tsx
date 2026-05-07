function cellColor(r: number | null): string {
  if (r === null || Number.isNaN(r)) {
    return "#f1f5f9";
  }
  if (r === 1) {
    return "#e0e7ff";
  }
  const t = Math.max(-1, Math.min(1, r));
  if (t >= 0) {
    const x = t;
    const g = Math.round(180 + (1 - x) * 40);
    const b = Math.round(100 + (1 - x) * 80);
    return `rgb(${Math.round(34 + x * 80)}, ${g}, ${b})`;
  }
  const x = -t;
  const red = Math.round(220 - x * 40);
  const green = Math.round(100 + (1 - x) * 60);
  return `rgb(${red}, ${green}, ${Math.round(90 + x * 40)})`;
}

type Props = {
  labels: string[];
  matrix: (number | null)[][];
  title?: string;
};

export default function SpearmanHeatmap({ labels, matrix, title = "Spearman entre municipios del estado" }: Props) {
  return (
    <div>
      <div className="section-heading">
        <h2>{title}</h2>
        <p>
          Cada celda es la correlación de Spearman entre dos variables en los municipios del estado
          seleccionado. Requiere al menos cinco municipios con datos válidos en ambas columnas.
        </p>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", fontSize: "0.75rem", width: "100%", minWidth: 520 }}>
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
                    padding: 6,
                    background: "#f8fafc",
                    maxWidth: 88,
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
                    padding: 6,
                    background: "#f8fafc",
                    textAlign: "left",
                    maxWidth: 120,
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
                      padding: 4,
                      background: cellColor(cell),
                      color: "#0f172a",
                      fontVariantNumeric: "tabular-nums"
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
        Tonos verdes/azules: correlación positiva; tonos rojizos: negativa. La diagonal es 1.
      </p>
    </div>
  );
}
