import type { MetricDefinition, StateMetricRecord } from "../types/dataset";

type OpportunityRecord = StateMetricRecord & {
  opportunityScore: number;
  marketAttractiveness: number;
  whitespaceScore: number;
};

type OpportunityKpiGridProps = {
  records: OpportunityRecord[];
  focusMetric: MetricDefinition;
};

export default function OpportunityKpiGrid({
  records,
  focusMetric
}: OpportunityKpiGridProps) {
  const sorted = [...records].sort((left, right) => right.opportunityScore - left.opportunityScore);
  const leader = sorted[0];
  const average =
    sorted.reduce((total, record) => total + record.opportunityScore, 0) / sorted.length;

  return (
    <div className="kpi-grid executive-kpi-grid">
      <article className="kpi-card kpi-warm">
        <span>Territorio prioritario</span>
        <strong>{leader.state}</strong>
        <p className="kpi-helper">{leader.opportunityScore.toFixed(1)} pts de oportunidad total</p>
      </article>

      <article className="kpi-card kpi-cool">
        <span>Promedio del score</span>
        <strong>{average.toFixed(1)} pts</strong>
        <p className="kpi-helper">Referencia ejecutiva para comparar la muestra</p>
      </article>

      <article className="kpi-card kpi-neutral">
        <span>Variable foco</span>
        <strong>{focusMetric.label}</strong>
        <p className="kpi-helper">Usada para contextualizar el score estrategico</p>
      </article>
    </div>
  );
}
