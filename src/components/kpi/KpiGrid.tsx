import KpiCard, { type KpiCardProps } from "./KpiCard";

type Props = { cards: KpiCardProps[] };

export default function KpiGrid({ cards }: Props) {
  return (
    <div className="kpi-grid-v2">
      {cards.map((card) => (
        <KpiCard key={card.label} {...card} />
      ))}
    </div>
  );
}
