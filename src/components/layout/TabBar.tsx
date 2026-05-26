export type Tab = { id: string; label: string; disabled?: boolean; disabledReason?: string };

type Props = {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
};

export default function TabBar({ tabs, activeTab, onTabChange }: Props) {
  return (
    <nav className="tab-bar" aria-label="Secciones del dashboard">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`tab-btn${activeTab === tab.id ? " active" : ""}${tab.disabled ? " tab-btn--disabled" : ""}`}
          onClick={() => !tab.disabled && onTabChange(tab.id)}
          aria-selected={activeTab === tab.id}
          aria-disabled={tab.disabled}
          role="tab"
          type="button"
          title={tab.disabled ? tab.disabledReason : undefined}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
