export type Tab = { id: string; label: string };

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
          className={`tab-btn${activeTab === tab.id ? " active" : ""}`}
          onClick={() => onTabChange(tab.id)}
          aria-selected={activeTab === tab.id}
          role="tab"
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
