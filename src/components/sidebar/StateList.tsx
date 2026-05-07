type Props = {
  states: string[];
  selected: string[];
  onToggle: (state: string) => void;
};

export default function StateList({ states, selected, onToggle }: Props) {
  return (
    <div className="state-list" role="listbox" aria-multiselectable="true">
      {states.length === 0 && <p className="state-list__empty">Sin resultados</p>}
      {states.map((state) => {
        const isSelected = selected.includes(state);
        return (
          <button
            key={state}
            className={`state-list__btn${isSelected ? " selected" : ""}`}
            role="option"
            aria-selected={isSelected}
            onClick={() => onToggle(state)}
            type="button"
          >
            {state}
          </button>
        );
      })}
    </div>
  );
}
