type Props = { value: string; onChange: (v: string) => void; placeholder?: string };

export default function StateSearch({ value, onChange, placeholder = "Buscar..." }: Props) {
  return (
    <input
      className="state-search"
      type="search"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={placeholder}
    />
  );
}
