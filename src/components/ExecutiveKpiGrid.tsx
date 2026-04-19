type KpiCard = {
  label: string;
  value: string;
  helper: string;
  tone: "warm" | "cool" | "neutral";
};

type ExecutiveKpiGridProps = {
  cards: KpiCard[];
};

export default function ExecutiveKpiGrid({ cards }: ExecutiveKpiGridProps) {
  return (
    <div className="kpi-grid executive-kpi-grid">
      {cards.map((card) => (
        <article className={`kpi-card kpi-${card.tone}`} key={`${card.label}-${card.value}`}>
          <span>{card.label}</span>
          <strong>{card.value}</strong>
          <p className="kpi-helper">{card.helper}</p>
        </article>
      ))}
    </div>
  );
}
