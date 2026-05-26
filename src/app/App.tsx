import { useEffect, useMemo, useState } from "react";
import { Database, Download, HelpCircle, Layers } from "lucide-react";
import { AppProvider, actions, useAppContext, type TabId } from "../context/AppContext";
import { loadAppData, type AppData } from "../services/DataService";
import { loadHiddenIds, syncNoDataAutoHidden } from "../lib/dataStorage";
import AppShell from "../components/layout/AppShell";
import Sidebar from "../components/layout/Sidebar";
import MainContent from "../components/layout/MainContent";
import TabBar, { type Tab } from "../components/layout/TabBar";
import TabPanel from "../components/layout/TabPanel";
import DiagnosticoTab from "../views/DiagnosticoTab";
import RelacionesTab from "../views/RelacionesTab";
import EstructuraTab from "../views/EstructuraTab";
import EvolucionTab from "../views/EvolucionTab";
import DatosTab from "../views/DatosTab";
import StateTerritorialAnalysis from "../components/state-analysis/StateTerritorialAnalysis";
import HelpModal from "../components/feedback/HelpModal";

function buildTabs(appData: AppData): Tab[] {
  const hasMunicipal = appData.dataset.municipios.length > 0;
  const hasTemporalData = (appData.temporalVariables?.length ?? 0) > 0;
  return [
    { id: "diagnostico", label: "Diagnóstico" },
    { id: "relaciones", label: "Impacto" },
    ...(hasTemporalData ? [{ id: "temporal", label: "Evolución" } as Tab] : []),
    {
      id: "territorial",
      label: "Territorial",
      disabled: !hasMunicipal,
      disabledReason: "Requiere datos municipales (npm run data:build:analytics)",
    },
  ];
}

function Dashboard({ appData }: { appData: AppData }) {
  const { state, dispatch } = useAppContext();
  const [datosOpen, setDatosOpen] = useState(false);
  const [estructuraOpen, setEstructuraOpen] = useState(false);
  const [catalogVersion, setCatalogVersion] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);

  const hasPca = appData.pcaResults !== null;

  function exportSnapshot() {
    const styles = Array.from(document.styleSheets)
      .map((sheet) => {
        try {
          return Array.from(sheet.cssRules).map((r) => r.cssText).join("\n");
        } catch { return ""; }
      }).join("\n");
    const content = document.querySelector(".layout-shell")?.outerHTML ?? document.body.innerHTML;
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
    const roleMap = new Map(appData.variablesCatalog.map((v) => [v.variable_id, v.role ?? "analysis"]));
    return appData.dataset.metricCatalog
      .filter((m) => !hidden.has(m.id))
      .map((m) => ({ id: m.id, label: m.label, category: m.category, role: roleMap.get(m.id) ?? "analysis" }));
  }, [appData.dataset.metricCatalog, appData.variablesCatalog, catalogVersion]);

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
              tabs={buildTabs(appData)}
              activeTab={datosOpen || estructuraOpen ? "__none__" : state.activeTab}
              onTabChange={(id) => { setDatosOpen(false); setEstructuraOpen(false); dispatch(actions.setTab(id as TabId)); }}
            />
            <button
              className={`btn-datos${estructuraOpen ? " active" : ""}`}
              onClick={() => { setEstructuraOpen((v) => !v); setDatosOpen(false); }}
              type="button"
              title={hasPca ? "Estructura latente y clusters" : "Requiere ejecutar el análisis PCA"}
              style={!hasPca ? { opacity: 0.45, cursor: "not-allowed", pointerEvents: "none" } : undefined}
            >
              <Layers size={14} />
              Estructura
            </button>
            <button
              className={`btn-datos${datosOpen ? " active" : ""}`}
              onClick={() => { setDatosOpen((v) => !v); setEstructuraOpen(false); }}
              type="button"
            >
              <Database size={14} />
              Datos
            </button>
            <button
              className="btn-datos btn-datos--icon"
              onClick={exportSnapshot}
              type="button"
              title="Exportar snapshot HTML"
            >
              <Download size={14} />
            </button>
            <button
              className="btn-datos btn-datos--icon"
              onClick={() => setHelpOpen(true)}
              type="button"
              title="Ayuda y tutoriales"
            >
              <HelpCircle size={14} />
            </button>
          </div>
        </div>
        {datosOpen ? (
          <DatosTab appData={appData} onCatalogChange={() => setCatalogVersion((v) => v + 1)} />
        ) : estructuraOpen ? (
          <EstructuraTab appData={appData} />
        ) : (
          <>
            <TabPanel id="diagnostico" activeTab={state.activeTab}>
              <DiagnosticoTab appData={appData} />
            </TabPanel>
            <TabPanel id="relaciones" activeTab={state.activeTab}>
              <RelacionesTab appData={appData} />
            </TabPanel>
            <TabPanel id="temporal" activeTab={state.activeTab}>
              <EvolucionTab appData={appData} />
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
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
    </AppShell>
  );
}

export default function App() {
  const [appData, setAppData] = useState<AppData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadAppData()
      .then((data) => {
        const idsWithData = new Set(data.dataset.metricCatalog.map((m) => m.id));
        syncNoDataAutoHidden(idsWithData, data.variablesCatalog.map((v) => v.variable_id));
        setAppData(data);
      })
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
