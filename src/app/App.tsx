import { useEffect, useMemo, useState } from "react";
import { Database, Download } from "lucide-react";
import { AppProvider, actions, useAppContext, type TabId } from "../context/AppContext";
import { loadAppData, type AppData } from "../services/DataService";
import { loadHiddenIds } from "../lib/dataStorage";
import type { MetricDefinition, StateMetricRecord } from "../types/dataset";
import AppShell from "../components/layout/AppShell";
import Sidebar from "../components/layout/Sidebar";
import MainContent from "../components/layout/MainContent";
import TabBar, { type Tab } from "../components/layout/TabBar";
import TabPanel from "../components/layout/TabPanel";
import PhasePlaceholder from "../components/feedback/PhasePlaceholder";
import DiagnosticoTab from "../views/DiagnosticoTab";
import RelacionesTab from "../views/RelacionesTab";
import DatosTab from "../views/DatosTab";
import StateTerritorialAnalysis from "../components/state-analysis/StateTerritorialAnalysis";

const TABS: Tab[] = [
  { id: "diagnostico", label: "Diagnóstico" },
  { id: "relaciones", label: "Impacto" },
  { id: "estructura", label: "Estructura" },
  { id: "temporal", label: "Evolución" },
  { id: "territorial", label: "Territorial" },
];

export type ImportedData = {
  records: StateMetricRecord[];
  newMetrics: MetricDefinition[];
};

function mergeImport(base: AppData, imported: ImportedData): AppData {
  const existingCodes = new Set(base.dataset.records.map((r) => r.stateCode ?? r.state));
  const newRecords = imported.records.filter(
    (r) => !existingCodes.has(r.stateCode ?? r.state)
  );
  const mergedRecords = base.dataset.records.map((r) => {
    const patch = imported.records.find(
      (ir) => (ir.stateCode ?? ir.state) === (r.stateCode ?? r.state)
    );
    return patch ? { ...r, metrics: { ...r.metrics, ...patch.metrics } } : r;
  });
  const metricIds = new Set(base.dataset.metricCatalog.map((m) => m.id));
  const newMetrics = imported.newMetrics.filter((m) => !metricIds.has(m.id));
  return {
    ...base,
    dataset: {
      ...base.dataset,
      records: [...mergedRecords, ...newRecords],
      metricCatalog: [...base.dataset.metricCatalog, ...newMetrics],
    },
  };
}

function Dashboard({ appData, onImport }: { appData: AppData; onImport: (d: ImportedData) => void }) {
  const { state, dispatch } = useAppContext();
  const [datosOpen, setDatosOpen] = useState(false);
  const [catalogVersion, setCatalogVersion] = useState(0);

  function exportSnapshot() {
    const styles = Array.from(document.styleSheets)
      .map((sheet) => {
        try {
          return Array.from(sheet.cssRules).map((r) => r.cssText).join("\n");
        } catch { return ""; }
      }).join("\n");
    const content = document.querySelector(".layout-main")?.outerHTML ?? document.body.innerHTML;
    const date = new Date().toISOString().slice(0, 10);
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Dashboard Snapshot ${date}</title>
<style>${styles}</style>
<style>button,select,input{pointer-events:none!important;cursor:default!important}.sidebar-toggle{display:none}</style>
</head>
<body>${content}</body>
</html>`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    a.download = `dashboard-snapshot-${date}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const allStateNames = useMemo(
    () => appData.dataset.records.map((r) => r.state),
    [appData.dataset.records]
  );

  const allVars = useMemo(() => {
    const hidden = loadHiddenIds();
    return appData.dataset.metricCatalog
      .filter((m) => !hidden.has(m.id))
      .map((m) => ({ id: m.id, label: m.label, category: m.category }));
  }, [appData.dataset.metricCatalog, catalogVersion]);

  // Deactivate any variable that got hidden
  useEffect(() => {
    const hidden = loadHiddenIds();
    const filtered = state.activeVariableIds.filter((id) => !hidden.has(id));
    if (filtered.length !== state.activeVariableIds.length) {
      dispatch(actions.setVariables(filtered));
    }
  }, [catalogVersion]);

  return (
    <AppShell>
      <Sidebar
        states={allStateNames}
        primaryState={state.primaryState}
        onSelectState={(s) => dispatch(actions.setPrimaryState(s))}
        vars={allVars}
        activeVarIds={state.activeVariableIds}
        onToggleVar={(id) => dispatch(actions.toggleVariable(id))}
        onClearVars={() => dispatch(actions.setVariables([]))}
      />
      <MainContent>
        <h1 className="page-title">Análisis de Indicadores Estatales</h1>
        <div className="tab-bar-row">
          <p className="tab-section-label">
            Perfil de <strong>{state.primaryState}</strong>
          </p>
          <div style={{ display: "flex", alignItems: "stretch" }}>
            <TabBar
              tabs={TABS}
              activeTab={datosOpen ? "__none__" : state.activeTab}
              onTabChange={(id) => { setDatosOpen(false); dispatch(actions.setTab(id as TabId)); }}
            />
            <button
              className={`btn-datos${datosOpen ? " active" : ""}`}
              onClick={() => setDatosOpen((v) => !v)}
              type="button"
            >
              <Database size={14} />
              Datos
            </button>
            <button
              className="btn-datos"
              onClick={exportSnapshot}
              type="button"
              title="Exportar snapshot HTML"
            >
              <Download size={14} />
              Exportar
            </button>
          </div>
        </div>
        {datosOpen ? (
          <DatosTab appData={appData} onImport={onImport} onCatalogChange={() => setCatalogVersion((v) => v + 1)} />
        ) : (
          <>
            <TabPanel id="diagnostico" activeTab={state.activeTab}>
              <DiagnosticoTab appData={appData} />
            </TabPanel>
            <TabPanel id="relaciones" activeTab={state.activeTab}>
              <RelacionesTab appData={appData} />
            </TabPanel>
            <TabPanel id="estructura" activeTab={state.activeTab}>
              <PhasePlaceholder
                message="Análisis de estructura latente (PCA + Clustering) — no disponible aún."
              />
            </TabPanel>
            <TabPanel id="temporal" activeTab={state.activeTab}>
              <PhasePlaceholder
                message="Series de tiempo y análisis de tendencias — no disponible aún."
              />
            </TabPanel>
            <TabPanel id="territorial" activeTab={state.activeTab}>
              <StateTerritorialAnalysis
                stateAnalytics={appData.dataset.stateAnalytics}
                municipios={appData.dataset.municipios}
              />
            </TabPanel>
          </>
        )}
      </MainContent>
    </AppShell>
  );
}

export default function App() {
  const [appData, setAppData] = useState<AppData | null>(null);
  const [importedData, setImportedData] = useState<ImportedData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadAppData()
      .then(setAppData)
      .catch((err) => setLoadError(String(err)));
  }, []);

  const mergedAppData = useMemo(
    () => (appData && importedData ? mergeImport(appData, importedData) : appData),
    [appData, importedData]
  );

  if (loadError) {
    return <div className="app-shell loading">Error al cargar datos: {loadError}</div>;
  }

  if (!mergedAppData) {
    return <div className="app-shell loading">Cargando dashboard...</div>;
  }

  return (
    <AppProvider>
      <Dashboard appData={mergedAppData} onImport={setImportedData} />
    </AppProvider>
  );
}
