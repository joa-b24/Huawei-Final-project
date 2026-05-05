import MissingDataNote from "../feedback/MissingDataNote";

export type BoxplotVariable = {
  id: string;
  label: string;
  values: number[];
  highlightValue?: number | null;
};

type Props = { variables: BoxplotVariable[] };

function quartiles(sorted: number[]) {
  const interp = (arr: number[], idx: number) => {
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    return arr[lo] + (arr[hi] - arr[lo]) * (idx - lo);
  };
  const n = sorted.length;
  return {
    min: sorted[0],
    q1: interp(sorted, (n - 1) * 0.25),
    median: interp(sorted, (n - 1) * 0.5),
    q3: interp(sorted, (n - 1) * 0.75),
    max: sorted[n - 1],
  };
}

function BoxplotSvg({ values, highlightValue }: { values: number[]; highlightValue?: number | null }) {
  const sorted = [...values].sort((a, b) => a - b);
  const { min, q1, median, q3, max } = quartiles(sorted);
  const iqr = q3 - q1;
  const lowerFence = Math.max(min, q1 - 1.5 * iqr);
  const upperFence = Math.min(max, q3 + 1.5 * iqr);
  const outlierPts = sorted.filter((v) => v < lowerFence || v > upperFence);

  const W = 400, H = 40, PAD = 20;
  const usableW = W - PAD * 2;
  const range = upperFence - lowerFence || 1;
  const scale = (v: number) => PAD + ((Math.max(lowerFence, Math.min(upperFence, v)) - lowerFence) / range) * usableW;
  const scaleRaw = (v: number) => PAD + ((v - lowerFence) / range) * usableW;
  const CY = H / 2;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H, display: "block" }}>
      {/* Whiskers */}
      <line x1={scale(lowerFence)} y1={CY} x2={scale(q1)} y2={CY} stroke="var(--text-3)" strokeWidth={1.5} />
      <line x1={scale(q3)} y1={CY} x2={scale(upperFence)} y2={CY} stroke="var(--text-3)" strokeWidth={1.5} />
      <line x1={scale(lowerFence)} y1={CY - 6} x2={scale(lowerFence)} y2={CY + 6} stroke="var(--text-3)" strokeWidth={1.5} />
      <line x1={scale(upperFence)} y1={CY - 6} x2={scale(upperFence)} y2={CY + 6} stroke="var(--text-3)" strokeWidth={1.5} />
      {/* IQR box */}
      <rect x={scale(q1)} y={CY - 10} width={scale(q3) - scale(q1)} height={20} fill="var(--blue-light)" stroke="var(--blue-mid)" strokeWidth={1.5} rx={2} />
      {/* Median */}
      <line x1={scale(median)} y1={CY - 10} x2={scale(median)} y2={CY + 10} stroke="var(--blue)" strokeWidth={2.5} />
      {/* Outliers */}
      {outlierPts.map((v, i) => (
        <circle key={i} cx={scaleRaw(v)} cy={CY} r={4} fill="none" stroke="var(--amber)" strokeWidth={1.5} />
      ))}
      {/* Highlight */}
      {highlightValue !== null && highlightValue !== undefined && (
        <circle cx={scaleRaw(highlightValue)} cy={CY} r={5} fill="var(--blue)" stroke="#fff" strokeWidth={1.5} />
      )}
    </svg>
  );
}

export default function BoxplotPanel({ variables }: Props) {
  return (
    <div className="boxplot-panel">
      {variables.map((v) => {
        const validValues = v.values.filter((x) => !isNaN(x));
        const missing = v.values.length - validValues.length;
        if (validValues.length < 4) return null;
        return (
          <div key={v.id} className="boxplot-row">
            <span className="boxplot-label" title={v.label}>{v.label}</span>
            <div>
              <BoxplotSvg values={validValues} highlightValue={v.highlightValue} />
              {missing > 0 && <MissingDataNote count={missing} total={v.values.length} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
