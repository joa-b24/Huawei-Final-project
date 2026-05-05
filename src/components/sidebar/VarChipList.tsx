type VarItem = { id: string; label: string };

type Props = {
  vars: VarItem[];
  activeIds: string[];
  maxActive?: number;
  onToggle: (id: string) => void;
};

export default function VarChipList({ vars, activeIds, maxActive = 5, onToggle }: Props) {
  const atLimit = activeIds.length >= maxActive;

  return (
    <div className="var-chip-list">
      {vars.map(({ id, label }) => {
        const isActive = activeIds.includes(id);
        const isDisabled = !isActive && atLimit;
        return (
          <button
            key={id}
            type="button"
            className={`var-chip${isActive ? " active" : ""}${isDisabled ? " disabled" : ""}`}
            onClick={() => { if (!isDisabled) onToggle(id); }}
            aria-pressed={isActive}
            title={isDisabled ? `Máximo ${maxActive} variables activas` : label}
          >
            <span className="var-chip__dot" aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
