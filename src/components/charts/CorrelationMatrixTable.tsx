import { corrPValue } from "../../lib/stats";
import { formatPValue } from "../../lib/format";
import type { CorrelationsPayload } from "../../types/dataStandard";
import EmptyState from "../EmptyState";

type Props = {
  payload: CorrelationsPayload;
  variableLabels?: Record<string, string>;
  n?: number;
  maxPairs?: number;
};

type Pair = { var1: string; var2: string; r: number; pValue: number };

export default function CorrelationMatrixTable({ payload, variableLabels = {}, n = 32, maxPairs = 15 }: Props) {
  const { variables, matrix } = payload.pearson;

  if (!variables.length || !matrix.length) {
    return <EmptyState title="Sin correlaciones" description="Ejecuta el pipeline de analytics para generar correlations.json." />;
  }

  const pairs: Pair[] = [];
  for (let i = 0; i < variables.length; i++) {
    for (let j = i + 1; j < variables.length; j++) {
      const r = Array.isArray(matrix[i]) ? matrix[i][j] : 0;
      if (!isNaN(r) && Math.abs(r) < 1) {
        pairs.push({ var1: variables[i], var2: variables[j], r, pValue: corrPValue(r, n) });
      }
    }
  }

  const top = pairs.sort((a, b) => Math.abs(b.r) - Math.abs(a.r)).slice(0, maxPairs);
  const label = (id: string) => variableLabels[id] ?? id;

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="corr-table" aria-label="Top correlaciones">
        <thead>
          <tr>
            <th>Variable 1</th>
            <th>Variable 2</th>
            <th>r (Pearson)</th>
            <th>Sig.</th>
          </tr>
        </thead>
        <tbody>
          {top.map((pair, i) => {
            const isPos = pair.r >= 0;
            const isSig = pair.pValue < 0.05;
            return (
              <tr key={i} className={!isSig ? "corr-ns" : ""}>
                <td>{label(pair.var1)}</td>
                <td>{label(pair.var2)}</td>
                <td className={isPos ? "corr-pos" : "corr-neg"} style={{ fontFamily: "var(--font-mono)" }}>
                  {isPos ? "+" : ""}{pair.r.toFixed(2)}
                </td>
                <td style={{ color: "var(--text-3)" }}>{formatPValue(pair.pValue)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
