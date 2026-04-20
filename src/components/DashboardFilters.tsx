type DashboardFiltersProps = {
  states: string[];
  selectedStates: string[];
  onToggleState: (stateName: string) => void;
};

export default function DashboardFilters({
  states,
  selectedStates,
  onToggleState
}: DashboardFiltersProps) {
  return (
    <div className="controls-layout">
      <div className="filters-heading">
        <div>
          <p className="eyebrow dark">Filtros globales</p>
          <h2>Comparativo entre estados</h2>
          <p>Selecciona la muestra territorial que alimenta los cinco dashboards y actualiza todos los comparativos en la misma vista.</p>
        </div>
      </div>

      <div>
        <span className="filter-label">Estados a comparar</span>
        <div className="state-chip-group">
          {states.map((state) => {
            const isSelected = selectedStates.includes(state);

            return (
              <button
                className={isSelected ? "state-chip active" : "state-chip"}
                key={state}
                onClick={() => onToggleState(state)}
                type="button"
              >
                {state}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
