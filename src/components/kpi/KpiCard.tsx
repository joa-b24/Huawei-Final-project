import { formatDelta, formatValue } from "../../lib/format";
import type { MetricPolaridad, TipoValor } from "../../types/dataStandard";

export type KpiCardProps = {
  label: string;
  value: number | null;
  unit?: string;
  tipoValor?: TipoValor;
  delta?: number | null;
  direction?: MetricPolaridad;
  isOutlier?: boolean;
};

export default function KpiCard({
  label,
  value,
  tipoValor = "number",
  delta,
  direction = "higher_better",
  isOutlier = false,
}: KpiCardProps) {
  const isMissing = value === null || value === undefined;
  const deltaDisplay = formatDelta(delta, direction, tipoValor);

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

      {isOutlier && (
        <p className="kpi-card-v2__outlier" role="status">
          ⚠ Valor atípico
        </p>
      )}
    </article>
  );
}
