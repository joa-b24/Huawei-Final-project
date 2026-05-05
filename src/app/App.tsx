import { useEffect, useMemo, useState } from "react";
import { AppProvider, actions, useAppContext, type TabId } from "../context/AppContext";
import { loadAppData, type AppData } from "../services/DataService";
import AppShell from "../components/layout/AppShell";
import Sidebar from "../components/layout/Sidebar";
import MainContent from "../components/layout/MainContent";
import TabBar, { type Tab } from "../components/layout/TabBar";
import TabPanel from "../components/layout/TabPanel";
import PhasePlaceholder from "../components/feedback/PhasePlaceholder";
import DiagnosticoTab from "../views/DiagnosticoTab";
import RelacionesTab from "../views/RelacionesTab";

const TABS: Tab[] = [
  { id: "diagnostico", label: "Diagnóstico" },
  { id: "relaciones", label: "Relaciones / Impacto" },
  { id: "estructura", label: "Estructura" },
  { id: "temporal", label: "Temporal" },
];

function Dashboard({ appData }: { appData: AppData }) {
  const { state, dispatch } = useAppContext();

  const allStateNames = useMemo(
    () => appData.dataset.records.map((r) => r.state),
    [appData.dataset.records]
  );

  const allVars = useMemo(
    () => appData.dataset.metricCatalog.map((m) => ({ id: m.id, label: m.label })),
    [appData.dataset.metricCatalog]
  );

  return (
    <AppShell>
      <Sidebar
        states={allStateNames}
        selectedStates={state.selectedStates}
        onToggleState={(s) => dispatch(actions.toggleState(s))}
        comparisonTarget={state.comparisonTarget}
        onComparisonChange={(t) => dispatch(actions.setComparisonTarget(t))}
        vars={allVars}
        activeVarIds={state.activeVariableIds}
        onToggleVar={(id) => dispatch(actions.toggleVariable(id))}
      />
      <MainContent>
        <TabBar
          tabs={TABS}
          activeTab={state.activeTab}
          onTabChange={(id) => dispatch(actions.setTab(id as TabId))}
        />
        <TabPanel id="diagnostico" activeTab={state.activeTab}>
          <DiagnosticoTab appData={appData} />
        </TabPanel>
        <TabPanel id="relaciones" activeTab={state.activeTab}>
          <RelacionesTab appData={appData} />
        </TabPanel>
        <TabPanel id="estructura" activeTab={state.activeTab}>
          <PhasePlaceholder
            message="Análisis de estructura latente (PCA + Clustering) disponible en la Fase 2."
            availableIn="Fase 2"
          />
        </TabPanel>
        <TabPanel id="temporal" activeTab={state.activeTab}>
          <PhasePlaceholder
            message="Series de tiempo y análisis de tendencias disponibles en la Fase 4."
            availableIn="Fase 4"
          />
        </TabPanel>
      </MainContent>
    </AppShell>
  );
}

export default function App() {
  const [appData, setAppData] = useState<AppData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadAppData()
      .then(setAppData)
      .catch((err) => setLoadError(String(err)));
  }, []);

  if (loadError) {
    return <div className="app-shell loading">Error al cargar datos: {loadError}</div>;
  }

  if (!appData) {
    return <div className="app-shell loading">Cargando dashboard...</div>;
  }

  return (
    <AppProvider>
      <Dashboard appData={appData} />
    </AppProvider>
  );
}
