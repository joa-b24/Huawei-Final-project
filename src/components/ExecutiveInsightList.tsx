type ExecutiveInsightListProps = {
  insights: string[];
};

export default function ExecutiveInsightList({ insights }: ExecutiveInsightListProps) {
  return (
    <div>
      <div className="section-heading">
        <h2>Insights ejecutivos</h2>
        <p>Lecturas automaticas para orientar una primera conversacion estrategica.</p>
      </div>

      {insights.length > 0 ? (
        <div className="insight-list">
          {insights.map((insight) => (
            <article className="insight-card" key={insight}>
              <p>{insight}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state compact">
          <h2>Sin insights disponibles</h2>
          <p>Los insights se activan cuando la muestra territorial tiene estados seleccionados.</p>
        </div>
      )}
    </div>
  );
}
