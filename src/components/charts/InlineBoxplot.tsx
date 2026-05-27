import { useState } from "react";

type Props = {
  stateValues: { state: string; value: number }[];
  highlightState?: string | null;
  domainMin: number;
  domainMax: number;
  nationalMean?: number | null;
  groupMarkers?: { value: number; label: string; color: string }[];
};

function quartiles(sorted: number[]) {
  const interp = (arr: number[], idx: number) => {
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    return arr[lo] + (arr[hi] - arr[lo]) * (idx - lo);
  };
  const n = sorted.length;
  return {
    q1: interp(sorted, (n - 1) * 0.25),
    median: interp(sorted, (n - 1) * 0.5),
    q3: interp(sorted, (n - 1) * 0.75),
  };
}

export default function InlineBoxplot({ stateValues, highlightState, domainMin, domainMax, nationalMean, groupMarkers }: Props) {
  const [tooltip, setTooltip] = useState<{ label: string; sx: number } | null>(null);

  const sorted = [...stateValues].sort((a, b) => a.value - b.value);
  const sortedVals = sorted.map((d) => d.value);
  const { q1, median, q3 } = quartiles(sortedVals);
  const iqr = q3 - q1;
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;
  const whiskerLo = sortedVals.find((v) => v >= lowerFence) ?? lowerFence;
  const whiskerHi = [...sortedVals].reverse().find((v) => v <= upperFence) ?? upperFence;
  const outlierPoints = stateValues.filter((d) => d.value < lowerFence || d.value > upperFence);

  const W = 1000, H = 80, CY = 46, BOX_H = 48;
  const domainRange = domainMax - domainMin || 1;
  const sx = (v: number) => ((v - domainMin) / domainRange) * W;

  function showTip(label: string, x: number) {
    setTooltip({ label, sx: x });
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: H, display: "block", overflow: "visible" }}
      onMouseLeave={() => setTooltip(null)}
    >
      {/* Whiskers */}
      <line x1={sx(whiskerLo)} y1={CY} x2={sx(q1)} y2={CY} stroke="var(--text-3)" strokeWidth={2} />
      <line x1={sx(q3)} y1={CY} x2={sx(whiskerHi)} y2={CY} stroke="var(--text-3)" strokeWidth={2} />
      <line x1={sx(whiskerLo)} y1={CY - 8} x2={sx(whiskerLo)} y2={CY + 8} stroke="var(--text-3)" strokeWidth={2} />
      <line x1={sx(whiskerHi)} y1={CY - 8} x2={sx(whiskerHi)} y2={CY + 8} stroke="var(--text-3)" strokeWidth={2} />

      {/* IQR box */}
      <rect
        x={sx(q1)} y={CY - BOX_H / 2}
        width={sx(q3) - sx(q1)} height={BOX_H}
        fill="var(--blue-light)" stroke="var(--blue-mid)" strokeWidth={2} rx={3}
      />

      {/* National mean line */}
      {nationalMean !== null && nationalMean !== undefined && (
        <>
          <line
            x1={sx(nationalMean)} y1={CY - BOX_H / 2 - 4}
            x2={sx(nationalMean)} y2={CY + BOX_H / 2 + 4}
            stroke="var(--text-3)" strokeDasharray="5 3" strokeWidth={1.5}
          />
          <rect
            x={sx(nationalMean) - 12} y={CY - BOX_H / 2 - 4}
            width={24} height={BOX_H + 8}
            fill="transparent"
            style={{ cursor: "crosshair" }}
            onMouseEnter={() => showTip(`Media nacional: ${nationalMean.toFixed(2)}`, sx(nationalMean))}
            onMouseLeave={() => setTooltip(null)}
          />
        </>
      )}

      {/* Median line */}
      <line x1={sx(median)} y1={CY - BOX_H / 2} x2={sx(median)} y2={CY + BOX_H / 2} stroke="var(--blue)" strokeWidth={3} />
      {/* Median hit area */}
      <rect
        x={sx(median) - 10} y={CY - BOX_H / 2}
        width={20} height={BOX_H}
        fill="transparent"
        style={{ cursor: "crosshair" }}
        onMouseEnter={() => showTip(`Mediana: ${median.toFixed(2)}`, sx(median))}
        onMouseLeave={() => setTooltip(null)}
      />

      {/* Outlier points */}
      {outlierPoints.map((d) => (
        <circle
          key={d.state}
          cx={sx(d.value)} cy={CY} r={9}
          fill="none" stroke="var(--amber)" strokeWidth={4}
          style={{ cursor: "pointer" }}
          onMouseEnter={() => showTip(`${d.state}: ${d.value.toFixed(2)} ⚠ atípico`, sx(d.value))}
          onMouseLeave={() => setTooltip(null)}
        />
      ))}

      {/* Group markers (diamonds) */}
      {groupMarkers?.map((gm, i) => {
        const cx = sx(gm.value);
        const r = 8;
        return (
          <polygon
            key={`gm-${i}`}
            points={`${cx},${CY - r} ${cx + r},${CY} ${cx},${CY + r} ${cx - r},${CY}`}
            fill={gm.color}
            opacity={0.85}
            style={{ cursor: "pointer" }}
            onMouseEnter={() => showTip(`${gm.label}: ${gm.value.toFixed(2)}`, cx)}
            onMouseLeave={() => setTooltip(null)}
          />
        );
      })}

      {/* Highlight state */}
      {highlightState && (() => {
        const d = stateValues.find((v) => v.state === highlightState);
        if (!d) return null;
        return (
          <circle
            cx={sx(d.value)} cy={CY} r={10}
            fill="var(--blue)" stroke="#fff" strokeWidth={4}
            style={{ cursor: "pointer" }}
            onMouseEnter={() => showTip(`${d.state}: ${d.value.toFixed(2)}`, sx(d.value))}
            onMouseLeave={() => setTooltip(null)}
          />
        );
      })()}

      {/* Tooltip */}
      {tooltip && (() => {
        const label = tooltip.label;
        const charW = 16;
        const tw = label.length * charW + 16;
        const tx = Math.min(Math.max(tooltip.sx - tw / 2, 0), W - tw);
        return (
          <g>
            <rect x={tx} y={-6} width={tw} height={32} rx={4} fill="var(--surface)" stroke="var(--border)" strokeWidth={1} />
            <text x={tx + tw / 2} y={17} textAnchor="middle" fontSize={25} fill="var(--text-1)" fontWeight={500}>
              {label}
            </text>
          </g>
        );
      })()}
    </svg>
  );
}
