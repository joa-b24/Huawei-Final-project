import { formatDelta, formatValue } from "../../lib/format";
import type { MetricPolaridad, TipoValor } from "../../types/dataStandard";

export type GroupComparison = { label: string; delta: number | null; color: string };

export type KpiCardProps = {
  label: string;
  value: number | null;
  unit?: string;
  tipoValor?: TipoValor;
  delta?: number | null;
  direction?: MetricPolaridad;
  isOutlier?: boolean;
  comparisonLabel?: string;
  comparisonDelta?: number | null;
  groupComparisons?: GroupComparison[];
};

export default function KpiCard({
  label,
  value,
  tipoValor = "number",
  delta,
  direction = "higher_better",
  isOutlier = false,
  comparisonLabel,
  comparisonDelta,
  groupComparisons,
}: KpiCardProps) {
  const isMissing = value === null || value === undefined;
  const deltaDisplay = formatDelta(delta, direction, tipoValor);
  const compDisplay = comparisonLabel ? formatDelta(comparisonDelta, direction, tipoValor) : null;

  return (
    <article
      className={`kpi-card-v2${isOutlier ? " is-outlier" : ""}`}
      aria-label={label}
    >
      <p className="kpi-card-v2__label">{label}</p>

      <p className={`kpi-card-v2__value${isMissing ? " is-missing" : ""}`}>
        {isMissing ? "N/D" : formatValue(value, tipoValor)}
      </p>

      {deltaDisplay.text && (
        <p className="kpi-card-v2__delta" style={{ color: deltaDisplay.color }}>
          <span aria-hidden="true">{deltaDisplay.arrow}</span>
          {deltaDisplay.text} vs nacional
        </p>
      )}

      {groupComparisons && groupComparisons.length > 0 ? (
        groupComparisons.map((gc, i) => {
          const gcDisplay = formatDelta(gc.delta, direction, tipoValor);
          return gcDisplay.text ? (
            <p key={i} className="kpi-card-v2__delta" style={{ color: gc.color, opacity: 0.85, fontSize: "0.82em" }}>
              <span className="kpi-group-dot" style={{ background: gc.color }} />
              {gcDisplay.arrow} {gcDisplay.text} vs {gc.label}
            </p>
          ) : null;
        })
      ) : compDisplay?.text && comparisonLabel !== "Nacional" ? (
        <p className="kpi-card-v2__delta" style={{ color: compDisplay.color, opacity: 0.8, fontSize: "0.82em" }}>
          <span aria-hidden="true">{compDisplay.arrow}</span>
          {compDisplay.text} vs {comparisonLabel}
        </p>
      ) : null}

      {isOutlier && (
        <p className="kpi-card-v2__outlier" role="status">
          ⚠ Valor atípico
        </p>
      )}
    </article>
  );
}
