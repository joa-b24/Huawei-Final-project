import type { ComparisonTarget } from "../../context/AppContext";

const OPTIONS: { value: ComparisonTarget; label: string; available: boolean }[] = [
  { value: "nacional", label: "Promedio nacional", available: true },
  { value: "region_norte", label: "Región Norte", available: false },
  { value: "region_noreste", label: "Región Noreste", available: false },
  { value: "region_noroeste", label: "Región Noroeste", available: false },
  { value: "region_centro", label: "Región Centro", available: false },
  { value: "region_oriente", label: "Región Oriente", available: false },
  { value: "region_occidente", label: "Región Occidente", available: false },
  { value: "region_bajio", label: "Región Bajío", available: false },
  { value: "region_sur", label: "Región Sur", available: false },
  { value: "region_sureste", label: "Región Sureste", available: false },
  { value: "cluster_1", label: "Cluster 1 (Fase 2)", available: false },
  { value: "cluster_2", label: "Cluster 2 (Fase 2)", available: false },
  { value: "cluster_3", label: "Cluster 3 (Fase 2)", available: false },
  { value: "cluster_4", label: "Cluster 4 (Fase 2)", available: false },
];

type Props = {
  value: ComparisonTarget;
  onChange: (v: ComparisonTarget) => void;
};

export default function ComparisonSelect({ value, onChange }: Props) {
  return (
    <select
      className="comparison-select"
      value={value}
      onChange={(e) => onChange(e.target.value as ComparisonTarget)}
      aria-label="Comparar con"
    >
      {OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value} disabled={!opt.available}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
