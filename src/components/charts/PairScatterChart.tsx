import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import EmptyState from "../EmptyState";

export type ScatterPoint = { state: string; x: number; y: number };

type Props = {
  data: ScatterPoint[];
  xLabel: string;
  yLabel: string;
  highlightState?: string;
  xUnit?: string;
  yUnit?: string;
  groupStateColors?: Map<string, string>;
  groupLegend?: { label: string; color: string }[];
  chartHeight?: number;
};

function scatterStrength(r2: number): { label: string; level: "strong" | "moderate" | "weak" | "none" } {
  const r = Math.sqrt(r2);
  if (r >= 0.7) return { label: "Relación fuerte", level: "strong" };
  if (r >= 0.4) return { label: "Relación moderada", level: "moderate" };
  if (r >= 0.2) return { label: "Relación débil", level: "weak" };
  return { label: "Sin relación clara", level: "none" };
}

function linearReg(pts: ScatterPoint[]) {
  const n = pts.length;
  if (n < 2) return { slope: 0, intercept: 0, r2: 0 };
  const xm = pts.reduce((s, p) => s + p.x, 0) / n;
  const ym = pts.reduce((s, p) => s + p.y, 0) / n;
  const ssxy = pts.reduce((s, p) => s + (p.x - xm) * (p.y - ym), 0);
  const ssx = pts.reduce((s, p) => s + (p.x - xm) ** 2, 0);
  const ssy = pts.reduce((s, p) => s + (p.y - ym) ** 2, 0);
  const slope = ssx === 0 ? 0 : ssxy / ssx;
  const r2 = ssx === 0 || ssy === 0 ? 0 : ssxy ** 2 / (ssx * ssy);
  return { slope, intercept: ym - slope * xm, r2 };
}

function detectOutliers(pts: ScatterPoint[]): Set<string> {
  if (pts.length < 6) return new Set();
  const { slope, intercept } = linearReg(pts);
  const residuals = pts.map((p) => p.y - (slope * p.x + intercept));
  const sorted = [...residuals].sort((a, b) => a - b);
  const n = sorted.length;
  const q1 = sorted[Math.floor(n * 0.25)];
  const q3 = sorted[Math.floor(n * 0.75)];
  const iqr = q3 - q1;
  if (iqr === 0) return new Set();
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;
  return new Set(pts.filter((_, i) => residuals[i] < lower || residuals[i] > upper).map((p) => p.state));
}

const CustomDot = (props: any) => {
  const { cx, cy, payload, highlightState, outlierStates, groupStateColors } = props;
  const isHighlight = payload.state === highlightState;
  const isOutlier = outlierStates?.has(payload.state);
  const groupColor: string | undefined = groupStateColors?.get(payload.state);
  const fillColor = isOutlier ? "var(--text-3)" : isHighlight ? "var(--blue)" : (groupColor ?? "#93c5fd");
  return (
    <g opacity={isOutlier ? 0.3 : 1}>
      {isHighlight && !isOutlier && <circle cx={cx} cy={cy} r={10} fill="var(--blue)" opacity={0.15} />}
      {groupColor && !isHighlight && !isOutlier && <circle cx={cx} cy={cy} r={7} fill={groupColor} opacity={0.18} />}
      <circle
        cx={cx} cy={cy}
        r={isHighlight ? 6 : 4}
        fill={fillColor}
        stroke="#fff"
        strokeWidth={1}
      />
      {isHighlight && !isOutlier && (
        <text x={cx + 8} y={cy - 8} fontSize={10} fill="var(--text-2)" fontWeight={600}>
          {payload.state}
        </text>
      )}
    </g>
  );
};

export default function PairScatterChart({ data, xLabel, yLabel, highlightState, xUnit = "", yUnit = "", groupStateColors, groupLegend, chartHeight = 320 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [excludeOutliers, setExcludeOutliers] = useState(false);
  const dragStart = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);

  // Reset zoom + pan + outlier toggle when variables change
  useEffect(() => { setZoomLevel(1); setPanX(0); setPanY(0); setExcludeOutliers(false); }, [xLabel, yLabel]);

  const outlierStates = useMemo(() => detectOutliers(data), [data]);
  const regressionData = excludeOutliers ? data.filter((p) => !outlierStates.has(p.state)) : data;

  // Non-passive wheel listener for zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.5 : 1 / 1.5;
      setZoomLevel((z) => Math.min(20, Math.max(1, z * factor)));
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  if (data.length < 3) {
    return <EmptyState title="Datos insuficientes" description="Se necesitan al menos 3 estados con dato en ambas variables." />;
  }

  const { slope, intercept, r2 } = linearReg(regressionData);
  const { label: strengthLabel, level: strengthLevel } = scatterStrength(r2);
  const xs = data.map((d) => d.x);
  const ys = data.map((d) => d.y);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const xPad = Math.max((xMax - xMin) * 0.08, 1);
  const yPad = Math.max((yMax - yMin) * 0.08, 1);

  const xCenter = (xMin + xMax) / 2;
  const yCenter = (yMin + yMax) / 2;
  const xHalf = (xMax - xMin) / 2 + xPad;
  const yHalf = (yMax - yMin) / 2 + yPad;
  const xDomain: [number, number] = [xCenter + panX - xHalf / zoomLevel, xCenter + panX + xHalf / zoomLevel];
  const yDomain: [number, number] = [yCenter + panY - yHalf / zoomLevel, yCenter + panY + yHalf / zoomLevel];

  function handleMouseDown(e: ReactMouseEvent) {
    if (zoomLevel <= 1) return;
    dragStart.current = { mx: e.clientX, my: e.clientY, px: panX, py: panY };
  }

  function handleMouseMove(e: ReactMouseEvent) {
    if (!dragStart.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const chartW = Math.max(rect.width - 96, 1); // subtract margins + YAxis width
    const chartH = chartHeight - 36; // height - top(8) - bottom(28) margins
    const dx = e.clientX - dragStart.current.mx;
    const dy = e.clientY - dragStart.current.my;
    setPanX(dragStart.current.px - (dx / chartW) * (2 * xHalf / zoomLevel));
    setPanY(dragStart.current.py + (dy / chartH) * (2 * yHalf / zoomLevel));
  }

  function handleMouseUp() { dragStart.current = null; }
  function handleMouseLeave() { dragStart.current = null; }

  const trendPoints = [
    { x: xMin, yTrend: slope * xMin + intercept },
    { x: xMax, yTrend: slope * xMax + intercept },
  ];

  const combined = [
    ...data.map((d) => ({ x: d.x, y: d.y, state: d.state, yTrend: undefined as number | undefined })),
    ...trendPoints.map((t) => ({ x: t.x, y: undefined as number | undefined, state: "", yTrend: t.yTrend })),
  ];

  const isDragging = dragStart.current !== null;
  const cursor = zoomLevel > 1 ? (isDragging ? "grabbing" : "grab") : "default";

  return (
    <div
      ref={containerRef}
      style={{ userSelect: "none", cursor }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      <div className="scatter-summary" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
        <div className="scatter-summary__left">
          <span className={`scatter-summary__badge scatter-summary__badge--${strengthLevel}`}>
            {strengthLabel}
          </span>
          <span className="scatter-summary__phrase">
            {r2 >= 0.04
              ? <>Los estados con más {xLabel} tienden a tener {slope >= 0 ? "mayor" : "menor"} {yLabel}</>
              : <>No se observa una tendencia clara entre estas variables</>
            }
          </span>
        </div>
        <div className="scatter-summary__right" style={{ justifyContent: "center" }}>
          <span className="scatter-summary__r2">r² = {r2.toFixed(2)}</span>
          {excludeOutliers && outlierStates.size > 0 && (
            <span style={{ fontSize: 11, color: "var(--amber)" }}>
              sin {outlierStates.size} atípico{outlierStates.size !== 1 ? "s" : ""}
            </span>
          )}
          {outlierStates.size > 0 && (
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                type="button"
                className={`btn-ghost scatter-outlier-toggle${excludeOutliers ? " active" : ""}`}
                onClick={() => setExcludeOutliers((v) => !v)}
              >
                {excludeOutliers ? "Mostrando atípicos" : `Excluir (${outlierStates.size} atíp.)`}
              </button>
              <span
                title="Excluir atípicos ayuda a comprobar si la relación entre variables se mantiene sin que puntos extremos dominen la tendencia."
                aria-label="Información sobre exclusión de atípicos"
                style={{ cursor: "help", fontSize: 11, color: "var(--text-3)", border: "1px solid var(--border)", borderRadius: "50%", width: 16, height: 16, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
              >
                i
              </span>
            </span>
          )}
          {zoomLevel > 1 && (
            <button
              type="button"
              className="btn-ghost"
              style={{ fontSize: 11, padding: "2px 8px" }}
              onClick={() => { setZoomLevel(1); setPanX(0); setPanY(0); }}
            >
              Restablecer zoom
            </button>
          )}
        </div>
      </div>
      {groupLegend && groupLegend.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, margin: "4px 0 8px" }}>
          {groupLegend.map(({ label, color }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
              <span style={{ color: "var(--text-2)" }}>{label}</span>
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#93c5fd", display: "inline-block", flexShrink: 0 }} />
            <span style={{ color: "var(--text-3)" }}>Resto</span>
          </div>
        </div>
      )}
      <ResponsiveContainer width="100%" height={chartHeight}>
        <ComposedChart data={combined} margin={{ top: 8, right: 24, bottom: 28, left: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            type="number"
            dataKey="x"
            name={xLabel}
            domain={xDomain}
            allowDataOverflow
            tickFormatter={(v: number) => (+v.toFixed(1)).toString()}
            label={{ value: `${xLabel}${xUnit ? ` (${xUnit})` : ""}`, position: "insideBottom", offset: -14, fontSize: 11, fill: "var(--text-3)" }}
            tick={{ fontSize: 11, fill: "var(--text-3)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="number"
            dataKey="y"
            name={yLabel}
            domain={yDomain}
            allowDataOverflow
            tickFormatter={(v: number) => (+v.toFixed(1)).toString()}
            label={{ value: `${yLabel}${yUnit ? ` (${yUnit})` : ""}`, angle: -90, position: "insideLeft", offset: 0, style: { textAnchor: "middle" }, fontSize: 11, fill: "var(--text-3)" }}
            tick={{ fontSize: 11, fill: "var(--text-3)" }}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip
            content={({ payload }) => {
              const p = payload?.[0]?.payload;
              if (!p || !p.state) return null;
              return (
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "8px 12px", fontSize: 12 }}>
                  <strong>{p.state}</strong>
                  <div>{xLabel}: {p.x?.toFixed(1)}</div>
                  <div>{yLabel}: {p.y?.toFixed(1)}</div>
                </div>
              );
            }}
          />
          <Line
            dataKey="yTrend"
            dot={false}
            stroke="var(--text-3)"
            strokeDasharray="5 4"
            strokeWidth={1.5}
            isAnimationActive={false}
            connectNulls={false}
          />
          <Scatter
            dataKey="y"
            data={data}
            shape={(props: any) => <CustomDot {...props} highlightState={highlightState} outlierStates={excludeOutliers ? outlierStates : undefined} groupStateColors={groupStateColors} />}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
