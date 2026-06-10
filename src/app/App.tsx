import { useEffect, useMemo, useState } from "react";
import { Database, HelpCircle, Layers, Loader2, Printer, X } from "lucide-react";
import { snapshotCharts } from "../lib/svgToPng";
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
import TerritorialTab from "../views/TerritorialTab";
import HelpModal from "../components/feedback/HelpModal";
import { VAR_ID_TO_SCATTER_KEY, TERRITORIAL_VARIABLES } from "../components/state-analysis/analysisMetrics";
import { humanizeVarId } from "../utils/humanize";

const _territorialKeys = new Set(TERRITORIAL_VARIABLES.map((v) => v.key));

function buildTabs(appData: AppData, activeVarIds: string[]): Tab[] {
  const hasMunicipal = appData.municipalManifest !== null && Object.keys(appData.municipalManifest.states).length > 0;
  const temporalSet = new Set(appData.temporalVariables ?? []);
  const hasTemporalData = activeVarIds.some((id) => temporalSet.has(id));
  const municipalVarIds = new Set<string>();
  if (appData.municipalManifest) {
    Object.values(appData.municipalManifest.states).forEach((s) => s.variables.forEach((v) => municipalVarIds.add(v)));
  }
  const hasTerritorialVar = activeVarIds.some((id) => {
    const k = VAR_ID_TO_SCATTER_KEY[id];
    return municipalVarIds.has(id) && k !== undefined && _territorialKeys.has(k as (typeof TERRITORIAL_VARIABLES)[number]["key"]);
  });
  return [
    { id: "diagnostico", label: "Diagnóstico" },
    { id: "relaciones", label: "Impacto" },
    {
      id: "temporal",
      label: "Evolución",
      disabled: !hasTemporalData,
      disabledReason: "Activa una variable con datos historicos para ver evolucion",
    },
    {
      id: "territorial",
      label: "Territorial",
      disabled: !hasMunicipal || !hasTerritorialVar,
      disabledReason: !hasMunicipal
        ? "Requiere datos municipales (npm run data:build:analytics)"
        : "Activa una variable con datos municipales disponible para analisis territorial",
    },
  ];
}

function Dashboard({ appData, onRefreshData }: { appData: AppData; onRefreshData: () => void }) {
  const { state, dispatch } = useAppContext();
  const [datosOpen, setDatosOpen] = useState(false);
  const [estructuraOpen, setEstructuraOpen] = useState(false);
  const [catalogVersion, setCatalogVersion] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [reporteModalOpen, setReporteModalOpen] = useState(false);
  const [analystNotes, setAnalystNotes] = useState("");
  const [printing, setPrinting] = useState(false);

  const hasPca = appData.pcaResults !== null;
  const tabs = useMemo(() => buildTabs(appData, state.activeVariableIds), [appData, state.activeVariableIds]);

  useEffect(() => {
    const current = tabs.find((tab) => tab.id === state.activeTab);
    if (current?.disabled) {
      dispatch(actions.setTab("diagnostico"));
    }
  }, [dispatch, state.activeTab, tabs]);

  const today = new Date().toISOString().slice(0, 10);

  async function handlePrint() {
    setReporteModalOpen(false);
    setPrinting(true);
    await new Promise<void>((r) => setTimeout(r, 80));

    // Remove any leftover images from a previous incomplete print
    document.querySelectorAll<HTMLImageElement>(".print-chart-img").forEach((img) => img.remove());

    const cleanup = await snapshotCharts();

    await new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 60)));
    window.print();

    let fallbackId: ReturnType<typeof setTimeout>;
    const finish = () => {
      cleanup();
      setPrinting(false);
      window.removeEventListener("afterprint", finish);
      clearTimeout(fallbackId);
    };
    window.addEventListener("afterprint", finish);
    fallbackId = setTimeout(finish, 10_000);
  }

  const allStateNames = useMemo(
    () => appData.dataset.records.map((r) => r.state),
    [appData.dataset.records]
  );

  const primaryRecord = useMemo(
    () => appData.dataset.records.find((r) => r.state === state.primaryState) ?? null,
    [appData.dataset.records, state.primaryState]
  );
  const regionGroupId = primaryRecord?.region ? `r:${primaryRecord.region}` : null;

  const primaryPcaRecord = useMemo(
    () => appData.pcaResults?.records.find((r) => r.state === state.primaryState) ?? null,
    [appData.pcaResults, state.primaryState]
  );
  const primaryClusterGroupId = primaryPcaRecord !== null ? `c:${primaryPcaRecord.cluster}` : null;
  const primaryClusterLabel = primaryPcaRecord !== null
    ? (appData.pcaResults?.cluster_stats[String(primaryPcaRecord.cluster)]?.label ?? `Cluster ${primaryPcaRecord.cluster}`)
    : null;

  const munVarIds = useMemo(() => {
    if (!appData.municipalManifest) return new Set<string>();
    const all = new Set<string>();
    Object.values(appData.municipalManifest.states).forEach((s) => s.variables.forEach((v) => all.add(v)));
    return all;
  }, [appData.municipalManifest]);

  const histVarIds = useMemo(() => new Set(appData.temporalVariables), [appData.temporalVariables]);

  const allVars = useMemo(() => {
    const hidden = loadHiddenIds();
    const roleMap = new Map(appData.variablesCatalog.map((v) => [v.variable_id, v.role ?? "both"]));
    return appData.dataset.metricCatalog
      .filter((m) => !hidden.has(m.id))
      .map((m) => ({
        id: m.id,
        label: m.label && m.label !== m.id ? m.label : humanizeVarId(m.id),
        category: m.category,
        role: roleMap.get(m.id) ?? "both",
        hasMunicipal: munVarIds.has(m.id),
        hasHistorical: histVarIds.has(m.id),
      }));
  }, [appData.dataset.metricCatalog, appData.variablesCatalog, munVarIds, histVarIds, catalogVersion]);

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
      {/* ── Print-only header ──────────────────────────────────────────────── */}
      <div className="print-header">
        <div className="print-header__orgs">
          <span className="print-header__org">Tecnológico de Monterrey</span>
          <span className="print-header__sep" aria-hidden>·</span>
          <span className="print-header__org">Huawei</span>
        </div>
        <h1 className="print-header__title">Paquete de Diagnóstico Territorial</h1>
        <div className="print-header__meta">
          <span>Estado analizado: <strong>{state.primaryState ?? "—"}</strong></span>
          <span>Fecha de generación: <strong>{today}</strong></span>
          <span>Variables activas: <strong>{state.activeVariableIds.length}</strong></span>
        </div>
        {analystNotes.trim() && (
          <div className="print-header__notes">
            <p className="print-header__notes-label">Notas del Analista</p>
            <p className="print-header__notes-text">{analystNotes}</p>
          </div>
        )}
        <hr className="print-header__rule" />
      </div>

      <Sidebar
        states={allStateNames}
        primaryState={state.primaryState}
        onSelectState={(s) => dispatch(actions.setPrimaryState(s))}
        vars={allVars}
        activeVarIds={state.activeVariableIds}
        onToggleVar={(id) => dispatch(actions.toggleVariable(id))}
        onClearVars={() => dispatch(actions.setVariables([]))}
        comparisonGroups={state.comparisonGroups}
        onComparisonGroupsChange={(groups) => dispatch(actions.setComparisonGroups(groups))}
        regionGroupId={regionGroupId}
        primaryClusterGroupId={primaryClusterGroupId}
        primaryClusterLabel={primaryClusterLabel}
        hidden={datosOpen || estructuraOpen}
      />
      <MainContent noSidebar={datosOpen || estructuraOpen}>
        <h1 className="page-title">Análisis de Indicadores Estatales</h1>
        <div className="tab-bar-row">
          <p className="tab-section-label">
            Perfil de <strong>{state.primaryState}</strong>
          </p>
          <div style={{ display: "flex", alignItems: "stretch" }}>
            <TabBar
              tabs={tabs}
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
              onClick={() => setReporteModalOpen(true)}
              type="button"
              title="Reporte ejecutivo / Imprimir"
            >
              <Printer size={14} />
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
          <DatosTab appData={appData} onCatalogChange={() => { setCatalogVersion((v) => v + 1); onRefreshData(); }} />
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
              <TerritorialTab appData={appData} />
            </TabPanel>
          </>
        )}
      </MainContent>
      {helpOpen && (
        <HelpModal
          onClose={() => setHelpOpen(false)}
          currentContext={datosOpen ? "datos" : estructuraOpen ? "estructura" : state.activeTab}
        />
      )}

      {/* ── Reporte modal (notas del analista) ─────────────────────────────── */}
      {reporteModalOpen && (
        <div className="help-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setReporteModalOpen(false); }}>
          <div className="help-modal reporte-modal">
            <div className="help-modal__header">
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-1)" }}>Reporte Ejecutivo</h2>
                <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
                  Agrega notas opcionales del analista antes de imprimir.
                </p>
              </div>
              <button className="help-modal__close" onClick={() => setReporteModalOpen(false)} type="button">
                <X size={16} />
              </button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 6 }}>
                Notas del Analista <span style={{ fontWeight: 400, color: "var(--text-3)" }}>(opcional)</span>
              </p>
              <textarea
                className="reporte-notes-input"
                rows={5}
                placeholder="Contexto, observaciones o recomendaciones que aparecerán en el encabezado del reporte impreso…"
                value={analystNotes}
                onChange={(e) => setAnalystNotes(e.target.value)}
              />
            </div>

            <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>
              <p style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.6 }}>
                El reporte imprimirá el estado de la vista actual: <strong>{state.primaryState ?? "—"}</strong> · {today}.
                El sidebar, botones de navegación y controles interactivos se ocultarán automáticamente.
                Los diagramas se ajustarán para evitar cortes de página.
              </p>
            </div>

            <div className="wizard-nav">
              <button className="btn-ghost" type="button" onClick={() => setReporteModalOpen(false)}>Cancelar</button>
              <button className="btn-primary" type="button" onClick={handlePrint} disabled={printing}>
                {printing
                  ? <><Loader2 size={13} style={{ marginRight: 6, animation: "spin 1s linear infinite" }} /> Preparando…</>
                  : <><Printer size={13} style={{ marginRight: 6 }} /> Imprimir / Guardar PDF</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Print-only footer (notas metodológicas) ─────────────────────────── */}
      <div className="print-footer">
        <hr className="print-footer__rule" />
        <h3 className="print-footer__title">Notas Metodológicas</h3>
        <ul className="print-footer__list">
          <li><strong>Conectividad:</strong> INEGI ENDUTIH 2024 + IFT Cobertura Móvil 2024. Indicadores de uso y acceso a internet por entidad federativa.</li>
          <li><strong>Bienestar social:</strong> CONEVAL 2022. Índices de pobreza, carencias y rezago educativo.</li>
          <li><strong>Economía y demografía:</strong> INEGI ITER 2020; PIB estatal 2022–2024 (INEGI).</li>
          <li><strong>Coeficiente de Gini:</strong> calculado sobre la distribución municipal normalizada [0–1] de cada indicador en los estados con datos municipales disponibles.</li>
          <li><strong>Correlaciones de Spearman:</strong> coeficiente de rango entre pares de indicadores estatales; umbral de significancia p &lt; 0.05.</li>
          <li><strong>Análisis PCA:</strong> componentes principales (varianza explicada ≥ 70 %) sobre variables con cobertura estatal completa; clústeres por K-Means sobre los primeros 2 componentes.</li>
        </ul>
        <p className="print-footer__stamp">© 2026 Tecnológico de Monterrey · Generado: {today}</p>
      </div>
    </AppShell>
  );
}

const LOADING_MIN_MS = 700;

export default function App() {
  const [appData, setAppData] = useState<AppData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  function doLoad() {
    const start = Date.now();
    return loadAppData()
      .then((data) => {
        const idsWithData = new Set(data.dataset.metricCatalog.map((m) => m.id));
        syncNoDataAutoHidden(idsWithData, data.variablesCatalog.map((v) => v.variable_id));
        const elapsed = Date.now() - start;
        const remaining = Math.max(0, LOADING_MIN_MS - elapsed);
        setTimeout(() => setAppData(data), remaining);
      })
      .catch((err) => setLoadError(String(err)));
  }

  useEffect(() => { doLoad(); }, []);

  if (loadError) {
    return <div className="app-shell loading">Error al cargar datos: {loadError}</div>;
  }

  if (!appData) {
    return (
      <div className="app-shell loading">
        <div className="loading-screen">
          <svg className="loading-logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
            <defs>
              <linearGradient id="llBlue" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1b46ba" />
                <stop offset="100%" stopColor="#0b2475" />
              </linearGradient>
              <linearGradient id="llCyan" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#22d3ee" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
            </defs>
            <g transform="translate(10, 10)">
              <path className="loading-logo__layer loading-logo__layer--3" d="M 15 55 L 40 70 L 65 55 L 40 40 Z" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="2" strokeLinejoin="round" />
              <path className="loading-logo__layer loading-logo__layer--2" d="M 15 38 L 40 53 L 65 38 L 40 23 Z" fill="url(#llCyan)" fillOpacity="0.25" stroke="url(#llCyan)" strokeWidth="2.5" strokeLinejoin="round" />
              <path className="loading-logo__layer loading-logo__layer--1" d="M 15 21 L 40 36 L 65 21 L 40 6 Z" fill="url(#llBlue)" fillOpacity="0.85" stroke="url(#llBlue)" strokeWidth="3" strokeLinejoin="round" />
              <line x1="40" y1="6" x2="40" y2="70" stroke="url(#llCyan)" strokeWidth="2.5" strokeDasharray="2 3" opacity="0.7" />
              <circle cx="40" cy="21" r="5" fill="#ffffff" stroke="url(#llBlue)" strokeWidth="3" />
              <circle cx="40" cy="21" r="1.5" fill="url(#llCyan)" />
            </g>
          </svg>
          <div className="loading-text">
            <span className="loading-text__title">Observatorio de Indicadores</span>
            <span className="loading-text__sub">
              Cargando datos
              <span className="loading-dots">
                <span>.</span><span>.</span><span>.</span>
              </span>
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AppProvider>
      <Dashboard appData={appData} onRefreshData={doLoad} />
    </AppProvider>
  );
}
